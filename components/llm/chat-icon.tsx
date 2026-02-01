"use client";

import { MessageCircleCode } from "lucide-react";
import { useState } from "react";
import ChatModal from "../modals/chat-modal";
import { cn } from "@/lib/utils";

export default function ChatIcon() {
  const [showChat, setShowChat] = useState(false);

  function toggleChat() {
    setShowChat(!showChat);
  }

  return (
    <div>
      <button
        className={cn(
          "fixed bottom-14 right-8 z-50 group",
          "flex h-14 w-14 items-center justify-center rounded-full",
          "bg-background/80 backdrop-blur-md border shadow-sm",
          "text-muted-foreground",
          "transition-all duration-300 ease-in-out",
          "hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:scale-105",
          showChat && "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
        )}
        onClick={toggleChat}
        aria-label="Toggle Chat"
      >
        <MessageCircleCode className="h-6 w-6" />
      </button>
      <ChatModal showChat={showChat} setShowChat={setShowChat} />
    </div>
  );
}
