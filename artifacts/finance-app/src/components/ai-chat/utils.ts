import { useState, useEffect } from "react";
import { CHAT_STORAGE_KEY, CHAT_IDLE_TIMEOUT } from "./constants";
import type { ChatMessage, PersistedChatState } from "./types";

export function loadPersistedChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const state: PersistedChatState = JSON.parse(raw);
    if (Date.now() - state.lastActivityAt > CHAT_IDLE_TIMEOUT) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return [];
    }
    return state.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp || state.lastActivityAt,
    }));
  } catch {
    return [];
  }
}

export function persistChat(messages: ChatMessage[]) {
  try {
    if (messages.length === 0) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    const state: PersistedChatState = {
      messages,
      lastActivityAt: Date.now(),
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearPersistedChat() {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getIsMobileTouch() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function useIsMobileTouch() {
  const [isMobile] = useState(getIsMobileTouch);
  return isMobile;
}

export function useVisualViewportHeight() {
  const [vpHeight, setVpHeight] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.visualViewport?.height ?? null;
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVpHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return vpHeight;
}
