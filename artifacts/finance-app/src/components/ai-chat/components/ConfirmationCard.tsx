import { Loader2, X, Check, Pencil, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { getCategoryIcon } from "@/lib/category-icons";
import { TYPE_CONFIG, getAccountTypeIcon } from "../constants";
import { WarningsList } from "./WarningsList";
import type { ChatMessage, TransactionData } from "../types";

interface Account {
  id: number;
  name: string;
  type: string;
}

interface Category {
  name: string;
  type: string;
}

interface ConfirmationCardProps {
  msg: ChatMessage;
  accounts: Account[];
  categories: Category[];
  isProcessing: boolean;
  isMobile: boolean;
  onLogIt: (msgId: string) => void;
  onEdit: (msgId: string) => void;
  onEditField: (msgId: string, field: keyof TransactionData, value: string | number | null) => void;
  onCancelEdit: (msgId: string) => void;
}

function getAccountName(id: number | null, accounts: Account[]) {
  if (!id || !accounts) return "Unknown";
  return accounts.find((a) => a.id === id)?.name ?? "Unknown";
}

function getAccountType(id: number | null, accounts: Account[]) {
  if (!id || !accounts) return "";
  return accounts.find((a) => a.id === id)?.type ?? "";
}

export function ConfirmationCard({
  msg, accounts, categories, isProcessing, isMobile,
  onLogIt, onEdit, onEditField, onCancelEdit,
}: ConfirmationCardProps) {
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
            onClick={() => onCancelEdit(msg.id)}
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
                onChange={(e) => onEditField(msg.id, "amount", e.target.value)}
                className="h-11 text-base pl-7 bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Date</label>
            <DatePicker
              date={tx.date ? new Date(tx.date + "T00:00:00") : undefined}
              onSelect={(d) => onEditField(msg.id, "date", d ? d.toISOString().split("T")[0] : "")}
              className="h-11 w-full text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Description</label>
            <Input
              value={tx.description}
              onChange={(e) => onEditField(msg.id, "description", e.target.value)}
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
                        onClick={() => onEditField(msg.id, "transactionType", t)}
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
                  {categories
                    .filter((c) => c.type === tx.transactionType || c.type === "Both")
                    .map((c) => {
                      const CIcon = getCategoryIcon(c.name);
                      const isActive = tx.category === c.name;
                      return (
                        <button
                          key={c.name}
                          onClick={() => onEditField(msg.id, "category", c.name)}
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
                  {accounts.map((a) => {
                    const AIcon = getAccountTypeIcon(a.type);
                    const isActive = tx.accountId === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => onEditField(msg.id, "accountId", a.id)}
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
                  onValueChange={(v) => onEditField(msg.id, "fromAccountId", v ? Number(v) : null)}
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
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
                  onValueChange={(v) => onEditField(msg.id, "toAccountId", v ? Number(v) : null)}
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
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
            onClick={() => onLogIt(msg.id)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
            Save Changes
          </Button>
          <Button
            variant="ghost"
            className={`text-sm ${isMobile ? "h-12" : "h-10"}`}
            onClick={() => onCancelEdit(msg.id)}
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
          onClick={() => onEdit(msg.id)}
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
            {(() => { const AIcon = getAccountTypeIcon(getAccountType(tx.fromAccountId, accounts)); return <AIcon className="w-3.5 h-3.5" />; })()}
            {getAccountName(tx.fromAccountId, accounts)}
            <ArrowRight className="w-3 h-3" />
            {getAccountName(tx.toAccountId, accounts)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            {(() => { const AIcon = getAccountTypeIcon(getAccountType(tx.accountId, accounts)); return <AIcon className="w-3.5 h-3.5" />; })()}
            {getAccountName(tx.accountId, accounts)}
          </span>
        )}
        <span className="text-muted-foreground/50">•</span>
        <span>{tx.date}</span>
      </div>

      {msg.warnings && msg.warnings.length > 0 && <WarningsList warnings={msg.warnings} />}

      <Button
        className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium ${isMobile ? "h-12" : "h-10"}`}
        onClick={() => onLogIt(msg.id)}
        disabled={isProcessing}
      >
        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
        Log It
      </Button>
    </div>
  );
}
