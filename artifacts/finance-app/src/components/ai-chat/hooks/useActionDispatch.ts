import { useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAiChatConfirm,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  getListTransactionsQueryKey,
  getListAccountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetMonthlySurplusQueryKey,
} from "@workspace/api-client-react";
import type { ChatMessage, TransactionData } from "../types";
import { clearPersistedChat } from "../utils";

interface UseActionDispatchParams {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  setNlInput: (v: string) => void;
  isTouchDevice: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function useActionDispatch({
  messages,
  setMessages,
  isProcessing,
  setIsProcessing,
  setNlInput,
  isTouchDevice,
  inputRef,
}: UseActionDispatchParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const aiChatConfirm = useAiChatConfirm();
  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const deleteTx = useDeleteTransaction();
  const undoTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
  }, [queryClient]);

  const handleLogIt = useCallback(async (msgId: string) => {
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
  }, [messages, setMessages, setIsProcessing, setNlInput, isTouchDevice, inputRef, toast, createTx, createTransfer, aiChatConfirm, invalidateAll]);

  const handleUndo = useCallback(async (msgId: string) => {
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
  }, [messages, setMessages, deleteTx, invalidateAll, toast]);

  const handleEdit = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, editMode: true, editableTransaction: { ...m.transaction! } }
          : m
      )
    );
  }, [setMessages]);

  const handleEditField = useCallback((msgId: string, field: keyof TransactionData, value: string | number | null) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.editableTransaction
          ? { ...m, editableTransaction: { ...m.editableTransaction, [field]: value } }
          : m
      )
    );
  }, [setMessages]);

  const handleCancelEdit = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, editMode: false, editableTransaction: undefined } : m
      )
    );
  }, [setMessages]);

  const cleanupTimers = useCallback(() => {
    undoTimersRef.current.forEach((timer) => clearTimeout(timer));
    undoTimersRef.current.clear();
  }, []);

  return {
    handleLogIt,
    handleUndo,
    handleEdit,
    handleEditField,
    handleCancelEdit,
    invalidateAll,
    cleanupTimers,
    isProcessing,
  };
}
