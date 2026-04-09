import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast, toast, reducer } from "./use-toast";

describe("use-toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("reducer", () => {
    it("ADD_TOAST adds a toast", () => {
      const state = { toasts: [] };
      const newState = reducer(state, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Hello", open: true, onOpenChange: () => {} },
      });
      expect(newState.toasts.length).toBe(1);
      expect(newState.toasts[0].title).toBe("Hello");
    });

    it("ADD_TOAST respects limit of 1", () => {
      const state = {
        toasts: [{ id: "1", title: "First", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "ADD_TOAST",
        toast: { id: "2", title: "Second", open: true, onOpenChange: () => {} },
      });
      expect(newState.toasts.length).toBe(1);
      expect(newState.toasts[0].title).toBe("Second");
    });

    it("UPDATE_TOAST updates a toast", () => {
      const state = {
        toasts: [{ id: "1", title: "Original", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated" },
      });
      expect(newState.toasts[0].title).toBe("Updated");
    });

    it("DISMISS_TOAST sets open to false", () => {
      const state = {
        toasts: [{ id: "1", title: "Test", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "DISMISS_TOAST",
        toastId: "1",
      });
      expect(newState.toasts[0].open).toBe(false);
    });

    it("DISMISS_TOAST without ID dismisses all", () => {
      const state = {
        toasts: [{ id: "1", title: "Test", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "DISMISS_TOAST",
      });
      expect(newState.toasts[0].open).toBe(false);
    });

    it("REMOVE_TOAST removes a toast", () => {
      const state = {
        toasts: [{ id: "1", title: "Test", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "REMOVE_TOAST",
        toastId: "1",
      });
      expect(newState.toasts.length).toBe(0);
    });

    it("REMOVE_TOAST without ID clears all", () => {
      const state = {
        toasts: [{ id: "1", title: "Test", open: true, onOpenChange: () => {} }],
      };
      const newState = reducer(state, {
        type: "REMOVE_TOAST",
      });
      expect(newState.toasts.length).toBe(0);
    });
  });

  describe("toast function", () => {
    it("returns an id, dismiss, and update functions", () => {
      const result = toast({ title: "Test" });
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("dismiss");
      expect(result).toHaveProperty("update");
    });
  });

  describe("useToast hook", () => {
    it("returns toast function and toasts array", () => {
      const { result } = renderHook(() => useToast());
      expect(result.current.toast).toBeDefined();
      expect(result.current.toasts).toBeDefined();
      expect(result.current.dismiss).toBeDefined();
    });

    it("can add a toast via hook", () => {
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.toast({ title: "Hook toast" });
      });
      expect(result.current.toasts.length).toBe(1);
      expect(result.current.toasts[0].title).toBe("Hook toast");
    });

    it("can dismiss a toast", () => {
      const { result } = renderHook(() => useToast());
      let toastId: string;
      act(() => {
        const t = result.current.toast({ title: "Dismissable" });
        toastId = t.id;
      });
      act(() => {
        result.current.dismiss(toastId!);
      });
      expect(result.current.toasts[0]?.open).toBe(false);
    });
  });
});
