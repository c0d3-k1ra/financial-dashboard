import { useState } from "react";
import { 
  useListTransactions, 
  getListTransactionsQueryKey,
  useCreateTransaction,
  useDeleteTransaction
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, Trash2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: transactions, isLoading } = useListTransactions(
    { search: search || undefined, month: currentMonth },
    { query: { enabled: true, queryKey: getListTransactionsQueryKey({ search: search || undefined, month: currentMonth }) } }
  );

  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: "",
      description: "",
      type: "Expense",
      category: "",
    },
  });

  const watchType = form.watch("type");
  const categories = watchType === "Expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Handle category reset when type changes
  const onTypeChange = (val: "Income" | "Expense") => {
    form.setValue("type", val);
    form.setValue("category", "");
  };

  const onSubmit = (data: FormValues) => {
    createTx.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Transaction added successfully" });
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ search: search || undefined, month: currentMonth }) });
        // Also invalidate other queries that might need this data
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      },
      onError: (err) => {
        toast({ title: "Failed to add transaction", description: String(err), variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this transaction?")) return;
    deleteTx.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ search: search || undefined, month: currentMonth }) });
      }
    });
  };

  const columns = [
    {
      header: "Date",
      accessorKey: "date" as const,
      cell: (tx: any) => <span className="font-mono">{formatDate(tx.date)}</span>,
    },
    {
      header: "Description",
      accessorKey: "description" as const,
      className: "font-medium max-w-[200px] truncate",
    },
    {
      header: "Category",
      accessorKey: "category" as const,
      cell: (tx: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border/50">
          {tx.category}
        </span>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amount" as const,
      className: "text-right",
      cell: (tx: any) => (
        <div className="flex items-center justify-end gap-1 font-mono font-bold">
          {tx.type === "Income" ? (
            <span className="text-emerald-500 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> {formatCurrency(tx.amount)}
            </span>
          ) : (
            <span className="text-foreground flex items-center gap-1">
               {formatCurrency(tx.amount)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "",
      className: "w-10 text-center",
      cardLabel: "Action",
      cell: (tx: any) => (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => handleDelete(tx.id)}
          data-testid={`btn-delete-tx-${tx.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    }
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your daily cash flow.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-tx" className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Log Transaction
            </Button>
          </DialogTrigger>
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
                        <Select onValueChange={(val: any) => onTypeChange(val)} defaultValue={field.value}>
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
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
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
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createTx.isPending} className="w-full">
                    {createTx.isPending ? "Saving..." : "Save Transaction"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card/50 backdrop-blur rounded-xl border border-border/60 p-4 md:p-6 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search transactions..." 
            className="pl-9 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ResponsiveTable 
            data={transactions || []} 
            columns={columns} 
            keyExtractor={(tx) => tx.id}
            emptyState={
              <div className="text-center py-12 px-4 border border-dashed border-border/50 rounded-lg bg-background/30">
                <p className="text-muted-foreground font-mono text-sm">No transactions found.</p>
                {search && <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>}
              </div>
            }
          />
        )}
      </div>

    </div>
  );
}
