import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteTransactionDialogProps {
  deleteId: number | null;
  setDeleteId: (id: number | null) => void;
  confirmDelete: () => void;
  isPending: boolean;
}

export function DeleteTransactionDialog({ deleteId, setDeleteId, confirmDelete, isPending }: DeleteTransactionDialogProps) {
  return (
    <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Are you sure you want to delete this transaction? This action cannot be undone and will adjust your account balance.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
