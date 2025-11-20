"use client";
import { MessageCircleCode } from "lucide-react";
import { useState } from "react";
import ChatModal from "../modals/chat-modal";

export default function ChatIcon() {
  const [showChat, setShowChat] = useState(false);

  function toggleChat() {
    setShowChat(!showChat);
  }

  return (
    <div>
      <button
        className="fixed bottom-20 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all duration-300 ease-in-out hover:scale-105"
        onClick={toggleChat}
        aria-label="Toggle Chat"
      >
        <MessageCircleCode className="h-7 w-7" />
      </button>
      <ChatModal showChat={showChat} setShowChat={setShowChat} />
    </div>
  );
}
