import { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Tag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<string>("Expense");

  const { data: categories, isLoading } = useListCategories(
    {},
    { query: { queryKey: ["/api/categories"] } }
  );

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

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
          toast({ title: "Failed to add category", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this category?")) return;
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Category deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
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
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCategories.map((cat) => (
                      <TableRow key={cat.id} className="border-border/30">
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border border-border/50 ${
                            cat.type === "Expense" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {cat.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                    {expenseCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(cat.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {!expenseCategories.length && (
                      <p className="text-muted-foreground text-sm font-mono">No expense categories.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Income Categories</h3>
                  <div className="space-y-2">
                    {incomeCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(cat.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
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
    </div>
  );
}
