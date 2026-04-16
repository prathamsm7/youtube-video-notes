"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  PlaySquare as Youtube,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  PlayCircle,
  Archive,
  ArrowRight,
  LogOut,
  ExternalLink,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function YouTubeChatPage() {
  const { user, apiFetch, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notionConnected, setNotionConnected] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState<string | null>(null);

  type JobStatus = "idle" | "extracting" | "chunking" | "embedding" | "processing" | "completed" | "failed";
  const [jobPhase, setJobPhase] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const checkNotionStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notion/status");
      const data = await res.json();
      setNotionConnected(data.connected);
    } catch {
      setNotionConnected(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user) {
      checkNotionStatus();
    }
  }, [user, checkNotionStatus]);

  const handleSaveToNotion = async (msg: Message) => {
    if (!videoId) return;
    setSavingToNotion(msg.id);
    try {
      // Find the question that preceded this answer
      const msgIndex = messages.findIndex(m => m.id === msg.id);
      const question = msgIndex > 0 ? messages[msgIndex - 1].content : "YouTube Video Summary";

      const res = await apiFetch("/api/notion/save-chat", {
        method: "POST",
        body: JSON.stringify({ 
          videoId: videoId,
          videoTitle: videoTitle || "Untitled Video",
          question: question,
          answer: msg.content 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Saved to Notion!");
      } else {
        throw new Error(data.detail || "Failed to save");
      }
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : "An unknown error occurred";
      alert(msgText);
    } finally {
      setSavingToNotion(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleProcessVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsProcessing(true);
    setJobPhase("extracting");
    setError(null);

    try {
      const res = await apiFetch("/api/ai/process", {
        method: "POST",
        body: JSON.stringify({ youtube_url: url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to process video");
      }

      setVideoId(data.video_id);
      setVideoTitle(data.title);
      
      if (data.status === "success") {
        setJobPhase("completed");
        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "I've successfully transcribed and analyzed the video! What would you like to know about it?",
          },
        ]);
        setIsProcessing(false);
      } else {
        setJobPhase("extracting");
      }
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msgText);
      setJobPhase("failed");
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!videoId || jobPhase === "completed" || jobPhase === "failed" || jobPhase === "idle") return;

      try {
        const res = await apiFetch(`/api/ai/status/${videoId}`);
        if (!res.ok) return;

        const data = await res.json();
        
        if (data.status) {
          setJobPhase(data.status as JobStatus);
          
          if (data.total_chunks) {
            setProgress({ processed: data.processed_chunks || 0, total: data.total_chunks });
          }

          if (data.status === "completed") {
            setIsProcessing(false);
            setMessages([
              {
                id: Date.now().toString(),
                role: "assistant",
                content: "I've successfully transcribed and analyzed the video! What would you like to know about it?",
              },
            ]);
            clearInterval(interval);
          } else if (data.status === "failed") {
            setIsProcessing(false);
            setError(`Failed during ${jobPhase}: ${data.error || "Unknown error"}`);
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error("Failed to poll status", error);
      }
    };

    if (jobPhase !== "idle" && jobPhase !== "completed" && jobPhase !== "failed" && videoId) {
      interval = setInterval(checkStatus, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId, jobPhase, apiFetch]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !videoId) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ]);
    setIsTyping(true);

    try {
      const res = await apiFetch("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: userMessage, video_id: videoId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to get an answer.");
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: data.answer },
      ]);
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : "An unknown error occurred";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `**Error:** ${msgText}`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/50 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              YT-Chat AI
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {notionConnected ? (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Notion Synced
              </span>
            ) : (
              <button 
                onClick={() => router.push("/notion-connect")}
                className="text-xs px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                Connect Notion <ExternalLink className="w-3 h-3" />
              </button>
            )}
            
            <button 
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-24 md:pt-32 px-4 max-w-5xl mx-auto min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {jobPhase === "idle" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                <span>Powered by Gemini 2.0</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
                Chat with any <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500">
                  YouTube Video
                </span>
              </h1>
              
              <p className="text-neutral-400 text-lg md:text-xl leading-relaxed">
                Paste a YouTube link below. We will extract the transcript, index it, and let you ask deep semantic questions about the content.
              </p>

              <form onSubmit={handleProcessVideo} className="w-full relative mt-8 group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-500 to-purple-600 opacity-20 group-hover:opacity-40 blur transition duration-500" />
                <div className="relative flex items-center bg-neutral-900 border border-white/10 rounded-2xl p-2 shadow-2xl">
                  <div className="pl-4 pr-2 text-neutral-500">
                    <PlayCircle className="w-6 h-6" />
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-neutral-600 px-2 py-3 text-lg"
                    disabled={isProcessing}
                  />
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="bg-white text-black px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        Analyze <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <p className="mt-4 text-red-400 text-sm text-left px-4">
                    {error}
                  </p>
                )}
              </form>

              <div className="flex items-center gap-8 text-neutral-500 text-sm font-medium mt-12 justify-center">
                <span className="flex items-center gap-2"><Archive className="w-4 h-4" /> Saves to Notion</span>
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Smart RAG</span>
                <span className="flex items-center gap-2"><Youtube className="w-4 h-4" /> Auto-Captions</span>
              </div>
            </motion.div>
          ) : jobPhase !== "completed" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full space-y-10"
            >
               <div className="relative flex items-center justify-center">
                 <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
                 <div className="w-24 h-24 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin z-10" />
                 <Loader2 className="w-8 h-8 text-white absolute animate-pulse z-10" />
               </div>

               <div className="space-y-3">
                 <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                   {jobPhase === "extracting" && "Extracting Transcript..."}
                   {jobPhase === "chunking" && "Analyzing & Chunking..."}
                   {(jobPhase === "embedding" || jobPhase === "processing") && "Generating AI Embeddings..."}
                   {jobPhase === "failed" && "Processing Paused"}
                 </h2>
                 <p className="text-neutral-500 font-medium max-w-md mx-auto">
                   {jobPhase === "extracting" && "Connecting to YouTube directly. This is super fast."}
                   {jobPhase === "chunking" && "Grouping text organically by natural pauses and sentences."}
                   {(jobPhase === "embedding" || jobPhase === "processing") && "Using Gemini 001 to convert text into vector embeddings."}
                 </p>
               </div>
               
               {(jobPhase === "embedding" || jobPhase === "processing") && progress.total > 0 && (
                 <div className="w-full space-y-4 max-w-lg">
                   <div className="h-4 bg-neutral-900 rounded-full overflow-hidden border border-white/10 w-full relative">
                     <motion.div 
                       className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-purple-500 to-blue-500"
                       initial={{ width: 0 }}
                       animate={{ width: `${Math.min(100, (progress.processed / progress.total) * 100)}%` }}
                       transition={{ duration: 0.5 }}
                     />
                   </div>
                   <div className="flex justify-between text-neutral-400 text-sm font-medium">
                     <span>Processed {progress.processed} of {progress.total} chunks</span>
                     <span>{((progress.processed / progress.total) * 100).toFixed(0)}%</span>
                   </div>
                 </div>
               )}

               {jobPhase === "failed" && (
                 <div className="space-y-6 pt-4">
                   <p className="text-red-400 bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-xl">
                     {error || "An API failure occurred (likely rate limit)."}
                   </p>
                   <div className="flex gap-4 justify-center">
                     <button onClick={() => { setJobPhase("idle"); setIsProcessing(false); }} className="px-6 py-3 bg-neutral-800 rounded-xl font-medium hover:bg-neutral-700 transition">
                       Cancel
                     </button>
                     <button onClick={() => handleProcessVideo()} className="px-6 py-3 bg-purple-600 rounded-xl font-medium hover:bg-purple-500 transition shadow-lg shadow-purple-500/20">
                       Resume Processing
                     </button>
                   </div>
                 </div>
               )}
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col h-full relative"
            >
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-6 pb-32">
                {messages.map((msg) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${
                      msg.role === "user" 
                      ? "bg-neutral-800 border-neutral-700 text-white" 
                      : "bg-gradient-to-br from-purple-500 to-blue-600 border-purple-500/50 text-white"
                    }`}>
                      {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    
                    <div className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-xl relative group/message ${
                      msg.role === "user"
                      ? "bg-neutral-800 rounded-tr-sm text-neutral-100"
                      : "bg-neutral-900 border border-white/5 rounded-tl-sm text-neutral-300 prose prose-invert prose-p:leading-relaxed prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-white/10 max-w-none"
                    }`}>
                      {msg.role === "user" ? (
                        <p>{msg.content}</p>
                      ) : (
                        <>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                          {notionConnected && (
                            <button
                              onClick={() => handleSaveToNotion(msg)}
                              disabled={savingToNotion === msg.id}
                              className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 border border-white/10 opacity-0 group-hover/message:opacity-100 transition-all hover:bg-white/10 text-neutral-400 hover:text-white flex items-center gap-2"
                              title="Save to Notion"
                            >
                              {savingToNotion === msg.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center border border-purple-500/50 shadow-sm">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-neutral-900 border border-white/5 rounded-2xl rounded-tl-sm px-6 py-5 flex flex-col gap-2">
                       <span className="text-sm font-semibold text-neutral-400">Analyzing transcripts & generating response...</span>
                       <div className="flex gap-1.5 pt-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                       </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Chat Input */}
              <div className="fixed bottom-0 left-0 right-0 p-4 md:px-0 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent">
                <div className="max-w-3xl mx-auto relative group">
                  <div className="absolute -inset-1 rounded-2xl bg-white/5 group-hover:bg-white/10 blur-md transition duration-500 -z-10" />
                  <form onSubmit={handleSendMessage} className="relative flex items-center bg-neutral-900 border border-white/10 rounded-2xl p-2 shadow-2xl">
                    <input
                      type="text"
                      placeholder="Ask anything about the video..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isTyping}
                      className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-neutral-500 px-4 py-3 text-base"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isTyping}
                      className="bg-white text-black p-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                    >
                      <Send className="w-5 h-5 group-hover/btn:scale-110 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </form>
                  <p className="text-center text-xs text-neutral-600 mt-3 font-medium">
                    AI can make mistakes. Check timestamps provided to verify accuracy.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
