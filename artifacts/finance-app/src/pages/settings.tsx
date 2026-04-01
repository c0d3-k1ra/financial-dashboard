import { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/constants";
import { Plus, Trash2, Tag, Pencil, Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCategoryIcon } from "@/lib/category-icons";


export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<string>("Expense");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: categories, isLoading } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const renameCategory = useRenameCategory();

  const expenseCategories = categories?.filter((c) => c.type === "Expense") ?? [];
  const incomeCategories = categories?.filter((c) => c.type === "Income") ?? [];

  const handleAdd = () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }

    createCategory.mutate(
      { data: { name: newCategoryName.trim(), type: newCategoryType } },
      {
        onSuccess: () => {
          toast({ title: "Category added" });
          setNewCategoryName("");
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to add category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const confirmDeleteCategory = () => {
    if (deleteCatId === null) return;
    deleteCategory.mutate(
      { id: deleteCatId },
      {
        onSuccess: () => {
          toast({ title: "Category deleted" });
          setDeleteCatId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to delete category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const startEditing = (cat: { id: number; name: string }) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
  };

  const cancelEditing = () => {
    setEditingCatId(null);
    setEditingName("");
  };

  const saveRename = () => {
    if (editingCatId === null || !editingName.trim()) return;

    renameCategory.mutate(
      { id: editingCatId, data: { name: editingName.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Category renamed" });
          cancelEditing();
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        },
        onError: (err) => {
          toast({ title: "Failed to rename category", description: getApiErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const allCategories = [...expenseCategories, ...incomeCategories];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your categories and preferences.</p>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="w-5 h-5" /> Category Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Select value={newCategoryType} onValueChange={setNewCategoryType}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Expense">Expense</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={createCategory.isPending} className="font-mono text-xs uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-hidden rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCategories.map((cat) => {
                      const Icon = getCategoryIcon(cat.name);
                      const isEditing = editingCatId === cat.id;
                      return (
                      <TableRow key={cat.id} className="border-border/30 zebra-row">
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-7 text-sm max-w-[200px]"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRename();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                              />
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              {cat.name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border border-border/50 ${
                            cat.type === "Expense" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {cat.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-500 hover:text-emerald-600"
                                  onClick={saveRename}
                                  disabled={renameCategory.isPending}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={cancelEditing}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditing(cat)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteCatId(cat.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                    {allCategories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground font-mono text-sm">
                          No categories yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden grid grid-cols-1 gap-6">
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Expense Categories</h3>
                  <div className="space-y-2">
                    {expenseCategories.map((cat) => {
                      const CatIcon = getCategoryIcon(cat.name);
                      const isEditing = editingCatId === cat.id;
                      return (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <CatIcon className="w-4 h-4 text-muted-foreground" />
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename();
                                if (e.key === "Escape") cancelEditing();
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium inline-flex items-center gap-2">
                            <CatIcon className="w-4 h-4 text-muted-foreground" />
                            {cat.name}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={saveRename} disabled={renameCategory.isPending}>
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}>
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(cat)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteCatId(cat.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                    })}
                    {!expenseCategories.length && (
                      <p className="text-muted-foreground text-sm font-mono">No expense categories.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Income Categories</h3>
                  <div className="space-y-2">
                    {incomeCategories.map((cat) => {
                      const CatIcon = getCategoryIcon(cat.name);
                      const isEditing = editingCatId === cat.id;
                      return (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <CatIcon className="w-4 h-4 text-muted-foreground" />
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename();
                                if (e.key === "Escape") cancelEditing();
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium inline-flex items-center gap-2">
                            <CatIcon className="w-4 h-4 text-muted-foreground" />
                            {cat.name}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={saveRename} disabled={renameCategory.isPending}>
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}>
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(cat)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteCatId(cat.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                    })}
                    {!incomeCategories.length && (
                      <p className="text-muted-foreground text-sm font-mono">No income categories.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteCatId !== null} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteCategory} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
