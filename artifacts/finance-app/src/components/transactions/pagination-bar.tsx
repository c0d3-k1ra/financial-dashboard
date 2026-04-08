import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  showingFrom: number;
  showingTo: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
}

export function PaginationBar({ currentPage, totalPages, totalCount, showingFrom, showingTo, setCurrentPage }: PaginationBarProps) {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[var(--divider-color)]">
      <p className="text-xs font-mono text-muted-foreground">
        Showing {showingFrom}–{showingTo} of {totalCount} transactions
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .map((page, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev !== undefined && page - prev > 1;
              return (
                <span key={page} className="flex items-center">
                  {showEllipsis && <span className="px-1 text-muted-foreground text-xs">…</span>}
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </span>
              );
            })}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
