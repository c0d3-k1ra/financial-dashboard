import React, { useState } from "react";
import type { Transaction } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";

export const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
});

export type FormValues = z.infer<typeof formSchema>;

export function TransactionFormFields({
  form,
  onSubmit,
  onTypeChange,
  filteredCategories,
  accounts,
  isAddingCategory,
  setIsAddingCategory,
  newCatName,
  setNewCatName,
  handleAddCategory,
  createCategory,
  createTx,
  submitLabel,
}: {
  form: UseFormReturn<FormValues>;
  onSubmit: (data: FormValues) => void;
  onTypeChange: (val: "Income" | "Expense") => void;
  filteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  createTx: { isPending: boolean };
  submitLabel?: string;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={(val: string) => onTypeChange(val as "Income" | "Expense")} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <DatePicker
                  date={field.value ? new Date(field.value + "T00:00:00") : undefined}
                  onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="Pick a date"
                  className="w-full"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">{"\u20B9"}</span>
                  <Input type="number" step="0.01" className="pl-7 font-mono" placeholder="0.00" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="What was this for?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              {isAddingCategory ? (
                <div className="flex gap-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name"
                    className="font-mono text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  />
                  <Button type="button" size="sm" onClick={handleAddCategory} disabled={createCategory.isPending}>
                    {createCategory.isPending ? "..." : "Add"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setIsAddingCategory(false); setNewCatName(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select onValueChange={(val) => { if (val === "__add_new__") { setIsAddingCategory(true); } else { field.onChange(val); } }} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-medium border-t border-border/50 mt-1">
                      + Add Category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4">
          <Button type="submit" disabled={createTx.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {createTx.isPending ? "Saving..." : (submitLabel || "Save Transaction")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function EditTransactionPanel({
  editingTx,
  onClose,
  editForm,
  onEditSubmit,
  onEditTypeChange,
  editFilteredCategories,
  accounts,
  isAddingCategory,
  setIsAddingCategory,
  newCatName,
  setNewCatName,
  handleAddCategory,
  createCategory,
  updateTx,
}: {
  editingTx: Transaction | null;
  onClose: () => void;
  editForm: UseFormReturn<FormValues>;
  onEditSubmit: (data: FormValues) => void;
  onEditTypeChange: (val: "Income" | "Expense") => void;
  editFilteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  updateTx: { isPending: boolean };
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <Sheet open={editingTx !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
          </SheetHeader>
          <TransactionFormFields
            form={editForm}
            onSubmit={onEditSubmit}
            onTypeChange={onEditTypeChange}
            filteredCategories={editFilteredCategories}
            accounts={accounts}
            isAddingCategory={isAddingCategory}
            setIsAddingCategory={setIsAddingCategory}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            handleAddCategory={handleAddCategory}
            createCategory={createCategory}
            createTx={updateTx}
            submitLabel="Update Transaction"
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={editingTx !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <TransactionFormFields
          form={editForm}
          onSubmit={onEditSubmit}
          onTypeChange={onEditTypeChange}
          filteredCategories={editFilteredCategories}
          accounts={accounts}
          isAddingCategory={isAddingCategory}
          setIsAddingCategory={setIsAddingCategory}
          newCatName={newCatName}
          setNewCatName={setNewCatName}
          handleAddCategory={handleAddCategory}
          createCategory={createCategory}
          createTx={updateTx}
          submitLabel="Update Transaction"
        />
      </DialogContent>
    </Dialog>
  );
}

export function TransactionFormWrapper(props: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<FormValues>;
  onSubmit: (data: FormValues) => void;
  onTypeChange: (val: "Income" | "Expense") => void;
  filteredCategories: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; name: string }>;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  handleAddCategory: () => void;
  createCategory: { isPending: boolean };
  createTx: { isPending: boolean };
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
        <SheetTrigger asChild>
          <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Log Transaction
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Transaction</SheetTitle>
          </SheetHeader>
          <TransactionFormFields {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Log Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
        <TransactionFormFields {...props} />
      </DialogContent>
    </Dialog>
  );
}
