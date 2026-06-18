import { ChatListProvider } from "@/context/ChatListContext";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh max-h-dvh overflow-hidden">
      <ChatListProvider>{children}</ChatListProvider>
    </div>
  );
}
