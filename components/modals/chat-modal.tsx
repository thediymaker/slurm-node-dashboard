"use client";
import { ChatList } from "@/components/llm/chat-list";
import ChatScrollAnchor from "@/components/llm/chat-scroll-anchor";
import { useEnterSubmit } from "@/lib/use-enter-submit";
import TextareaAutosize from "react-textarea-autosize";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ArrowUp, PlusIcon } from "lucide-react";
import { z } from "zod";
import { AI } from "@/actions/actions";
import { useActions, useUIState } from "ai/rsc";
import { BotMessage, UserMessage } from "@/components/llm/message";
import { Dialog, DialogContent } from "../ui/dialog";
import { useEffect, useRef } from "react";
import { Separator } from "../ui/separator";

const chatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
});

export type ChatInput = z.infer<typeof chatSchema>;

export default function ChatModal({ showChat, setShowChat }: any) {
  const form = useForm<ChatInput>();
  const { formRef, onKeyDown } = useEnterSubmit();
  const [messages, setMessages] = useUIState<typeof AI>();
  const { sendMessage, clearHistory } = useActions<typeof AI>();

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const onSubmit: SubmitHandler<ChatInput> = async (data) => {
    const value = data.message.trim();
    form.setValue("message", "");
    formRef.current?.reset();
    if (!value) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now(),
        role: "user",
        display: <UserMessage>{value}</UserMessage>,
      },
    ]);
    try {
      const responseMessage = await sendMessage(value);
      setMessages((currentMessages) => [...currentMessages, responseMessage]);
    } catch (error) {
      console.error(error);
    }
  };

  const clearChatHistory = async () => {
    await clearHistory();
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        display: (
          <BotMessage>
            Welcome! I can assist you with Slurm related questions, as well as
            give you information about running jobs, or details about compute
            nodes. Please let me know if there is anything I may assist you
            with.
          </BotMessage>
        ),
      },
    ]);
  };

  useEffect(() => {
    // Set initial message when the component mounts
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        display: (
          <BotMessage>
            Welcome! I can assist you with Slurm related questions, as well as
            give you information about running jobs, or details about compute
            nodes. Please let me know if there is anything I may assist you
            with.
          </BotMessage>
        ),
      },
    ]);
  }, [setMessages]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {showChat && (
        <Dialog open={showChat} onOpenChange={setShowChat}>
          <DialogContent className="border-2 border-black shadow-xl w-[1200px] max-w-[80%] h-[1200px] max-h-[80%] flex flex-col p-0">
            <div className="p-3 px-5 mx-5">
              <h1 className="text-2xl mb-2 font-extralight">Slurm Chat</h1>
              <Separator />
            </div>
            <div
              ref={chatContainerRef}
              className="flex-grow overflow-y-auto scrollbar-none mx-auto"
            >
              <ChatList messages={messages} />
              <ChatScrollAnchor />
            </div>
            <div className="bg-gradient-to-b from-background/0 to-black/60 to-50% pt-5">
              <div className="mx-auto sm:max-w-2xl sm:px-4">
                <div className="flex gap-2 items-center justify-center">
                  <div
                    className="text-xs border rounded-lg p-2 mb-2 w-[33%] text-center cursor-pointer hover:bg-blue-500 transition-transform ease-in-out duration-200 transform hover:scale-105 bg-background border-black"
                    onClick={() => {
                      form.setValue("message", "Show me details about c001");
                    }}
                  >
                    Show me details about c001
                  </div>
                  <div
                    className="text-xs border rounded-lg p-2 mb-2 w-[33%] text-center cursor-pointer hover:bg-blue-500 transition-transform ease-in-out duration-200 transform hover:scale-105 bg-background border-black"
                    onClick={() => {
                      form.setValue("message", "Show me details for job 1234");
                    }}
                  >
                    Show me details for job 1234
                  </div>
                  <div
                    className="text-xs border rounded-lg p-2 mb-2 w-[33%] text-center cursor-pointer hover:bg-blue-500 transition-transform ease-in-out duration-200 transform hover:scale-105 bg-background border-black"
                    onClick={() => {
                      form.setValue(
                        "message",
                        "Give me a basic sbatch example"
                      );
                    }}
                  >
                    Give me a basic sbatch example
                  </div>
                </div>
                <div className="px-3 flex justify-center flex-col py-2 space-y-4 border-black shadow-lg bg-card sm:rounded-xl sm:border md:py-4 mb-5">
                  <form
                    ref={formRef}
                    onSubmit={form.handleSubmit(onSubmit)}
                    action=""
                  >
                    <div className="relative flex flex-col w-full overflow-hidden max-h-60 grow bg-background sm:rounded-md sm:border border-black">
                      <TextareaAutosize
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        placeholder="Send a message."
                        className="min-h-[60px] w-full resize-none bg-transparent pl-4 pr-16 py-[1.3rem] focus-within:outline-none sm:text-sm"
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        rows={1}
                        {...form.register("message")}
                      />
                      <div className="absolute right-0 top-3 sm:right-4 bg-background">
                        <Button
                          type="submit"
                          size="icon"
                          disabled={form.watch("message") === ""}
                          className="text-sm"
                        >
                          <ArrowUp className="h-5 w-5" />
                          <span className="sr-only">Send Message</span>
                        </Button>
                      </div>
                    </div>
                  </form>
                  <Button
                    variant={"outline"}
                    size={"lg"}
                    className="p-4 mt-4 rounded-md bg-background border-black"
                    onClick={(e) => {
                      e.preventDefault();
                      clearChatHistory();
                    }}
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span className="">New Chat</span>
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}