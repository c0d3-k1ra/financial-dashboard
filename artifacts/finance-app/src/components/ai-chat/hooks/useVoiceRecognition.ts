import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
  ISpeechRecognition,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
  WindowWithSpeech,
} from "../types";

function getSpeechRecognition(): (new () => ISpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceRecognition(
  onTranscript: (transcript: string) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const { toast } = useToast();

  const speechSupported = !!getSpeechRecognition();

  const stopListening = useCallback((forceAbort = false) => {
    if (recognitionRef.current) {
      if (forceAbort) {
        recognitionRef.current.abort();
      } else {
        recognitionRef.current.stop();
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;

    stopListening(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access in your browser settings to use voice input.",
          variant: "destructive",
        });
      } else if (event.error !== "aborted") {
        toast({
          title: "Voice recognition error",
          description: "Something went wrong with voice input. Please try again.",
          variant: "destructive",
        });
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      toast({
        title: "Voice recognition error",
        description: "Could not start voice input. Please try again.",
        variant: "destructive",
      });
    }
  }, [stopListening, toast, onTranscript]);

  return {
    isListening,
    speechSupported,
    startListening,
    stopListening,
  };
}
