import type { AiChatWarning } from "@workspace/api-client-react";

export interface ISpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

export interface ISpeechRecognitionResult {
  readonly length: number;
  [index: number]: ISpeechRecognitionResultItem;
}

export interface ISpeechRecognitionResultList {
  readonly length: number;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

export interface ISpeechRecognition extends EventTarget {
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

export interface WindowWithSpeech {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

export interface TransactionData {
  transactionType: string;
  amount: string;
  date: string;
  description: string;
  category: string;
  accountId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
}

export interface ChatOption {
  label: string;
  value: string;
}

export interface QueryDataItem {
  label: string;
  value: string;
  sublabel?: string;
}

export interface QueryData {
  queryType: string;
  title: string;
  total?: string;
  items: QueryDataItem[];
  summary: string;
}

export type ChatMessageType = "user" | "assistant" | "confirmation" | "success" | "done" | "query_result";

export interface ChatMessage {
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

export interface PersistedChatState {
  messages: ChatMessage[];
  lastActivityAt: number;
}
