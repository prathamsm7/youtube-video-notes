"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChatList } from "@/context/ChatListContext";

export default function ChatIndexPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { chats, chatsLoading } = useChatList();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (chatsLoading) return;

    const firstChat = chats[0];
    if (firstChat?.id) {
      router.replace(`/chat/${firstChat.id}`);
    } else {
      router.replace("/");
    }
  }, [authLoading, user, chatsLoading, chats, router]);

  return (
    <div className="h-dvh bg-[#030712] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
    </div>
  );
}
