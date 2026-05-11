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
import { getToolTurnUI } from "@/lib/tool-turn-ui";
import type { FollowUpContextInput } from "@/lib/follow-up-context";

type ToolTurnUIHint = NonNullable<ReturnType<typeof getToolTurnUI>>;

interface MessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onSelectFollowUp?: (question: string) => void;
  onRequestFeedback?: (rating?: number) => void;
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getToolNamesFromMessage(message: Message) {
  return message.parts.reduce<string[]>((names, part) => {
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
}

function getToolTurnUIs(message: Message) {
  return message.parts.reduce<ToolTurnUIHint[]>((hints, part) => {
    if (
      !part.type.startsWith("tool-") ||
      !("output" in part) ||
      !isObjectRecord(part.output)
    ) {
      return hints;
    }

    const toolUi = getToolTurnUI(part.output);
    if (!toolUi) {
      return hints;
    }

    hints.push(toolUi);

    return hints;
  }, []);
}

function joinText(values: Array<string | undefined>) {
  const uniqueValues = Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );

  return uniqueValues.length > 0 ? uniqueValues.join("\n\n") : undefined;
}

function buildFollowUpContext(
  userMessage: Message,
  assistantMessage: Message
): FollowUpContextInput {
  const toolTurnUIs = getToolTurnUIs(assistantMessage);
  const toolNames = Array.from(
    new Set([
      ...getToolNamesFromMessage(assistantMessage),
      ...toolTurnUIs
        .map((hint) => hint.toolId || hint.toolName)
        .filter((name): name is string => Boolean(name)),
    ])
  );
  const toolContext = joinText(
    toolTurnUIs.map((hint) => hint.followUpContext)
  );
  const toolGuidance = joinText(
    toolTurnUIs.map((hint) => hint.promptGuidance)
  );

  return {
    userMessage: getTextFromParts(userMessage.parts),
    assistantText: stripMarkdownTables(getTextFromParts(assistantMessage.parts)).trim(),
    toolContext,
    toolGuidance,
    toolNames,
    hasToolOutput: toolTurnUIs.length > 0 || toolNames.length > 0,
  };
}

export function ChatList({
  messages,
  isLoading,
  onSelectFollowUp,
  onRequestFeedback,
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
        // Composite key prevents React duplicate-key errors when useChat
        // temporarily produces two messages with the same id mid-stream.
        const key = `${message.id}-${index}`;
        
        // Find the last user message for follow-up context
        const lastUserMessage = [...messages].slice(0, index + 1).reverse().find(m => m.role === "user");

        if (message.role === "user") {
          const content = getTextFromParts(message.parts);
          return <UserMessage key={key}>{content}</UserMessage>;
        }

        // Assistant message
        const followUpContext =
          lastUserMessage && message.role === "assistant"
            ? buildFollowUpContext(lastUserMessage, message)
            : null;

        return (
          <div key={key} className="pb-4">
            {message.parts.map((part, partIndex) => {
              if (part.type === "text") {
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
                  onRequestFeedback={onRequestFeedback}
                />
              </div>
            )}

            {isLast && !isLoading && lastUserMessage && (
              <div className="mt-2 ml-10">
                <FollowUpGenerator
                  context={followUpContext}
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
