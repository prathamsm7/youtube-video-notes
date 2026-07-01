-- CreateTable
CREATE TABLE "EvalExample" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvalExample_sortOrder_key" ON "EvalExample"("sortOrder");

-- CreateIndex
CREATE INDEX "EvalExample_sortOrder_idx" ON "EvalExample"("sortOrder");

-- Seed existing golden dataset
INSERT INTO "EvalExample" ("id", "sortOrder", "question", "referenceAnswer") VALUES
('eval-example-001', 1, $$The Fundamental Goal of a Language Model ?$$, $$The fundamental goal of a language model, such as those powering ChatGPT (GPT) or BERT, is to predict the next word (or token) in a sequence (1:36 - 1:39). When you provide input to a language model, the process follows these core steps:
Input Processing: The model takes your sequence of text and generates the next most probable word based on the vast amount of data it was trained on (1:12 - 1:18).
Iterative Prediction: After predicting one word, the model adds that word to the original sequence and uses this updated input to predict the next subsequent word. This process repeats until the model generates a complete response, which can seem like magic to the user (1:20 - 1:31).
Contextual Understanding: To perform this effectively, models go beyond simple static word associations (like Word2Vec) and use contextual embeddings. These embeddings allow the model to understand the meaning of words based on their surrounding context (e.g., how the meaning of 'dish' shifts depending on whether it is a 'rice dish' or a 'sweet Indian rice dish') (9:04 - 9:15, 10:07 - 10:27).$$),
('eval-example-002', 2, $$Why are static word embeddings insufficient for modern language models like GPT?$$, $$Static word embeddings (like Word2Vec or GloVe) are insufficient for modern language models like GPT because they assign a fixed, single numerical vector to a word, regardless of the context in which it appears (7:42 - 8:05).

The primary limitations include:

Polysemy and Context Blindness: Many words have different meanings based on their surroundings. For example, the word "track" in "the train will run on the track" versus "help me track my package" has distinct meanings, yet a static model represents both with the same vector (7:42 - 7:59).
Loss of Nuance: Complex language relies on modifiers and surrounding tokens to refine meaning. If you have the phrase "rice dish" versus "sweet Indian rice dish," the semantic meaning of "dish" shifts significantly. Static embeddings cannot adapt to these shifts, whereas modern language models use contextual embeddings to dynamically update a word's vector representation based on its specific environment (8:10 - 9:02, 9:55 - 10:27).
Inability to Capture Global Relationships: In modern architectures like Transformers, a word's meaning is influenced not just by immediate neighbors, but by long-range dependencies across an entire paragraph. Static methods fail to aggregate this broader context (10:35 - 11:42).$$),
('eval-example-003', 3, $$How do contextual embeddings differ from static embeddings in representing word meaning?$$, $$The fundamental difference between static and contextual embeddings lies in their ability to adapt to the meaning of a word based on its surroundings (7:42 - 9:02).

Static Embeddings (e.g., Word2Vec, GloVe): These assign a fixed, single vector to every word in the vocabulary, regardless of the sentence it appears in. Because they are context-blind, they struggle with words that have multiple meanings (polysemy). For example, the word "track" is represented by the same static vector whether it refers to a train track or tracking a package, failing to capture the nuance of its specific use (7:42 - 8:05).
Contextual Embeddings (used in Transformers like GPT and BERT): These are dynamic. They represent a word by taking its base meaning and updating it based on the context provided by all other words in the sequence. For instance, the embedding for "dish" changes significantly when it is part of a "rice dish" versus a "sweet Indian rice dish." The model leverages the relationships between all words in a sentence—and even across a paragraph—to refine the embedding to be contextually accurate (9:04 - 10:27, 10:35 - 11:42).$$),
('eval-example-004', 4, $$What are the primary roles of the encoder and decoder components in a Transformer?$$, $$In the Transformer architecture, the encoder and decoder work together to process information, though their specific roles differ:

The Encoder's Role (12:12 - 12:26): The primary purpose of the encoder is to ingest the input sentence (or sequence) and generate a context-aware embedding for each token. By analyzing the entire sequence in parallel and using mechanisms like multi-head attention, the encoder captures how tokens relate to one another, enriching their meaning based on the surrounding text.
The Decoder's Role (12:26 - 13:00, 51:41 - 54:12): The decoder takes the rich, context-aware embeddings produced by the encoder and uses them to generate an output. In tasks like next-word prediction or machine translation, the decoder predicts the next element in a sequence step-by-step. It often utilizes cross-attention (52:24 - 54:12), where it looks back at the encoder's output to ensure the generated text remains aligned with the original input information.
While some specific models utilize only one part (such as BERT, which is encoder-only, or GPT, which is primarily decoder-focused), the original paper's architecture combines these two components to achieve powerful sequence-to-sequence modeling.$$),
('eval-example-005', 5, $$What is the significance of the tokenization process and how does it impact model input?$$, $$The tokenization process is a foundational step in the Transformer architecture that transforms raw text into a numerical format that machine learning models can understand. Its significance and impact on model input are detailed below:

Bridging Language and Math (1:48 - 2:46): Machine learning models cannot interpret raw text; they require numerical input. Tokenization is the process of breaking down sentences into smaller units called tokens. For example, the word "calling" might be split into two tokens: "call" and "ed" (20:05 - 20:11).
Vocabulary Creation (17:43 - 18:32): During training, the model builds a vocabulary—a comprehensive list of these tokens. Each token is assigned a specific token ID, which acts as an index (e.g., the word "made" corresponds to ID 2532 in the BERT model) (20:38 - 20:54).
Preparation for Embeddings (21:07 - 21:44): Once the input is converted into a sequence of token IDs, these IDs are used to retrieve static embeddings—high-dimensional vectors that capture the initial meaning of the words. These vectors are then further refined by adding positional embeddings to ensure the model understands the order of words in a sentence, which is critical since Transformers process inputs in parallel (21:44 - 22:30).
In essence, tokenization acts as the gatekeeper; it standardizes input data, allowing the Transformer to map complex human language into a high-dimensional mathematical space where it can analyze contextual relationships.$$),
('eval-example-006', 6, $$Why are positional embeddings necessary in Transformer models compared to older architectures like RNNs?$$, $$Positional embeddings are a critical component in Transformer architecture because they address the inherent limitation of processing data in parallel. Here is why they are necessary compared to older architectures like Recurrent Neural Networks (RNNs):

Sequential vs. Parallel Processing (21:49 - 22:15):

RNNs: These older models process data sequentially, one word at a time. Because the words enter the model in a specific order, the model naturally "knows" the sequence and structure of the sentence.
Transformers: Unlike RNNs, Transformers process the entire input sequence in parallel. This significantly increases training speed, but the model loses the inherent sense of word order.
The Need for Context (21:49 - 22:15):
In human language, word order is fundamental to meaning—swapping words can completely change the intent of a sentence. Since Transformers lack a natural sense of sequence due to parallel processing, they must be manually provided with positional information.

How Positional Embeddings Work (22:15 - 23:10):
To solve this, Transformers use positional embeddings, where a specific vector is added to the token embedding of each word (21:44 - 22:30). This allows the model to "understand" that a specific word is at the first, second, or third position, ensuring the Transformer can process data in parallel while still respecting the logical order of language.$$),
('eval-example-007', 7, $$How does the "Attention is All You Need" mechanism allow the model to weigh the importance of different words?$$, $$The "Attention is All You Need" mechanism, specifically Self-Attention, enables the model to determine how much focus or "weight" one word should place on other words in a sentence to understand context. It achieves this through a structured mathematical process involving three main vectors: Query (Q), Key (K), and Value (V) (26:33 - 27:48).

Here is how the mechanism functions:

Representing Words as Vectors: Each input token is transformed into three distinct vectors—Query, Key, and Value—by multiplying its embedding with learned weight matrices (
) (32:24 - 34:10, 37:27 - 38:05).

Query (Q): Represents the current word "asking" for information about its context.
Key (K): Represents the description each word offers about itself (like a label in a library).
Value (V): Represents the actual content or meaning the word contributes to the context.
Calculating Attention Scores: The model calculates the dot product between the Query of one word and the Keys of all other words in the sequence. This dot product measures how relevant one word is to another (28:00 - 29:26, 38:20 - 38:43).

Softmax Normalization: These scores are passed through a Softmax function, which converts them into probabilities (percentages) that sum up to 1. This ensures that the model knows exactly how much "attention" (percentage of influence) to assign to each surrounding word (38:48 - 39:56).

Weighted Sum: Finally, the model multiplies these attention weights by the Value (V) vectors of the tokens. The sum of these weighted values creates a new, context-aware embedding for the word, which is significantly richer and more accurate than the original static embedding (31:02 - 32:20, 40:03 - 41:19).

Why this is powerful:
Instead of treating a word like "dish" in isolation, the model uses these attention scores to dynamically "gather" information from adjectives like "sweet," "Indian," or "rice" to build a highly nuanced representation of what the word means in that specific sentence (25:38 - 26:30, 42:25 - 45:10).$$),
('eval-example-008', 8, $$Can you explain the Query, Key, and Value (QKV) analogy in the context of attention?$$, $$The Query (Q), Key (K), and Value (V) mechanism is the core of how Transformers calculate attention (26:33). The video uses two helpful analogies to explain how these components interact to weigh the importance of different words:

1. The Library Analogy (26:44)
Imagine you are at a library searching for information:

Query (Q): This is the search term you provide (e.g., "quantum physics book").
Key (K): These are the labels on the library racks or the book descriptions that help you locate relevant items.
Value (V): This is the actual content inside the book once you have successfully located it using the search query and the rack labels.
2. The Professor and Students Analogy (27:51)
Alternatively, imagine a professor asking students to help write an essay on Quantum Computing:

Query (Q): The professor's specific topic request (he wants content on Quantum Computing).
Key (K): Each student claims what they know (e.g., one says "I know linear algebra," another says "I know quantum mechanics"). The professor compares his query to these keys to see who is the best fit.
Value (V): Once the professor decides who to listen to (giving more "attention weight" to the student who knows quantum mechanics), the actual essay paragraphs (the value) written by those students are combined to form the final result (28:42 - 29:09).
How it works mathematically (30:00 - 32:20)
In the model, each input word (token) is transformed into these three vectors by multiplying its embedding with learned matrices (
):

Dot Product: The model performs a dot product between the Query of one word and the Keys of all other words to calculate an attention score (how relevant they are to each other).
Softmax: These scores are passed through a Softmax function to turn them into probabilities (percentages) that sum to 1.
Weighted Sum: Finally, the model multiplies these percentages by the Value vectors. The resulting weighted sum is a new, highly nuanced context-aware embedding for that word (31:02 - 32:00).$$),
('eval-example-009', 9, $$What is the purpose of the softmax function during the attention calculation?$$, $$The Softmax function plays a critical role in the Transformer's attention mechanism by converting raw attention scores into probabilities (38:48 - 40:00).

Here is why it is used:

Standardizing Scores: After calculating the dot product between the Query (Q) and Key (K) vectors, you are left with a set of discrete values that can vary widely. The Softmax function transforms these into a probability distribution where the sum of all scores equals 1 (or 100%) (38:48 - 39:15).
Assigning Influence: This conversion allows the model to treat the output as a set of "weights" or "percentages." These percentages determine how much Value (V) each surrounding word should contribute to the final context-aware embedding of the current token (40:03 - 41:19).
Essentially, it tells the model, "Look at this word with 30% importance, that word with 10% importance, and ignore the rest," ensuring the final calculation is balanced and interpretable by the subsequent layers of the network$$),
('eval-example-010', 10, $$Why are multi-head attention mechanisms used instead of a single attention head?$$, $$Multi-head attention mechanisms are used in Transformers because they allow the model to simultaneously focus on different aspects and types of relationships within the data, rather than being limited to a single perspective (42:25 - 44:20).

Why multiple heads are superior to one:

Diverse Contextual Focus: Each attention head can specialize in capturing different types of information. For example, one head might focus on adjectives modifying a noun, another might track pronoun references, and a third might analyze verb actions or temporal relationships (43:10 - 44:23).
Enriched Representations: By running multiple attention calculations in parallel, the model can synthesize a much richer, more comprehensive "context-aware" embedding for each token. It is essentially viewing the same sentence through several different lenses at the same time (44:23 - 45:10).
Parallel Processing: Just as the Transformer processes sequence data in parallel, multi-head attention ensures that these different relational analyses happen concurrently, making the model both more expressive and computationally efficient (42:55 - 43:10).
In short, using multiple heads prevents the model from missing subtle, layered meanings in human language that a single attention mechanism might overlook.$$),
('eval-example-011', 11, $$What is the function of the feed-forward neural network after the attention block?$$, $$The feed-forward neural network serves as a crucial refinement step within each Transformer block (46:12 - 47:05). While the multi-head attention mechanism excels at identifying relationships and contextual connections between tokens, the feed-forward network adds an essential layer of non-linear transformation (48:19 - 48:40).

Here is its primary function:

Complex Pattern Recognition: By applying non-linear transformations independently to each token's embedding, the model can learn deeper, more complex patterns and higher-order features that simple attention calculations might miss (48:30 - 49:01).
Refinement: The output of the attention block is "enriched," but it is not yet fully processed. The feed-forward network acts as a final "polishing" layer, refining the representation of each token before it either proceeds to the next layer or the final output (46:27 - 46:40, 47:20 - 47:40).
Parallel processing: Similar to the attention block, this process is applied to each token in the sequence in parallel, ensuring the model remains computationally efficient while drastically increasing its representational capacity (49:03 - 49:46).$$),
('eval-example-012', 12, $$How does the model handle the "long-distance" relationships between words in a sequence?$$, $$The Transformer architecture handles "long-distance" relationships between words effectively because it does not rely on a sequential, step-by-step processing method like older RNN models (22:00-22:15). Instead, it processes the entire sequence in parallel.

Here is how this enables the model to capture distant connections:

Global View via Self-Attention: Through the self-attention mechanism, every word in a sequence can "attend" to every other word, regardless of how far apart they are in the sentence (24:00-26:30, 42:55-43:10).
Contextual Enrichment: When generating a representation for a specific word, the model uses its Query to scan the Keys of all other words in the input. If a word at the beginning of a paragraph is highly relevant to a word at the very end, the attention scores (calculated via dot product) will reflect this, allowing the distant word to contribute its Value directly to the context-aware embedding of the current word (10:55-11:45, 29:50-32:20).
Mathematical Connectivity: Because the attention mechanism computes a global matrix of interactions, the "distance" between words is essentially eliminated; every token is only one mathematical step away from every other token in the sequence.
This capability allows the model to maintain coherence across long paragraphs, such as understanding how a pronoun or a specific noun mentioned early in a text influences the meaning of words that appear much later (11:00-11:45).$$),
('eval-example-013', 13, $$What is "cross attention" and why is it specifically used in the decoder part for tasks like translation?$$, $$Cross-attention is a specialized mechanism in the Transformer architecture that bridges the gap between the encoder (which processes the input) and the decoder (which generates the output) (52:18-53:40).

In tasks like language translation, the decoder needs to know what it is translating from the original sentence. Here is why cross-attention is essential:

The How the vectors work:
Query (Q): Comes from the decoder. It represents the state of the translation process so far (e.g., 'I have translated the subject, what should I translate next?') (53:08-53:12).
Key (K) & Value (V): Come from the encoder. These contain the context-aware information of the original source sentence (e.g., the English input) (53:45-53:55).
By comparing the decoder's current needs (Query) against the encoder's source context (Key), the model can selectively focus on the most relevant parts of the original sentence to generate the next word in the target language (53:25-54:13). This interaction is why it is called 'cross' attention—it allows information to flow across from the encoder's processing to the decoder's generation.$$),
('eval-example-014', 14, $$How do residual connections and layer normalization contribute to the stability of the training process?$$, $$Residual connections and layer normalization are key components for ensuring stable training and effective gradient flow within the architecture (45:56 - 46:09, 50:02 - 50:26).

Residual Connections: These connections, represented in the architecture by the path that adds the original input to the output of a block, help facilitate smooth gradient flow during the training process (45:56 - 46:09).
Layer Normalization: This process ensures that the values within the network remain stable. By normalizing the data (specifically targeting a zero mean and unit standard deviation), the model prevents extreme ranges in values, which leads to better control over the training and improves learning stability (50:02 - 50:26).$$),
('eval-example-015', 15, $$What is the difference in architecture between models like BERT (encoder-only) and GPT (decoder-only)?$$, $$The fundamental difference lies in which components of the original Transformer architecture each model utilizes. While both are built on the Transformer foundation, they are specialized for different tasks (15:05-16:03).

Encoder-Only Models (e.g., BERT):

Structure: These models use only the encoder stack of the Transformer architecture.
Information Processing: BERT processes the entire input sequence simultaneously in parallel. Its goal is to generate deep, contextual embeddings for every word based on the full sentence, which is ideal for understanding tasks like sentiment analysis or text classification (15:26-15:42).
Decoder-Only Models (e.g., GPT):

Structure: These models use only the decoder stack.
Information Processing: GPT is designed specifically for next-word prediction. It processes text autoregressively, taking a sequence and predicting the most likely subsequent token. While it also uses attention mechanisms to build context, its architecture is optimized to generate new text based on previous inputs (15:42-16:03).
Key Comparison:

BERT excels at NLU (Natural Language Understanding) because it sees the entire input at once, allowing words to attend to both preceding and following tokens simultaneously.
GPT excels at NLG (Natural Language Generation), building up a response one token at a time by leveraging previously generated tokens to inform the next one (1:10-1:33).$$);
