"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamChatMessage } from "@/app/lib/screenerApi";
import { getStartupChat, saveStartupChat } from "@/lib/startupsApi";
import { createAuditLog } from "@/app/lib/auditLogApi";
import type {
  ScreeningProgressEvent,
  ScreeningResult,
} from "@/lib/screenerTypes";
import type { AssistantEvent, ScreenerMessage } from "@/app/components/screen/chatTypes";

interface UseScreenerChatOptions {
  startupId?: string;
  onDocumentCreated?: (document: {
    id: string;
    startupId: string;
    kind: "ic_memo";
    title: string;
  }) => void;
}

export function useScreenerChat({
  startupId,
  onDocumentCreated,
}: UseScreenerChatOptions = {}) {
  const [messages, setMessages] = useState<ScreenerMessage[]>([]);
  const [isResponseLoading, setIsResponseLoading] = useState(false);
  const [chatHydrated, setChatHydrated] = useState(!startupId);
  const [screeningResult, setScreeningResult] =
    useState<ScreeningResult | null>(null);
  const [isScreeningActive, setIsScreeningActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const csvRef = useRef<string | null>(null);
  const screeningResultRef = useRef<ScreeningResult | null>(null);
  const messagesRef = useRef<ScreenerMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    screeningResultRef.current = screeningResult;
  }, [screeningResult]);

  useEffect(() => {
    if (!startupId) {
      setChatHydrated(true);
      return;
    }
    setChatHydrated(false);
    getStartupChat(startupId)
      .then(({ messages: stored }) => {
        if (stored.length > 0) {
          setMessages(stored as ScreenerMessage[]);
        }
      })
      .catch(() => {})
      .finally(() => setChatHydrated(true));
  }, [startupId]);

  const persistMessages = useCallback(
    (next: ScreenerMessage[]) => {
      if (!startupId) return;
      saveStartupChat(startupId, next).catch(() => {});
    },
    [startupId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsResponseLoading(false);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== "assistant") return prev;
      const events = (last.events ?? []).map((e) =>
        "isStreaming" in e ? { ...e, isStreaming: false } : e,
      );
      return [...prev.slice(0, -1), { ...last, events }];
    });
  }, []);

  const handleChat = useCallback(
    async (message: ScreenerMessage, csvContent?: string | null) => {
      if (csvContent) csvRef.current = csvContent;

      const userMsg: ScreenerMessage = {
        role: "user",
        content: message.content,
        files: message.files,
      };

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content: "",
          events: [{ type: "thinking", isStreaming: true }],
        },
      ]);
      setIsResponseLoading(true);
      setIsScreeningActive(false);

      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content:
          m.role === "user" && m.files?.length
            ? `${m.content}\n\n[Attached: ${m.files.map((f) => f.filename).join(", ")}]`
            : m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      const toolCallEvents: AssistantEvent[] = [];
      const screeningProgressEvents: ScreeningProgressEvent[] = [];
      let accumulatedText = "";
      let latestScreeningResult: ScreeningResult | null = null;

      const pushAssistantEvents = (streaming: boolean) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role !== "assistant") return prev;
          const events: AssistantEvent[] = [...toolCallEvents];
          if (screeningProgressEvents.length > 0) {
            events.push({
              type: "screening_progress",
              progressHistory: [...screeningProgressEvents],
              isStreaming: streaming,
            });
          }
          events.push({ type: "thinking", isStreaming: streaming });
          updated[updated.length - 1] = { ...last, events };
          return updated;
        });
      };

      try {
        await streamChatMessage({
          messages: apiMessages,
          screeningResult: screeningResultRef.current,
          csvContent: csvContent ?? csvRef.current,
          startupId: startupId ?? null,
          signal: controller.signal,

          onDocumentCreated: (document) => {
            toolCallEvents.push({ type: "document_created", document });
            onDocumentCreated?.(document);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role !== "assistant") return prev;
              updated[updated.length - 1] = {
                ...last,
                events: [
                  ...toolCallEvents,
                  { type: "thinking", isStreaming: true },
                ],
              };
              return updated;
            });
          },

          onToolCall: (name: string) => {
            toolCallEvents.push({ type: "tool_call_start", name, isStreaming: false });
            if (name === "screen_cap_table") {
              screeningProgressEvents.length = 0;
              setIsScreeningActive(true);
            }
            pushAssistantEvents(true);
          },

          onScreeningProgress: (event) => {
            screeningProgressEvents.push(event);
            pushAssistantEvents(true);
          },

          onToken: (text: string) => {
            accumulatedText += text;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role !== "assistant") return prev;
              updated[updated.length - 1] = {
                ...last,
                content: accumulatedText,
                events: [
                  ...toolCallEvents,
                  {
                    type: "content",
                    text: accumulatedText,
                    isStreaming: true,
                  },
                ],
              };
              return updated;
            });
          },

          onScreeningResult: (result: ScreeningResult) => {
            latestScreeningResult = result;
            setScreeningResult(result);
            screeningResultRef.current = result;
            setIsScreeningActive(false);
            csvRef.current = null;
            if (startupId) {
              createAuditLog({
                startupId,
                eventType: "screening_completed",
                details: {
                  totalEntities: result.totalEntities,
                  flaggedCount: result.flaggedCount,
                  reviewCount: result.reviewCount,
                  clearCount: result.clearCount,
                },
              }).catch(() => {});
            }
          },
        });

        const finalEvents: AssistantEvent[] = [...toolCallEvents];
        if (screeningProgressEvents.length > 0) {
          finalEvents.push({
            type: "screening_progress",
            progressHistory: [...screeningProgressEvents],
            isStreaming: false,
          });
        }
        finalEvents.push({
          type: "content",
          text: accumulatedText,
          isStreaming: false,
        });

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulatedText,
            events: finalEvents,
          };
          persistMessages(updated);
          return updated;
        });

        void latestScreeningResult;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        const msg = err instanceof Error ? err.message : "Request failed";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "",
            error: msg,
            events: [{ type: "content", text: msg }],
          };
          persistMessages(updated);
          return updated;
        });
      } finally {
        setIsResponseLoading(false);
        setIsScreeningActive(false);
        abortRef.current = null;
      }

      return null;
    },
    [startupId, persistMessages, onDocumentCreated],
  );

  const resetChat = useCallback(() => {
    cancel();
    setMessages([]);
    setScreeningResult(null);
    csvRef.current = null;
    if (startupId) {
      saveStartupChat(startupId, []).catch(() => {});
    }
  }, [cancel, startupId]);

  return {
    messages,
    isResponseLoading,
    chatHydrated,
    handleChat,
    cancel,
    screeningResult,
    setScreeningResult,
    isScreeningActive,
    resetChat,
  };
}
