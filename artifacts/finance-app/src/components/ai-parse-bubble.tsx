import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Sparkles, Loader2, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/constants";
import { useAiParseContext } from "@/lib/ai-parse-context";
import {
  useParseNaturalTransaction,
  useListCategories,
  useListAccounts,
  getListAccountsQueryKey,
} from "@workspace/api-client-react";

export function AiParseBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { setParsedResult } = useAiParseContext();

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const parseTx = useParseNaturalTransaction();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!parseTx.isPending) {
          setIsOpen(false);
        }
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [isOpen, parseTx.isPending]);

  const handleParse = () => {
    const trimmed = nlInput.trim();
    if (!trimmed) return;

    parseTx.mutate(
      {
        data: {
          text: trimmed,
          categories: (categories ?? []).map((c) => ({ name: c.name, type: c.type })),
          accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type })),
        },
      },
      {
        onSuccess: (result) => {
          setNlInput("");
          setIsOpen(false);

          if (result.transactionType === "Transfer") {
            setParsedResult({
              transactionType: "Transfer",
              fromAccountId: result.fromAccountId ? String(result.fromAccountId) : undefined,
              toAccountId: result.toAccountId ? String(result.toAccountId) : undefined,
              amount: result.amount || undefined,
              date: result.date || undefined,
              description: result.description || undefined,
            });
          } else {
            setParsedResult({
              transactionType: (result.transactionType as "Income" | "Expense") || "Expense",
              date: result.date || new Date().toISOString().split("T")[0],
              amount: result.amount || "",
              description: result.description || "",
              category: result.category || "",
              accountId: result.accountId ? String(result.accountId) : "",
            });
          }

          navigate("/transactions");
        },
        onError: (err) => {
          toast({
            title: "Failed to parse transaction",
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
                <span className="text-sm font-medium">AI Transaction Parser</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { if (!parseTx.isPending) setIsOpen(false); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder='e.g. "Spent 450 at Starbucks yesterday"'
                className="bg-background/50 border-amber-500/30 focus-visible:ring-amber-500/30 text-sm"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleParse();
                  }
                }}
                disabled={parseTx.isPending}
              />
              <Button
                onClick={handleParse}
                disabled={parseTx.isPending || !nlInput.trim()}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                size="icon"
              >
                {parseTx.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Describe a transaction or transfer in plain English.
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
