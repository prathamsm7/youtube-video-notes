"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { SourceType } from "@/types/ui";

export type ChatListItem = {
  id: string;
  title: string;
  sourceType: SourceType;
  videoTitle: string | null;
  youtubeId: string | null;
  videoStatus: string | null;
  documentFileName: string | null;
  documentStatus: string | null;
  updatedAt: string;
};

interface ChatListContextType {
  chats: ChatListItem[];
  chatsLoading: boolean;
  refreshChats: () => Promise<void>;
}

const ChatListContext = createContext<ChatListContextType | undefined>(undefined);

export function ChatListProvider({ children }: { children: ReactNode }) {
  const { user, apiFetch } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const refreshChats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // ignore
    }
  }, [apiFetch, user]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setChatsLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (hasLoadedRef.current) return;

    let cancelled = false;
    setChatsLoading(true);

    (async () => {
      try {
        const res = await apiFetch("/api/chats");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setChats(data.chats);
          hasLoadedRef.current = true;
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, apiFetch]);

  return (
    <ChatListContext.Provider value={{ chats, chatsLoading, refreshChats }}>
      {children}
    </ChatListContext.Provider>
  );
}

export function useChatList() {
  const context = useContext(ChatListContext);
  if (context === undefined) {
    throw new Error("useChatList must be used within a ChatListProvider");
  }
  return context;
}
