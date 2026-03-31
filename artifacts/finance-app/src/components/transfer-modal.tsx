import { useListAccounts, getListAccountsQueryKey, useCreateTransfer } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  fromAccountId: z.string().min(1, "Select source account"),
  toAccountId: z.string().min(1, "Select destination account"),
  amount: z.string().min(1, "Amount is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransferModal({ open, onOpenChange }: TransferModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: accounts } = useListAccounts({ query: { queryKey: getListAccountsQueryKey() } });
  const createTransfer = useCreateTransfer();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    if (data.fromAccountId === data.toAccountId) {
      toast({ title: "Source and destination must be different", variant: "destructive" });
      return;
    }

    createTransfer.mutate(
      {
        data: {
          fromAccountId: Number(data.fromAccountId),
          toAccountId: Number(data.toAccountId),
          amount: data.amount,
          date: data.date,
          description: data.description || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Transfer completed" });
          onOpenChange(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        },
        onError: (err) => {
          toast({ title: "Transfer failed", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer Between Accounts</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="fromAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.type === "credit_card" ? "CC" : "Bank"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.type === "credit_card" ? "CC" : "Bank"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-muted-foreground">{"\u20B9"}</span>
                      <Input type="number" step="0.01" className="pl-7 font-mono min-h-[44px]" placeholder="0.00" {...field} />
                    </div>
                  </FormControl>
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
                    <Input type="date" className="min-h-[44px]" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CC payment" className="min-h-[44px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={createTransfer.isPending} className="w-full min-h-[44px]">
                {createTransfer.isPending ? "Processing..." : "Complete Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
