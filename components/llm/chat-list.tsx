"use client";
import { useEffect, useRef } from "react";
import type { UIState } from "@/actions/actions";

interface MessagesProps {
  messages: UIState;
}

export function ChatList({ messages }: MessagesProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  if (!messages || !messages.length) {
    return null;
  } else {
    return (
      <div
        ref={chatContainerRef}
        className="relative mx-auto max-w-[90%] h-full overflow-y-auto scrollbar-none"
      >
        {messages.map((message, index) => (
          <div key={message.id} className="pb-4">
            {message.display}
          </div>
        ))}
      </div>
    );
  }
}
