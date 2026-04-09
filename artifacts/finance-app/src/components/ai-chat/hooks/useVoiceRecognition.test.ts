import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceRecognition } from "./useVoiceRecognition";

let lastInstance: any = null;

class MockSpeechRecognition {
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: any = null;
  onerror: any = null;
  onend: any = null;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastInstance = this;
  }
}

describe("useVoiceRecognition", () => {
  beforeEach(() => {
    lastInstance = null;
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;
  });

  it("reports speechSupported as false when SpeechRecognition unavailable", () => {
    const { result } = renderHook(() =>
      useVoiceRecognition(vi.fn()),
    );
    expect(result.current.speechSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it("startListening is a no-op when not supported", () => {
    const { result } = renderHook(() =>
      useVoiceRecognition(vi.fn()),
    );
    act(() => {
      result.current.startListening();
    });
    expect(result.current.isListening).toBe(false);
  });

  it("stopListening is a no-op when not supported", () => {
    const { result } = renderHook(() =>
      useVoiceRecognition(vi.fn()),
    );
    act(() => {
      result.current.stopListening();
    });
    expect(result.current.isListening).toBe(false);
  });

  it("reports speechSupported as true when SpeechRecognition is available", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() =>
      useVoiceRecognition(vi.fn()),
    );
    expect(result.current.speechSupported).toBe(true);
  });

  it("starts listening and sets isListening to true", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceRecognition(onTranscript));
    act(() => {
      result.current.startListening();
    });
    expect(result.current.isListening).toBe(true);
    expect(lastInstance.start).toHaveBeenCalled();
    expect(lastInstance.lang).toBe("en-US");
  });

  it("calls onTranscript when speech result is received", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceRecognition(onTranscript));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      instance.onresult({
        results: [[{ transcript: "hello world" }]],
      });
    });
    expect(onTranscript).toHaveBeenCalledWith("hello world");
  });

  it("handles onend event and resets isListening", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    expect(result.current.isListening).toBe(true);
    const instance = lastInstance;
    act(() => {
      instance.onend();
    });
    expect(result.current.isListening).toBe(false);
  });

  it("handles onerror event for not-allowed error", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      instance.onerror({ error: "not-allowed" });
    });
    expect(result.current.isListening).toBe(false);
  });

  it("handles onerror event for generic errors", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      instance.onerror({ error: "network" });
    });
    expect(result.current.isListening).toBe(false);
  });

  it("handles start throwing an error gracefully", () => {
    class FailingSpeechRecognition extends MockSpeechRecognition {
      start = vi.fn().mockImplementation(() => { throw new Error("fail"); });
    }
    (window as any).SpeechRecognition = FailingSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    expect(result.current.isListening).toBe(false);
  });

  it("stopListening calls stop on the recognition instance", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      result.current.stopListening();
    });
    expect(instance.stop).toHaveBeenCalled();
  });

  it("stopListening with forceAbort calls abort", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      result.current.stopListening(true);
    });
    expect(instance.abort).toHaveBeenCalled();
  });

  it("works with webkitSpeechRecognition", () => {
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    expect(result.current.speechSupported).toBe(true);
  });

  it("ignores aborted error in onerror handler", () => {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition(vi.fn()));
    act(() => {
      result.current.startListening();
    });
    const instance = lastInstance;
    act(() => {
      instance.onerror({ error: "aborted" });
    });
    expect(result.current.isListening).toBe(false);
  });
});
