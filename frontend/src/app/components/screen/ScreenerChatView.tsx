"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { ArrowDown, PanelRightOpen, Plus } from "lucide-react";
import { UserMessage } from "@/app/components/assistant/UserMessage";
import { ScreenerAssistantMessage } from "./ScreenerAssistantMessage";
import { ScreenerChatInput } from "./ScreenerChatInput";
import { ScreeningResultsPanel } from "./ScreeningResultsPanel";
import type { ScreenerMessage } from "./chatTypes";
import type { ScreeningResult } from "@/lib/screenerTypes";
import { shouldShowMessageOptions } from "@/lib/parseMessageOptions";

interface Props {
  messages: ScreenerMessage[];
  isResponseLoading: boolean;
  handleChat: (message: ScreenerMessage, csvContent?: string | null) => void;
  cancel: () => void;
  screeningResult: ScreeningResult | null;
  onNewChat: () => void;
  startupId?: string;
}

export function ScreenerChatView({
  messages,
  isResponseLoading,
  handleChat,
  cancel,
  screeningResult,
  onNewChat,
  startupId,
}: Props) {
  const [resultsOpen, setResultsOpen] = useState(!!screeningResult);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [inputHeight, setInputHeight] = useState(120);
  const [minHeight, setMinHeight] = useState("0px");
  const messagesVisible = true;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screeningResult) setResultsOpen(true);
  }, [screeningResult]);

  useEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInputHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 120);
    };
    container.addEventListener("scroll", onScroll);
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [messages]);

  useEffect(() => {
    if (!isResponseLoading) return;
    const container = messagesContainerRef.current;
    const userEl = latestUserMessageRef.current;
    if (!container || !userEl) return;
    const updateMinHeight = () => {
      const h = container.clientHeight - userEl.offsetHeight - 48;
      setMinHeight(`${Math.max(h, 200)}px`);
    };
    updateMinHeight();
    const ro = new ResizeObserver(updateMinHeight);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isResponseLoading, messages.length]);

  useEffect(() => {
    if (isResponseLoading) {
      latestUserMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      scrollToBottom();
    }
  }, [messages.length, isResponseLoading, scrollToBottom]);

  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="h-full w-full flex relative">
      <div className="flex flex-col h-full flex-1 relative min-w-0">
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
          {screeningResult && (
            <button
              type="button"
              onClick={() => setResultsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              {resultsOpen ? "Hide" : "View"} results
            </button>
          )}
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md border border-gray-200"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>

        <div
          ref={messagesContainerRef}
          className="flex-1 w-full overflow-y-auto"
          style={{ scrollbarGutter: "stable both-edges" }}
        >
          <div className="w-full max-w-4xl mx-auto pb-32 px-6 md:px-8 pt-4 md:pt-6 min-h-full flex flex-col relative">
            <div
              className="space-y-6 transition-opacity duration-150"
              style={{ opacity: messagesVisible ? 1 : 0 }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  ref={i === lastUserIndex ? latestUserMessageRef : null}
                >
                  {msg.role === "user" ? (
                    <UserMessage
                      content={msg.content}
                      files={msg.files}
                    />
                  ) : (
                    <ScreenerAssistantMessage
                      content={msg.content}
                      events={msg.events}
                      isStreaming={
                        i === messages.length - 1 && isResponseLoading
                      }
                      isError={!!msg.error}
                      minHeight={
                        i === lastAssistantIndex ? minHeight : "0px"
                      }
                      showOptionChips={shouldShowMessageOptions(
                        i,
                        messages,
                        isResponseLoading,
                      )}
                      onOptionSelect={(value) => {
                        handleChat({ role: "user", content: value });
                      }}
                    />
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {showScrollButton && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-19"
            style={{ bottom: inputHeight + 12 }}
          >
            <button
              type="button"
              onClick={scrollToBottom}
              className="p-2 rounded-full bg-white/70 backdrop-blur-xs shadow-lg cursor-pointer border border-gray-300"
            >
              <ArrowDown className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        )}

        <div
          ref={chatInputRef}
          className="absolute bottom-0 left-0 right-0 w-full z-30"
        >
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
            <div className="w-full rounded-t-[20px] bg-white">
              <ScreenerChatInput
                onSubmit={handleChat}
                onCancel={cancel}
                isLoading={isResponseLoading}
              />
              <div className="py-3 text-center">
                <p className="text-xs text-gray-500">
                  Screening aids human review only — not a sanctions
                  determination.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {resultsOpen && screeningResult && (
        <ScreeningResultsPanel
          data={screeningResult}
          onClose={() => setResultsOpen(false)}
          startupId={startupId}
        />
      )}
    </div>
  );
}
