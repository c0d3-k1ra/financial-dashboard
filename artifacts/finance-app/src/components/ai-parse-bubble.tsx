import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Loader2, X, Send, Mic, Check, Undo2, Pencil, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCategoryIcon } from "@/lib/category-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAiChat,
  useListCategories,
  useListAccounts,
  getListAccountsQueryKey,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetMonthlySurplusQueryKey,
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

interface TransactionData {
  transactionType: string;
  amount: string;
  date: string;
  description: string;
  category: string;
  accountId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
}

interface ChatOption {
  label: string;
  value: string;
}

type ChatMessageType = "user" | "assistant" | "confirmation" | "success" | "done";

interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  options?: ChatOption[];
  transaction?: TransactionData;
  editMode?: boolean;
  editableTransaction?: TransactionData;
  loggedTransactionId?: number;
  undoExpiry?: number;
}

export function AiParseBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const undoTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const speechSupported = !!getSpeechRecognition();

  const aiChat = useAiChat();
  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const deleteTx = useDeleteTransaction();

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
  }, [queryClient]);

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
  }, [stopListening, toast]);

  useEffect(() => {
    if (!isOpen) {
      stopListening(true);
      setMessages([]);
      setNlInput("");
      undoTimersRef.current.forEach((timer) => clearTimeout(timer));
      undoTimersRef.current.clear();
    }
  }, [isOpen, stopListening]);

  useEffect(() => {
    return () => {
      stopListening(true);
      undoTimersRef.current.forEach((timer) => clearTimeout(timer));
      undoTimersRef.current.clear();
    };
  }, [stopListening]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const genId = () => Math.random().toString(36).slice(2, 9);

  const getConversationHistory = useCallback(() => {
    const lastDoneIdx = messages.reduce((acc, m, i) => (m.type === "done" ? i : acc), -1);
    const relevantMessages = lastDoneIdx >= 0 ? messages.slice(lastDoneIdx + 1) : messages;
    return relevantMessages
      .filter((m) => m.type === "user" || m.type === "assistant" || m.type === "confirmation")
      .map((m) => ({
        role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.type === "confirmation" && m.transaction
          ? m.content + "\n[Transaction data: " + JSON.stringify(m.transaction) + "]"
          : m.content,
      }));
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    stopListening(true);
    const trimmed = text.trim();

    const userMsg: ChatMessage = {
      id: genId(),
      type: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setNlInput("");
    setIsProcessing(true);

    const history = getConversationHistory();
    history.push({ role: "user", content: trimmed });

    try {
      const result = await aiChat.mutateAsync({
        data: {
          messages: history,
          categories: (categories ?? []).map((c) => ({ name: c.name, type: c.type })),
          accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type })),
        },
      });

      if (result.type === "cancelled") {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: "assistant",
            content: result.reply,
          },
        ]);
      } else if (result.type === "confirmation" && result.transaction) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: "confirmation",
            content: result.reply,
            transaction: result.transaction as TransactionData,
          },
        ]);
      } else {
        const rawOptions = result.options as ChatOption[] | undefined;
        const dedupedOptions = rawOptions
          ? rawOptions.filter((opt, i, arr) => arr.findIndex((o) => o.label === opt.label) === i)
          : undefined;
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: "assistant",
            content: result.reply,
            options: dedupedOptions,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          type: "assistant",
          content: "Sorry, I had trouble processing that. Please try again.",
        },
      ]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isProcessing, stopListening, getConversationHistory, aiChat, categories, accounts]);

  const handleOptionClick = (option: ChatOption) => {
    sendMessage(option.value || option.label);
  };

  const handleLogIt = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const tx = msg.editMode ? msg.editableTransaction : msg.transaction;
    if (!tx) return;

    if (!tx.amount || isNaN(Number(tx.amount)) || Number(tx.amount) <= 0) {
      toast({ title: "Invalid amount", description: "Please provide a valid positive amount.", variant: "destructive" });
      return;
    }
    if (!tx.date) {
      tx.date = new Date().toISOString().split("T")[0];
    }

    setIsProcessing(true);

    try {
      let createdId: number;

      if (tx.transactionType === "Transfer") {
        if (!tx.fromAccountId || !tx.toAccountId) {
          toast({ title: "Missing accounts for transfer", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        const result = await createTransfer.mutateAsync({
          data: {
            fromAccountId: tx.fromAccountId,
            toAccountId: tx.toAccountId,
            amount: String(Number(tx.amount)),
            date: tx.date,
            description: tx.description || undefined,
          },
        });
        createdId = result.id;
      } else {
        if (!tx.accountId) {
          toast({ title: "Missing account", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        if (!tx.category) {
          toast({ title: "Missing category", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        const result = await createTx.mutateAsync({
          data: {
            date: tx.date,
            amount: String(Number(tx.amount)),
            description: tx.description || tx.category,
            category: tx.category,
            type: tx.transactionType,
            accountId: tx.accountId,
          },
        });
        createdId = result.id;
      }

      invalidateAll();

      const undoExpiry = Date.now() + 10000;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, type: "done" as const, content: "Transaction logged!", loggedTransactionId: createdId, undoExpiry, editMode: false }
            : m
        )
      );

      const timer = setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, undoExpiry: undefined } : m
          )
        );
        undoTimersRef.current.delete(msgId);
      }, 10000);
      undoTimersRef.current.set(msgId, timer);
    } catch {
      toast({ title: "Failed to log transaction", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setNlInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleUndo = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.loggedTransactionId) return;

    try {
      await deleteTx.mutateAsync({ id: msg.loggedTransactionId });
      invalidateAll();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: "Transaction undone.", undoExpiry: undefined, loggedTransactionId: undefined }
            : m
        )
      );

      const timer = undoTimersRef.current.get(msgId);
      if (timer) {
        clearTimeout(timer);
        undoTimersRef.current.delete(msgId);
      }
    } catch {
      toast({ title: "Failed to undo transaction", variant: "destructive" });
    }
  };

  const handleEdit = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, editMode: true, editableTransaction: { ...m.transaction! } }
          : m
      )
    );
  };

  const handleEditField = (msgId: string, field: keyof TransactionData, value: string | number | null) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.editableTransaction
          ? { ...m, editableTransaction: { ...m.editableTransaction, [field]: value } }
          : m
      )
    );
  };

  const handleCancelEdit = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, editMode: false, editableTransaction: undefined } : m
      )
    );
  };

  const getAccountName = (id: number | null) => {
    if (!id || !accounts) return "Unknown";
    return accounts.find((a) => a.id === id)?.name ?? "Unknown";
  };

  const renderConfirmationCard = (msg: ChatMessage) => {
    const tx = msg.editMode ? msg.editableTransaction! : msg.transaction!;
    const CategoryIcon = getCategoryIcon(tx.category || "");
    const isTransfer = tx.transactionType === "Transfer";

    if (msg.editMode) {
      return (
        <div className="glass-2 rounded-lg p-3 space-y-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Amount</span>
              <Input
                value={tx.amount}
                onChange={(e) => handleEditField(msg.id, "amount", e.target.value)}
                className="h-7 text-sm bg-background/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Date</span>
              <Input
                type="date"
                value={tx.date}
                onChange={(e) => handleEditField(msg.id, "date", e.target.value)}
                className="h-7 text-sm bg-background/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Desc</span>
              <Input
                value={tx.description}
                onChange={(e) => handleEditField(msg.id, "description", e.target.value)}
                className="h-7 text-sm bg-background/50"
              />
            </div>
            {!isTransfer && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Category</span>
                  <select
                    value={tx.category}
                    onChange={(e) => handleEditField(msg.id, "category", e.target.value)}
                    className="h-7 text-sm bg-background/50 border border-border rounded px-2 flex-1"
                  >
                    {(categories ?? []).map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Account</span>
                  <select
                    value={tx.accountId ?? ""}
                    onChange={(e) => handleEditField(msg.id, "accountId", e.target.value ? Number(e.target.value) : null)}
                    className="h-7 text-sm bg-background/50 border border-border rounded px-2 flex-1"
                  >
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Type</span>
                  <select
                    value={tx.transactionType}
                    onChange={(e) => handleEditField(msg.id, "transactionType", e.target.value)}
                    className="h-7 text-sm bg-background/50 border border-border rounded px-2 flex-1"
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </select>
                </div>
              </>
            )}
            {isTransfer && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">From</span>
                  <select
                    value={tx.fromAccountId ?? ""}
                    onChange={(e) => handleEditField(msg.id, "fromAccountId", e.target.value ? Number(e.target.value) : null)}
                    className="h-7 text-sm bg-background/50 border border-border rounded px-2 flex-1"
                  >
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">To</span>
                  <select
                    value={tx.toAccountId ?? ""}
                    onChange={(e) => handleEditField(msg.id, "toAccountId", e.target.value ? Number(e.target.value) : null)}
                    className="h-7 text-sm bg-background/50 border border-border rounded px-2 flex-1"
                  >
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
              onClick={() => handleLogIt(msg.id)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => handleCancelEdit(msg.id)}
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-2 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            tx.transactionType === "Income" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
            tx.transactionType === "Transfer" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
            "bg-red-500/20 text-red-600 dark:text-red-400"
          }`}>
            {tx.transactionType}
          </span>
          <span className="text-xs text-muted-foreground">{tx.date}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">
            {tx.transactionType === "Income" ? "+" : tx.transactionType === "Transfer" ? "" : "-"}₹{isNaN(Number(tx.amount)) ? tx.amount : Number(tx.amount).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {!isTransfer && (
            <>
              <CategoryIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{tx.category}</span>
            </>
          )}
          {tx.description && (
            <span className="text-muted-foreground">
              {!isTransfer ? "• " : ""}{tx.description}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {isTransfer ? (
            <span className="flex items-center gap-1">
              {getAccountName(tx.fromAccountId)} <ArrowRight className="w-3 h-3" /> {getAccountName(tx.toAccountId)}
            </span>
          ) : (
            <span>{getAccountName(tx.accountId)}</span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
            onClick={() => handleLogIt(msg.id)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            Log It
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => handleEdit(msg.id)}
            disabled={isProcessing}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    );
  };

  const renderDoneCard = (msg: ChatMessage) => {
    const hasUndo = msg.undoExpiry && Date.now() < msg.undoExpiry && msg.loggedTransactionId;

    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm text-emerald-600 dark:text-emerald-400">{msg.content}</span>
        </div>
        {hasUndo && (
          <button
            onClick={() => handleUndo(msg.id)}
            className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {isOpen && (
        <div className="w-[calc(100vw-3rem)] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="glass-3 rounded-xl shadow-2xl flex flex-col" style={{ height: "50vh", maxHeight: "500px" }}>
            <div className="flex items-center justify-between p-3 border-b border-[var(--divider-color)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium">AI Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
                  <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-muted-foreground">
                    Describe a transaction and I'll help you log it.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    e.g. "Spent 450 at Starbucks" or "Received 50000 salary"
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.type === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="bg-amber-600/20 border border-amber-600/30 rounded-lg rounded-br-sm px-3 py-2 max-w-[85%]">
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.type === "done") {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[95%] w-full">
                        {renderDoneCard(msg)}
                      </div>
                    </div>
                  );
                }

                if (msg.type === "confirmation") {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[95%] w-full space-y-2">
                        <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2">
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        {msg.transaction && renderConfirmationCard(msg)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[85%] space-y-2">
                      <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2">
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {msg.options && msg.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {msg.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleOptionClick(opt)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 text-xs rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors disabled:opacity-50"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex justify-start">
                  <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-[var(--divider-color)]">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    placeholder={messages.some((m) => m.type === "done")
                      ? "Log another or close"
                      : 'e.g. "Spent 450 at Starbucks"'
                    }
                    className={`bg-background/50 border-amber-500/30 focus-visible:ring-amber-500/30 text-sm ${speechSupported ? "pr-9" : ""}`}
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendMessage(nlInput);
                      }
                    }}
                    disabled={isProcessing}
                  />
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={() => isListening ? stopListening() : startListening()}
                      disabled={isProcessing}
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
                  onClick={() => sendMessage(nlInput)}
                  disabled={isProcessing || !nlInput.trim()}
                  className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                  size="icon"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
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
