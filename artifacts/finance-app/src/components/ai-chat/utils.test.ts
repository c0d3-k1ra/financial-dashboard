import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadPersistedChat, persistChat, clearPersistedChat, genId, getGreeting, getRelativeTime } from "./utils";
import { CHAT_STORAGE_KEY } from "./constants";
import type { ChatMessage } from "./types";

describe("utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadPersistedChat", () => {
    it("returns empty array when nothing stored", () => {
      expect(loadPersistedChat()).toEqual([]);
    });

    it("returns messages from localStorage", () => {
      const msgs: ChatMessage[] = [{ id: "1", type: "user", content: "hi", timestamp: Date.now() }];
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: msgs, lastActivityAt: Date.now() }));
      const loaded = loadPersistedChat();
      expect(loaded.length).toBe(1);
      expect(loaded[0].content).toBe("hi");
    });

    it("clears stale chat older than idle timeout", () => {
      const msgs: ChatMessage[] = [{ id: "1", type: "user", content: "old", timestamp: 0 }];
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: msgs, lastActivityAt: Date.now() - 3600001 }));
      expect(loadPersistedChat()).toEqual([]);
    });

    it("handles malformed JSON gracefully", () => {
      localStorage.setItem(CHAT_STORAGE_KEY, "not-json");
      expect(loadPersistedChat()).toEqual([]);
    });
  });

  describe("persistChat", () => {
    it("stores messages to localStorage", () => {
      const msgs: ChatMessage[] = [{ id: "1", type: "user", content: "hello", timestamp: Date.now() }];
      persistChat(msgs);
      const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)!);
      expect(stored.messages[0].content).toBe("hello");
    });

    it("removes storage when messages array is empty", () => {
      localStorage.setItem(CHAT_STORAGE_KEY, "test");
      persistChat([]);
      expect(localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
    });
  });

  describe("clearPersistedChat", () => {
    it("removes chat from localStorage", () => {
      localStorage.setItem(CHAT_STORAGE_KEY, "data");
      clearPersistedChat();
      expect(localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
    });
  });

  describe("genId", () => {
    it("returns a string", () => {
      expect(typeof genId()).toBe("string");
    });

    it("returns different values on each call", () => {
      const id1 = genId();
      const id2 = genId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("getGreeting", () => {
    it("returns a greeting string", () => {
      const greeting = getGreeting();
      expect(greeting).toMatch(/Good (morning|afternoon|evening)/);
    });

    it("returns Good morning before noon", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 3, 9, 9, 0, 0));
      expect(getGreeting()).toBe("Good morning");
      vi.useRealTimers();
    });

    it("returns Good afternoon between noon and 5pm", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 3, 9, 14, 0, 0));
      expect(getGreeting()).toBe("Good afternoon");
      vi.useRealTimers();
    });

    it("returns Good evening after 5pm", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 3, 9, 19, 0, 0));
      expect(getGreeting()).toBe("Good evening");
      vi.useRealTimers();
    });
  });

  describe("getRelativeTime", () => {
    it("returns 'Just now' for recent timestamps", () => {
      expect(getRelativeTime(Date.now() - 5000)).toBe("Just now");
    });

    it("returns minutes ago", () => {
      expect(getRelativeTime(Date.now() - 120000)).toBe("2m ago");
    });

    it("returns hours ago", () => {
      expect(getRelativeTime(Date.now() - 7200000)).toBe("2h ago");
    });

    it("returns date for old timestamps", () => {
      const old = Date.now() - 172800000;
      const result = getRelativeTime(old);
      expect(result).not.toBe("Just now");
    });
  });
});
