import { createContext, useContext, useState, useCallback } from "react";

export interface ParsedTransactionResult {
  transactionType: "Income" | "Expense" | "Transfer";
  date?: string;
  amount?: string;
  description?: string;
  category?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
}

interface AiParseContextValue {
  parsedResult: ParsedTransactionResult | null;
  setParsedResult: (result: ParsedTransactionResult | null) => void;
  consumeResult: () => ParsedTransactionResult | null;
}

const AiParseContext = createContext<AiParseContextValue | null>(null);

export function AiParseProvider({ children }: { children: React.ReactNode }) {
  const [parsedResult, setParsedResult] = useState<ParsedTransactionResult | null>(null);

  const consumeResult = useCallback(() => {
    const result = parsedResult;
    setParsedResult(null);
    return result;
  }, [parsedResult]);

  return (
    <AiParseContext.Provider value={{ parsedResult, setParsedResult, consumeResult }}>
      {children}
    </AiParseContext.Provider>
  );
}

export function useAiParseContext() {
  const ctx = useContext(AiParseContext);
  if (!ctx) throw new Error("useAiParseContext must be used within AiParseProvider");
  return ctx;
}
