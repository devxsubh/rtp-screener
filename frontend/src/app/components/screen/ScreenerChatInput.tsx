"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { ArrowRight, File, Square, X } from "lucide-react";
import type { ScreenerMessage } from "./chatTypes";

export interface ScreenerChatInputHandle {
  attachCsv: (file: File) => void;
}

interface Props {
  onSubmit: (message: ScreenerMessage, csvContent?: string | null) => void;
  onCancel: () => void;
  isLoading: boolean;
  hideCsvAttach?: boolean;
}

export const ScreenerChatInput = forwardRef<ScreenerChatInputHandle, Props>(
  function ScreenerChatInput({ onSubmit, onCancel, isLoading, hideCsvAttach }, ref) {
    const [value, setValue] = useState("");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      attachCsv: (file: File) => setAttachedFile(file),
    }));

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    const handleSubmit = async () => {
      const query = value.trim();
      if ((!query && !attachedFile) || isLoading) return;

      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const file = attachedFile;
      setAttachedFile(null);

      let csvContent: string | null = null;
      if (file) csvContent = await file.text();

      const content =
        query ||
        (file
          ? `Please screen the attached cap table (${file.name}).`
          : "");

      onSubmit(
        {
          role: "user",
          content,
          files: file ? [{ filename: file.name }] : undefined,
        },
        csvContent,
      );
    };

    const handleActionClick = () => {
      if (isLoading) onCancel();
      else void handleSubmit();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    };

    return (
      <div className="w-full">
        <div className="border border-gray-300 rounded-[16px] md:rounded-[20px] bg-white">
          {attachedFile && (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              <div className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs text-white shadow border border-white/20 bg-black backdrop-blur-sm">
                <File className="h-2.5 w-2.5 shrink-0 text-green-400" />
                <span className="max-w-[180px] truncate">
                  {attachedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="rounded-full p-0.5 ml-0.5 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          )}

          <div className="px-4 pt-4">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask about sanctions risk, or attach a cap-table CSV…"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-full resize-none text-sm overflow-hidden border-0 text-base p-0 bg-transparent outline-none placeholder:text-gray-400 leading-6 max-h-48 disabled:opacity-50"
            />
          </div>

          <div className={`flex items-center ${hideCsvAttach ? "justify-end" : "justify-between"} md:p-2.5 p-2`}>
            {!hideCsvAttach && (
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachedFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  aria-label="Attach CSV"
                  className="flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  <File className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleActionClick}
              disabled={!isLoading && !value.trim() && !attachedFile}
              aria-label={isLoading ? "Stop" : "Send"}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {isLoading ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);
