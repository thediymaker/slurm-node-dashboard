"use client";
import { useEffect, useRef } from "react";
import { UIMessage as Message, UIToolInvocation } from "ai";
import { UserMessage, BotMessage } from "@/components/llm/message";
import ReactMarkdown from "react-markdown";
import { FollowUpGenerator } from "@/components/llm/follow-up-generator";
import { FollowUpLoading } from "@/components/llm/follow-up-loading";
import { ToolInvocationRenderer } from "@/components/llm/tool-invocation";
import { CodeBlock } from "@/components/llm/code-block";
import { Thinking } from "@/components/llm/thinking";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { MessageActions } from "@/components/llm/message-actions";

interface MessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onSelectFollowUp?: (question: string) => void;
  reload?: () => void;
}

function getTextFromParts(parts: Message["parts"]) {
  return parts.reduce((text, part) => {
    if (part.type === "text") {
      return text + part.text;
    }
    return text;
  }, "");
}

function getContextFromMessage(message: Message): string {
  const textContent = getTextFromParts(message.parts);
  
  // If there's text content, use it
  if (textContent.trim()) {
    return textContent;
  }
  
  // Otherwise, try to summarize tool calls for context
  const toolParts = message.parts.filter(
    (part) => part.type.startsWith("tool-") && 'toolName' in part
  );
  
  if (toolParts.length > 0) {
    const toolNames = toolParts.map((part: any) => part.toolName).join(", ");
    return `Used tools: ${toolNames}`;
  }
  
  return "";
}

export function ChatList({
  messages,
  isLoading,
  onSelectFollowUp,
  reload,
}: MessagesProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  if (!messages || !messages.length) {
    return null;
  }

  return (
    <div
      ref={chatContainerRef}
      className="relative w-full h-full overflow-y-auto scrollbar-none px-4"
    >
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        const previousMessage = index > 0 ? messages[index - 1] : null;
        
        // Find the last user message for follow-up context
        const lastUserMessage = [...messages].slice(0, index + 1).reverse().find(m => m.role === "user");

        if (message.role === "user") {
          const content = getTextFromParts(message.parts);
          return <UserMessage key={message.id}>{content}</UserMessage>;
        }

        // Assistant message
        return (
          <div key={message.id} className="pb-4">
            {message.parts.map((part, partIndex) => {
              if (part.type === "text") {
                // Only render if there is actual text content
                if (!part.text || part.text.trim() === "") return null;
                return (
                  <BotMessage key={`${message.id}-part-${partIndex}`}>
                    <ReactMarkdown
                      components={{
                        pre: ({ children }) => <>{children}</>,
                        code: ({ node, inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || "");
                          if (match) {
                            return (
                              <CodeBlock
                                className={className}
                                {...props}
                              >
                                {children}
                              </CodeBlock>
                            );
                          }
                          return (
                            <code
                              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {part.text}
                    </ReactMarkdown>
                  </BotMessage>
                );
              }
              if (part.type.startsWith("tool-") && 'toolCallId' in part) {
                return (
                  <ToolInvocationRenderer
                    key={part.toolCallId}
                    toolInvocation={part}
                  />
                );
              }
              return null;
            })}

            {!isLoading && (
              <div className="ml-10">
                <MessageActions 
                  message={message} 
                  isLoading={!!isLoading} 
                  isLast={isLast} 
                  reload={reload} 
                />
              </div>
            )}

            {isLast && !isLoading && lastUserMessage && (
              <div className="mt-2 ml-10">
                <FollowUpGenerator
                  userMessage={getTextFromParts(lastUserMessage.parts)}
                  assistantMessage={getContextFromMessage(message)}
                  onSelect={onSelectFollowUp}
                />
              </div>
            )}
            {isLast && isLoading && (
              <div className="mt-2 ml-10">
                <FollowUpLoading />
              </div>
            )}
          </div>
        );
      })}
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && <Thinking />}
    </div>
  );
}
