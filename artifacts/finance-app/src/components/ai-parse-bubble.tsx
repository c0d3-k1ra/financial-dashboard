import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Sparkles, Loader2, X, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/constants";
import { useAiParseContext } from "@/lib/ai-parse-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAiParse,
  useListCategories,
  useListAccounts,
  getListAccountsQueryKey,
  getListCategoriesQueryKey,
  getListBudgetGoalsQueryKey,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";

interface ISpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionResult {
  readonly length: number;
  [index: number]: ISpeechRecognitionResultItem;
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface WindowWithSpeech {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

const getSpeechRecognition = (): (new () => ISpeechRecognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function AiParseBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { setParsedResult } = useAiParseContext();
  const queryClient = useQueryClient();

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
        setNlInput((prev) => (prev ? prev + " " + transcript : transcript));
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast({
          title: "Microphone access denied",
          description:
            "Please allow microphone access in your browser settings to use voice input.",
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
  }, [stopListening, toast]);

  useEffect(() => {
    if (!isOpen) {
      stopListening(true);
    }
  }, [isOpen, stopListening]);

  useEffect(() => {
    return () => stopListening(true);
  }, [stopListening]);

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const aiParse = useAiParse();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!aiParse.isPending) {
          setIsOpen(false);
        }
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [isOpen, aiParse.isPending]);

  const handleParse = () => {
    stopListening(true);
    const trimmed = nlInput.trim();
    if (!trimmed) return;

    aiParse.mutate(
      {
        data: {
          text: trimmed,
          categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type })),
          accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type })),
        },
      },
      {
        onSuccess: (result) => {
          setNlInput("");
          setIsOpen(false);

          const intent = result.intent;

          if (intent === "add_transaction") {
            setParsedResult({
              transactionType: (result.transactionType as "Income" | "Expense") || "Expense",
              date: result.date || new Date().toISOString().split("T")[0],
              amount: result.amount || "",
              description: result.description || "",
              category: result.category || "",
              accountId: result.accountId ? String(result.accountId) : "",
            });
            navigate("/transactions");
            return;
          }

          if (intent === "transfer") {
            setParsedResult({
              transactionType: "Transfer",
              fromAccountId: result.fromAccountId ? String(result.fromAccountId) : undefined,
              toAccountId: result.toAccountId ? String(result.toAccountId) : undefined,
              amount: result.amount || undefined,
              date: result.date || undefined,
              description: result.description || undefined,
            });
            navigate("/transactions");
            return;
          }

          if (intent === "add_category") {
            queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
            queryClient.invalidateQueries({ queryKey: getListBudgetGoalsQueryKey() });
            toast({
              title: "Category created",
              description: result.message || `Created category "${result.createdEntityName}"`,
            });
            return;
          }

          if (intent === "add_account") {
            queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            toast({
              title: "Account created",
              description: result.message || `Created account "${result.createdEntityName}"`,
            });
            return;
          }

          if (intent === "set_budget") {
            queryClient.invalidateQueries({ queryKey: getListBudgetGoalsQueryKey() });
            toast({
              title: "Budget updated",
              description: result.message || `Updated budget for "${result.createdEntityName}"`,
            });
            return;
          }

          if (intent === "add_savings_goal") {
            queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
            toast({
              title: "Savings goal created",
              description: result.message || `Created savings goal "${result.createdEntityName}"`,
            });
            return;
          }
        },
        onError: (err) => {
          toast({
            title: "Failed to process request",
            description: getApiErrorMessage(err),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {isOpen && (
        <div className="w-[calc(100vw-3rem)] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-card border border-border/60 rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">AI Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { if (!aiParse.isPending) setIsOpen(false); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  placeholder='e.g. "Spent 450 at Starbucks" or "Add a category"'
                  className={`bg-background/50 border-amber-500/30 focus-visible:ring-amber-500/30 text-sm ${speechSupported ? "pr-9" : ""}`}
                  value={nlInput}
                  onChange={(e) => setNlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleParse();
                    }
                  }}
                  disabled={aiParse.isPending}
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => isListening ? stopListening() : startListening()}
                    disabled={aiParse.isPending}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors disabled:opacity-50 ${
                      isListening
                        ? "text-red-500 animate-pulse"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleParse}
                disabled={aiParse.isPending || !nlInput.trim()}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                size="icon"
              >
                {aiParse.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Describe a transaction, or ask me to add a category, account, budget, or savings goal.
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all"
        size="icon"
        data-testid="ai-parse-bubble"
      >
        <Sparkles className="w-6 h-6" />
      </Button>
    </div>
  );
}
