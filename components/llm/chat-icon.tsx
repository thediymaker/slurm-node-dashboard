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
      <div
        className="fixed bottom-24 sm:bottom-16 right-4 w-[64px] h-[64px] z-50 cursor-pointer hover:scale-110 transition-transform duration-100 ease-in-out"
        onClick={() => {
          toggleChat();
        }}
      >
        <div className="rounded-full bg-background p-4 hover:bg-blue-500 border-2 border-gray shadow-xl flex justify-center">
          <MessageCircleCode className="w-[30px] h-[30px] text-white" />
        </div>
      </div>
      <ChatModal showChat={showChat} setShowChat={setShowChat} />
    </div>
  );
}
