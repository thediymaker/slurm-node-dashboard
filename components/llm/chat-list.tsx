"use client";
import { type ComponentPropsWithoutRef, useEffect, useRef } from "react";
import { UIMessage as Message } from "ai";
import { UserMessage, BotMessage } from "@/components/llm/message";
import ReactMarkdown from "react-markdown";
import { FollowUpGenerator } from "@/components/llm/follow-up-generator";
import { FollowUpLoading } from "@/components/llm/follow-up-loading";
import { ToolInvocationRenderer } from "@/components/llm/tool-invocation";
import { CodeBlock } from "@/components/llm/code-block";
import { Thinking } from "@/components/llm/thinking";
import { MessageActions } from "@/components/llm/message-actions";

interface MessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onSelectFollowUp?: (question: string) => void;
  reload?: () => void;
}

const RESERVATION_TOOL_NAMES = new Set([
  "get_reservation_details",
  "list_reservations",
]);

function getTextFromParts(parts: Message["parts"]) {
  return parts.reduce((text, part) => {
    if (part.type === "text") {
      return text + part.text;
    }
    return text;
  }, "");
}

/**
 * Strip markdown tables from LLM output.
 * Tool cards already display all data, so tables are redundant noise.
 * Matches lines starting with | and header separators like |---|---|
 */
function stripMarkdownTables(text: string): string {
  return text
    .replace(/^(\|.*\|)\s*$/gm, "") // rows: | ... |
    .replace(/\n{3,}/g, "\n\n");     // collapse leftover blank lines
}

function getContextFromMessage(message: Message): string {
  if (hasReservationToolInvocation(message)) {
    return "Reservation details were shown in a tool card. Generate follow-up questions about affected nodes, maintenance impact, time windows, flags, verifying whether jobs are affected, and rescheduling. Do not suggest submitting jobs to the reservation or using --reservation for a maintenance window unless specifically asked about it.";
  }

  const textContent = getTextFromParts(message.parts);
  
  // If there's text content, use it
  if (textContent.trim()) {
    return textContent;
  }
  
  // Otherwise, try to summarize tool calls for context
  const toolNames = message.parts.reduce<string[]>((names, part) => {
    if (
      part.type.startsWith("tool-") &&
      "toolName" in part &&
      typeof part.toolName === "string" &&
      part.toolName.length > 0
    ) {
      names.push(part.toolName);
    }

    return names;
  }, []);

  if (toolNames.length > 0) {
    return `Used tools: ${toolNames}`;
  }
  
  return "";
}

function hasReservationToolInvocation(message: Message) {
  return message.parts.some(
    (part) =>
      part.type.startsWith("tool-") &&
      "toolName" in part &&
      RESERVATION_TOOL_NAMES.has(part.toolName || "")
  );
}

function hasToolInvocation(message: Message) {
  return message.parts.some((part) => part.type.startsWith("tool-"));
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
        // Composite key prevents React duplicate-key errors when useChat
        // temporarily produces two messages with the same id mid-stream.
        const key = `${message.id}-${index}`;
        const suppressTextForReservationTools = hasReservationToolInvocation(message);
        const suppressReservationFollowUpText =
          message.role === "assistant" &&
          !hasToolInvocation(message) &&
          previousMessage?.role === "assistant" &&
          hasReservationToolInvocation(previousMessage);

        if (suppressReservationFollowUpText) {
          return null;
        }
        
        // Find the last user message for follow-up context
        const lastUserMessage = [...messages].slice(0, index + 1).reverse().find(m => m.role === "user");

        if (message.role === "user") {
          const content = getTextFromParts(message.parts);
          return <UserMessage key={key}>{content}</UserMessage>;
        }

        // Assistant message
        return (
          <div key={key} className="pb-4">
            {message.parts.map((part, partIndex) => {
              if (part.type === "text") {
                if (suppressTextForReservationTools) return null;
                // Only render if there is actual text content
                if (!part.text || part.text.trim() === "") return null;
                return (
                  <BotMessage key={`${message.id}-part-${partIndex}`}>
                    <ReactMarkdown
                      components={{
                        pre: ({ children }) => <>{children}</>,
                        code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean; node?: unknown }) => {
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
                      {stripMarkdownTables(part.text)}
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
