import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Loader2, X, Send, Mic, Check, Undo2, Pencil, ArrowRight,
  AlertTriangle, Copy, TrendingUp, Trash2, Receipt, Wallet,
  ArrowLeftRight, Search, Landmark, CreditCard, Plus,
  ArrowDownLeft, ArrowUpRight, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { getCategoryIcon } from "@/lib/category-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAiChat,
  useAiChatConfirm,
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
import type { AiChatWarning } from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface QueryDataItem {
  label: string;
  value: string;
  sublabel?: string;
}

interface QueryData {
  queryType: string;
  title: string;
  total?: string;
  items: QueryDataItem[];
  summary: string;
}

type ChatMessageType = "user" | "assistant" | "confirmation" | "success" | "done" | "query_result";

interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: number;
  options?: ChatOption[];
  transaction?: TransactionData;
  editMode?: boolean;
  editableTransaction?: TransactionData;
  loggedTransactionId?: number;
  undoExpiry?: number;
  warnings?: AiChatWarning[];
  queryData?: QueryData;
}

const CHAT_STORAGE_KEY = "ai-chat-state";
const CHAT_IDLE_TIMEOUT = 30 * 60 * 1000;

interface PersistedChatState {
  messages: ChatMessage[];
  lastActivityAt: number;
}

function loadPersistedChat(): ChatMessage[] {
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

function persistChat(messages: ChatMessage[]) {
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

function clearPersistedChat() {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getIsMobileTouch() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function useIsMobileTouch() {
  const [isMobile] = useState(getIsMobileTouch);
  return isMobile;
}

const CHAT_MIN_HEIGHT = 200;

function useVisualViewportHeight() {
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

const QUICK_ACTIONS: { label: string; icon: LucideIcon; message: string }[] = [
  { label: "Log an expense", icon: Receipt, message: "I want to log an expense" },
  { label: "Record salary", icon: Wallet, message: "Record my salary" },
  { label: "Transfer money", icon: ArrowLeftRight, message: "Transfer money between accounts" },
  { label: "What did I spend today?", icon: Search, message: "What did I spend today?" },
  { label: "Check my balances", icon: Landmark, message: "Show my balance" },
  { label: "Monthly summary", icon: TrendingUp, message: "Monthly summary" },
];

const TYPE_CONFIG: Record<string, { icon: LucideIcon; colorClass: string; bgClass: string }> = {
  Expense: { icon: ArrowDownLeft, colorClass: "text-red-500 dark:text-red-400", bgClass: "bg-red-500/10 border-red-500/20" },
  Income: { icon: ArrowUpRight, colorClass: "text-emerald-500 dark:text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
  Transfer: { icon: ArrowLeftRight, colorClass: "text-blue-500 dark:text-blue-400", bgClass: "bg-blue-500/10 border-blue-500/20" },
};

function getAccountTypeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("credit")) return CreditCard;
  if (t.includes("bank") || t.includes("savings")) return Landmark;
  if (t.includes("cash") || t.includes("wallet")) return Wallet;
  return Landmark;
}

export function AiParseBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedChat());
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearConfirmPending, setClearConfirmPending] = useState(false);
  const clearConfirmTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const undoTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isTouchDevice = useIsMobileTouch();
  const isMobile = useIsMobile();
  const visualViewportHeight = useVisualViewportHeight();

  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const speechSupported = !!getSpeechRecognition();

  const aiChat = useAiChat();
  const aiChatConfirm = useAiChatConfirm();
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

  useEffect(() => {
    persistChat(messages);
  }, [messages]);

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
      setNlInput("");
      setClearConfirmPending(false);
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    }
  }, [isOpen, stopListening]);

  useEffect(() => {
    return () => {
      stopListening(true);
      undoTimersRef.current.forEach((timer) => clearTimeout(timer));
      undoTimersRef.current.clear();
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    };
  }, [stopListening]);

  useEffect(() => {
    if (isOpen && inputRef.current && !isTouchDevice) {
      inputRef.current.focus();
    }
  }, [isOpen, isTouchDevice]);

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
      timestamp: Date.now(),
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
            timestamp: Date.now(),
          },
        ]);
        clearPersistedChat();
      } else if (result.type === "query_result") {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: "query_result",
            content: result.reply,
            timestamp: Date.now(),
            queryData: result.queryData as QueryData | undefined,
          },
        ]);
      } else if (result.type === "confirmation" && result.transaction) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: "confirmation",
            content: result.reply,
            timestamp: Date.now(),
            transaction: result.transaction as TransactionData,
            warnings: result.warnings as AiChatWarning[] | undefined,
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
            timestamp: Date.now(),
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
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
      if (!isTouchDevice) setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isProcessing, isTouchDevice, stopListening, getConversationHistory, aiChat, categories, accounts]);

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

      try {
        await aiChatConfirm.mutateAsync({
          data: {
            description: tx.description || undefined,
            category: tx.category || undefined,
            accountId: tx.accountId,
          },
        });
      } catch {
        // non-critical
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

      clearPersistedChat();

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
      if (!isTouchDevice) setTimeout(() => inputRef.current?.focus(), 100);
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

  const getAccountType = (id: number | null) => {
    if (!id || !accounts) return "";
    return accounts.find((a) => a.id === id)?.type ?? "";
  };

  const handleClearConversation = () => {
    if (clearConfirmPending) {
      setMessages([]);
      clearPersistedChat();
      setClearConfirmPending(false);
      if (clearConfirmTimer.current) {
        clearTimeout(clearConfirmTimer.current);
        clearConfirmTimer.current = null;
      }
    } else {
      setClearConfirmPending(true);
      if (clearConfirmTimer.current) clearTimeout(clearConfirmTimer.current);
      clearConfirmTimer.current = setTimeout(() => {
        setClearConfirmPending(false);
        clearConfirmTimer.current = null;
      }, 3000);
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      dragCurrentY.current = delta;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${delta}px)`;
        sheetRef.current.style.transition = "none";
      }
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || dragStartY.current === null) return;
    const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight;
    const threshold = sheetHeight * 0.3;
    if (dragCurrentY.current > threshold) {
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(100%)`;
        sheetRef.current.style.transition = "transform 0.3s ease-out";
      }
      setTimeout(() => setIsOpen(false), 300);
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transform = "translateY(0)";
        sheetRef.current.style.transition = "transform 0.3s ease-out";
      }
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [isMobile]);

  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.style.transform = "translateY(0)";
      sheetRef.current.style.transition = "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)";
    }
  }, [isOpen]);

  const renderWarnings = (warnings: AiChatWarning[]) => {
    return (
      <div className="space-y-2 mt-2">
        {warnings.map((warning, i) => {
          let borderColor = "border-l-amber-500";
          let icon = <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;

          if (warning.type === "anomaly") {
            borderColor = "border-l-orange-500";
            icon = <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />;
            return (
              <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
                <div className="flex items-start gap-2.5">
                  {icon}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Unusual Amount
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {warning.anomalyType === "merchant"
                        ? `${warning.ratio}x your typical spend here (avg ₹${warning.averageAmount?.toLocaleString()})`
                        : `${warning.ratio}x the average for this category (avg ₹${warning.averageAmount?.toLocaleString()})`}
                    </p>
                    {warning.typicalAmount && (
                      <p className="text-xs text-muted-foreground/70">
                        You usually spend around ₹{warning.typicalAmount.toLocaleString()} here
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (warning.type === "budget") {
            borderColor = "border-l-red-500";
            const pct = warning.budgetAmount
              ? Math.round((warning.afterTransaction! / warning.budgetAmount) * 100)
              : 0;
            return (
              <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-700 dark:text-red-300">
                      {warning.isOverBudget ? "Budget Exceeded" : "Budget Warning"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {warning.isOverBudget
                        ? `${warning.categoryName} budget already exceeded`
                        : `This will push ${warning.categoryName} to ${pct}% of budget`}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      ₹{warning.spentSoFar?.toLocaleString()} + ₹{(warning.afterTransaction! - warning.spentSoFar!).toLocaleString()} = ₹{warning.afterTransaction?.toLocaleString()} / ₹{warning.budgetAmount?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (warning.type === "duplicate") {
            borderColor = "border-l-yellow-500";
            return (
              <div key={i} className={`glass-2 rounded-lg p-3 border-l-[3px] ${borderColor}`}>
                <div className="flex items-start gap-2.5">
                  <Copy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                      Possible Duplicate
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₹{Number(warning.existingAmount).toLocaleString()} — "{warning.existingDescription}" on {warning.existingDate}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  const renderConfirmationCard = (msg: ChatMessage) => {
    const tx = msg.editMode ? msg.editableTransaction! : msg.transaction!;
    const CategoryIcon = getCategoryIcon(tx.category || "");
    const isTransfer = tx.transactionType === "Transfer";
    const typeConfig = TYPE_CONFIG[tx.transactionType] || TYPE_CONFIG.Expense;
    const TypeIcon = typeConfig.icon;

    if (msg.editMode) {
      return (
        <div className="glass-2 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Edit Transaction</span>
            <button
              onClick={() => handleCancelEdit(msg.id)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={tx.amount}
                  onChange={(e) => handleEditField(msg.id, "amount", e.target.value)}
                  className="h-11 text-base pl-7 bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Date</label>
              <DatePicker
                date={tx.date ? new Date(tx.date + "T00:00:00") : undefined}
                onSelect={(d) => handleEditField(msg.id, "date", d ? d.toISOString().split("T")[0] : "")}
                className="h-11 w-full text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Description</label>
              <Input
                value={tx.description}
                onChange={(e) => handleEditField(msg.id, "description", e.target.value)}
                className="h-11 text-sm bg-background/50"
                placeholder="What was this for?"
              />
            </div>

            {!isTransfer && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Type</label>
                  <div className="flex gap-2">
                    {["Expense", "Income"].map((t) => {
                      const cfg = TYPE_CONFIG[t];
                      const TIcon = cfg.icon;
                      const isActive = tx.transactionType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => handleEditField(msg.id, "transactionType", t)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                            isActive
                              ? `${cfg.bgClass} ${cfg.colorClass} border`
                              : "glass-2 border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <TIcon className="w-3.5 h-3.5" />
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Category</label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-0.5 scrollbar-thin">
                    {(categories ?? [])
                      .filter((c) => c.type === tx.transactionType || c.type === "Both")
                      .map((c) => {
                        const CIcon = getCategoryIcon(c.name);
                        const isActive = tx.category === c.name;
                        return (
                          <button
                            key={c.name}
                            onClick={() => handleEditField(msg.id, "category", c.name)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                              isActive
                                ? "bg-primary/15 border-primary/30 text-primary font-medium"
                                : "glass-2 border-transparent text-muted-foreground hover:border-primary/15 hover:text-foreground"
                            }`}
                          >
                            <CIcon className="w-3 h-3" />
                            {c.name}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Account</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(accounts ?? []).map((a) => {
                      const AIcon = getAccountTypeIcon(a.type);
                      const isActive = tx.accountId === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleEditField(msg.id, "accountId", a.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all border ${
                            isActive
                              ? "bg-primary/15 border-primary/30 text-primary font-medium"
                              : "glass-2 border-transparent text-muted-foreground hover:border-primary/15 hover:text-foreground"
                          }`}
                        >
                          <AIcon className="w-3.5 h-3.5" />
                          <span>{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {isTransfer && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">From Account</label>
                  <Select
                    value={tx.fromAccountId ? String(tx.fromAccountId) : ""}
                    onValueChange={(v) => handleEditField(msg.id, "fromAccountId", v ? Number(v) : null)}
                  >
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts ?? []).map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">To Account</label>
                  <Select
                    value={tx.toAccountId ? String(tx.toAccountId) : ""}
                    onValueChange={(v) => handleEditField(msg.id, "toAccountId", v ? Number(v) : null)}
                  >
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts ?? []).map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium ${isMobile ? "h-12" : "h-10"}`}
              onClick={() => handleLogIt(msg.id)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
              Save Changes
            </Button>
            <Button
              variant="ghost"
              className={`text-sm ${isMobile ? "h-12" : "h-10"}`}
              onClick={() => handleCancelEdit(msg.id)}
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-2 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${typeConfig.bgClass} ${typeConfig.colorClass}`}>
            <TypeIcon className="w-3 h-3" />
            {tx.transactionType}
          </span>
          <button
            onClick={() => handleEdit(msg.id)}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[rgba(var(--glass-overlay-rgb),0.08)] transition-colors disabled:opacity-50"
            aria-label="Edit transaction"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight">
            {tx.transactionType === "Income" ? "+" : tx.transactionType === "Transfer" ? "" : "−"}
          </span>
          <span className="text-3xl font-bold tracking-tight">
            ₹{isNaN(Number(tx.amount)) ? tx.amount : Number(tx.amount).toLocaleString("en-IN")}
          </span>
        </div>

        {!isTransfer && tx.category && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full glass-2">
              <CategoryIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {tx.category}
            </span>
            {tx.description && (
              <span className="text-xs text-muted-foreground truncate">{tx.description}</span>
            )}
          </div>
        )}

        {isTransfer && tx.description && (
          <p className="text-xs text-muted-foreground">{tx.description}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isTransfer ? (
            <span className="flex items-center gap-1.5">
              {(() => { const AIcon = getAccountTypeIcon(getAccountType(tx.fromAccountId)); return <AIcon className="w-3.5 h-3.5" />; })()}
              {getAccountName(tx.fromAccountId)}
              <ArrowRight className="w-3 h-3" />
              {getAccountName(tx.toAccountId)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {(() => { const AIcon = getAccountTypeIcon(getAccountType(tx.accountId)); return <AIcon className="w-3.5 h-3.5" />; })()}
              {getAccountName(tx.accountId)}
            </span>
          )}
          <span className="text-muted-foreground/50">•</span>
          <span>{tx.date}</span>
        </div>

        {msg.warnings && msg.warnings.length > 0 && renderWarnings(msg.warnings)}

        <Button
          className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium ${isMobile ? "h-12" : "h-10"}`}
          onClick={() => handleLogIt(msg.id)}
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
          Log It
        </Button>
      </div>
    );
  };

  const renderQueryResultCard = (msg: ChatMessage) => {
    const qd = msg.queryData;
    if (!qd) return null;

    return (
      <div className="glass-2 rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{qd.title}</h4>
            {qd.total && (
              <span className="text-lg font-bold tracking-tight">{qd.total}</span>
            )}
          </div>

          {qd.items.length > 0 && (
            <div className="space-y-1">
              {qd.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-2 px-2 rounded-lg ${
                    i % 2 === 0 ? "bg-[rgba(var(--glass-overlay-rgb),0.03)]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.sublabel && (
                      <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {qd.summary && (
            <div className="pt-2 border-t border-[var(--divider-color)]">
              <p className="text-xs text-muted-foreground">{qd.summary}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDoneCard = (msg: ChatMessage) => {
    const hasUndo = msg.undoExpiry && Date.now() < msg.undoExpiry && msg.loggedTransactionId;
    const originalTx = msg.transaction;

    if (msg.content === "Transaction undone.") {
      return (
        <div className="glass-2 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
            <Undo2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">{msg.content}</span>
        </div>
      );
    }

    return (
      <div className="glass-2 rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="ai-checkmark-container w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="ai-checkmark-circle" />
                <path d="M8 12.5l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ai-checkmark-path" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Transaction Logged</p>
              {originalTx && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {originalTx.transactionType === "Income" ? "+" : originalTx.transactionType === "Transfer" ? "" : "−"}₹{isNaN(Number(originalTx.amount)) ? originalTx.amount : Number(originalTx.amount).toLocaleString("en-IN")}
                  {originalTx.category ? ` • ${originalTx.category}` : ""}
                  {originalTx.accountId ? ` • ${getAccountName(originalTx.accountId)}` : ""}
                </p>
              )}
            </div>
          </div>

          {hasUndo && (
            <div className="space-y-2">
              <div className="h-0.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full bg-amber-500/60 rounded-full"
                  style={{
                    animation: `ai-undo-shrink ${Math.max(0, ((msg.undoExpiry || 0) - Date.now()) / 1000)}s linear forwards`,
                  }}
                />
              </div>
              <button
                onClick={() => handleUndo(msg.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                Undo
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => sendMessage("I want to log another transaction")}
          className="w-full px-4 py-2.5 border-t border-[var(--divider-color)] text-xs text-muted-foreground hover:text-foreground hover:bg-[rgba(var(--glass-overlay-rgb),0.04)] transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3 h-3" />
          Log another
        </button>
      </div>
    );
  };

  const renderEmptyState = () => {
    const greeting = getGreeting();
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold">{greeting}</h3>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            I can help you log transactions, check balances, and manage your finances.
          </p>
        </div>

        <div className={`w-full max-w-sm ${isMobile ? "space-y-2" : "grid grid-cols-2 gap-2"}`}>
          {QUICK_ACTIONS.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => sendMessage(action.message)}
                disabled={isProcessing}
                className={`flex items-center gap-2.5 text-left transition-all disabled:opacity-50 ${
                  isMobile
                    ? "w-full glass-2 rounded-xl px-4 py-3.5 hover:bg-[rgba(var(--glass-overlay-rgb),0.06)] active:scale-[0.98]"
                    : "glass-2 rounded-xl px-3 py-2.5 hover:bg-[rgba(var(--glass-overlay-rgb),0.06)] active:scale-[0.98]"
                } chat-pill-light pill-button-dark`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ActionIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTypingIndicator = () => (
    <div className="flex justify-start ai-message-enter">
      <div className="glass-1 rounded-lg rounded-bl-sm px-4 py-3 bubble-ai-dark">
        <div className="flex items-center gap-1.5">
          <div className="ai-typing-dot" />
          <div className="ai-typing-dot" />
          <div className="ai-typing-dot" />
        </div>
      </div>
    </div>
  );

  const headerBar = (
    <div className={`flex items-center justify-between ${isMobile ? "px-4 pb-2" : "p-3"} border-b border-[var(--divider-color)] ${isProcessing && isMobile ? "ai-header-shimmer" : ""}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium">AI Assistant</span>
      </div>
      <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className={`${isMobile ? "h-11 w-11" : "h-7 w-7"} ${clearConfirmPending ? "text-red-500" : ""}`}
            onClick={handleClearConversation}
            aria-label="Clear conversation"
          >
            {clearConfirmPending ? (
              <span className="text-xs font-medium">Clear?</span>
            ) : (
              <Trash2 className={`${isMobile ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={isMobile ? "h-11 w-11" : "h-7 w-7"}
          onClick={() => setIsOpen(false)}
        >
          <X className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        </Button>
      </div>
    </div>
  );

  const chatContent = (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
        {messages.length === 0 && renderEmptyState()}

        {messages.map((msg, idx) => {
          const showTimestamp = msg.timestamp && (
            idx === 0 ||
            !messages[idx - 1]?.timestamp ||
            msg.timestamp - (messages[idx - 1]?.timestamp || 0) > 120000
          );

          return (
            <div key={msg.id}>
              {showTimestamp && msg.timestamp && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] text-muted-foreground/50 font-medium">{getRelativeTime(msg.timestamp)}</span>
                </div>
              )}

              {msg.type === "user" && (
                <div className="flex justify-end ai-message-enter">
                  <div className="dark:bg-amber-600/20 dark:border-amber-600/30 bg-blue-500 border border-transparent dark:text-inherit text-white rounded-lg rounded-br-sm px-3 py-2 max-w-[85%] shadow-sm dark:border-0 bubble-user-dark">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              )}

              {msg.type === "query_result" && (
                <div className="flex justify-start ai-message-enter">
                  <div className="max-w-[95%] w-full space-y-2">
                    <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    {msg.queryData && renderQueryResultCard(msg)}
                  </div>
                </div>
              )}

              {msg.type === "done" && (
                <div className="flex justify-start ai-message-enter">
                  <div className="max-w-[95%] w-full">
                    {renderDoneCard(msg)}
                  </div>
                </div>
              )}

              {msg.type === "confirmation" && (
                <div className="flex justify-start ai-message-enter">
                  <div className="max-w-[95%] w-full space-y-2">
                    <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    {msg.transaction && renderConfirmationCard(msg)}
                  </div>
                </div>
              )}

              {msg.type === "assistant" && (
                <div className="flex justify-start ai-message-enter">
                  <div className="max-w-[85%] space-y-2">
                    <div className="glass-1 rounded-lg rounded-bl-sm px-3 py-2 bubble-ai-dark">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    {msg.options && msg.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {msg.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleOptionClick(opt)}
                            disabled={isProcessing}
                            className="chat-pill-light px-3 py-1.5 text-xs rounded-full border dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 transition-colors disabled:opacity-50 backdrop-blur-sm font-medium pill-button-dark"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isProcessing && renderTypingIndicator()}

        <div ref={messagesEndRef} />
      </div>

      {isListening && (
        <div className="px-3 pb-1">
          <div className="ai-recording-bar h-1 rounded-full bg-red-500/30 overflow-hidden">
            <div className="h-full bg-red-500 rounded-full ai-recording-pulse-bar" />
          </div>
        </div>
      )}

      <div className="p-3 border-t border-[var(--divider-color)]" style={isMobile ? { paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 8px)" } : undefined}>
        <div className="flex gap-2 items-end">
          <Input
            ref={inputRef}
            placeholder={messages.some((m) => m.type === "done")
              ? "Log another or ask a question..."
              : 'e.g. "Spent 450 at Starbucks"'
            }
            className={`flex-1 bg-background/50 border-amber-500/30 focus-visible:ring-amber-500/30 ${isMobile ? "h-12 text-base" : "h-9 text-sm"}`}
            style={isMobile ? { fontSize: "16px" } : undefined}
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage(nlInput);
              }
            }}
            onFocus={() => {
              if (isTouchDevice) {
                setTimeout(() => inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300);
              }
            }}
            disabled={isProcessing}
          />
          {speechSupported && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={() => isListening ? stopListening() : startListening()}
              disabled={isProcessing}
              className={`shrink-0 ${isMobile ? "h-12 w-12" : "h-9 w-9"} ${isListening ? "animate-pulse" : ""}`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              <Mic className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            </Button>
          )}
          <Button
            onClick={() => sendMessage(nlInput)}
            disabled={isProcessing || !nlInput.trim()}
            className={`shrink-0 bg-amber-600 hover:bg-amber-700 text-white ${isMobile ? "h-12 w-12" : "h-9 w-9"}`}
            size="icon"
          >
            {isProcessing ? (
              <Loader2 className={`${isMobile ? "w-5 h-5" : "w-4 h-4"} animate-spin`} />
            ) : (
              <Send className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            )}
          </Button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={sheetRef}
              className="absolute bottom-0 left-0 right-0 glass-3 chat-panel-light chat-panel-dark rounded-t-2xl shadow-2xl flex flex-col"
              style={{
                height: visualViewportHeight
                  ? `${Math.min(visualViewportHeight * 0.95, visualViewportHeight - 20)}px`
                  : "85dvh",
                transform: "translateY(100%)",
                transition: "height 0.15s ease-out",
              }}
            >
              <div
                className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              {headerBar}
              {chatContent}
            </div>
          </div>
        )}

        <div className="fixed z-40 right-4" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            className="h-14 w-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all"
            size="icon"
            data-testid="ai-parse-bubble"
          >
            <Sparkles className="w-6 h-6" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {isOpen && (
        <div className="w-[calc(100vw-3rem)] max-w-md chat-panel-enter">
          <div className="glass-3 chat-panel-light chat-panel-dark rounded-xl shadow-2xl flex flex-col" style={{
            height: visualViewportHeight && isTouchDevice
              ? `${Math.max(CHAT_MIN_HEIGHT, Math.min(visualViewportHeight - 100, 500))}px`
              : "50vh",
            maxHeight: "500px",
            transition: "height 0.15s ease-out",
          }}>
            {headerBar}
            {chatContent}
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
