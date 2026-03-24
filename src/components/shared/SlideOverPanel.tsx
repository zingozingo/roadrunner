"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function SlideOverPanel({
  isOpen,
  onClose,
  tabs,
  activeTab,
  onTabChange,
}: SlideOverPanelProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const activeContent = tabs.find((t) => t.id === activeTab)?.content ?? null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[450px] max-w-[90vw] flex-col border-l border-border/30 bg-surface transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header: tabs + close */}
        <div className="flex items-center border-b border-border/20 px-6 pt-4">
          <div className="flex flex-1 gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`pb-3 text-sm font-medium transition-colors ${
                  tab.id === activeTab
                    ? "border-b-2 border-accent text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mb-3 ml-2 shrink-0 text-muted hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l8 8M13 5l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeContent}
        </div>
      </div>
    </>,
    document.body
  );
}
