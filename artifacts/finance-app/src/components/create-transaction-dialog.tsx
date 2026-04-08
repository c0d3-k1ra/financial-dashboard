import { useState } from "react";
import {
  useCreateTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  useCreateCategory,
  useListAccounts,
  getListAccountsQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetMonthlySurplusQueryKey,
} from "@workspace/api-client-react";
import { getApiErrorMessage } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTransactionDialog({ open, onOpenChange }: CreateTransactionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const { data: categories } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const { data: accounts } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const createCategory = useCreateCategory();
  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: "",
      description: "",
      type: "Expense",
      category: "",
      accountId: "",
    },
  });

  const watchType = form.watch("type");
  const filteredCategories = categories?.filter((c) => c.type === watchType) ?? [];

  const onTypeChange = (val: "Income" | "Expense") => {
    form.setValue("type", val);
    form.setValue("category", "");
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { data: { name: trimmed, type: form.getValues("type") === "Income" ? "Income" : "Expense" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          form.setValue("category", trimmed);
          setNewCatName("");
          setIsAddingCategory(false);
          toast({ title: "Category created" });
        },
        onError: (err) => {
          toast({ title: "Failed to create category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const onSubmit = (data: FormValues) => {
    createTx.mutate(
      {
        data: {
          ...data,
          accountId: Number(data.accountId),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Transaction added successfully" });
          onOpenChange(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonthlySurplusQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to add transaction", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const accountList = (accounts ?? []).filter((a) => a.type !== "loan");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
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
                      {accountList.map((a) => (
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
                {createTx.isPending ? "Saving..." : "Save Transaction"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
