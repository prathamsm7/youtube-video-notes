import logging
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from google.api_core import exceptions

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_with_fallback(client, prompt: str, primary_model: str, fallback_model: str, config: dict = None) -> str:
    """
    Executes an LLM generation call with retry logic and an automatic model fallback.
    
    Args:
        client: The genai.Client instance.
        prompt: The full prompt string.
        primary_model: Name of the first model to try.
        fallback_model: Name of the fallback model if the primary fails.
        config: Generation configuration (temperature, etc.).
        
    Returns:
        The generated text content.
    """
    if config is None:
        config = {"temperature": 0.5}

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type((
            exceptions.ResourceExhausted, 
            exceptions.ServiceUnavailable, 
            exceptions.InternalServerError,
            exceptions.DeadlineExceeded
        )),
        reraise=True
    )
    def _safe_generate(model_name: str):
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config
        )
        if not response.text:
            # Handle cases where safety filters might block the response without raising an exception
            if hasattr(response, 'candidates') and response.candidates:
                finish_reason = getattr(response.candidates[0], 'finish_reason', 'UNKNOWN')
                if finish_reason == 'SAFETY':
                    return "Content blocked by safety filters."
            return "No content generated."
        return response.text.strip()

    try:
        # 1. Attempt Primary
        logger.info(f"Attempting Primary LLM: {primary_model}")
        return _safe_generate(primary_model)
    except Exception as e:
        logger.warning(f"Primary LLM ({primary_model}) failed: {str(e)}. Switching to Fallback: {fallback_model}")
        try:
            # 2. Attempt Fallback
            return _safe_generate(fallback_model)
        except Exception as e_final:
            logger.error(f"Critical: Both Primary and Fallback LLMs failed. Final Error: {str(e_final)}")
            raise e_final
