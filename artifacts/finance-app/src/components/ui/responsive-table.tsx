import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
  cardLabel?: React.ReactNode;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  emptyState?: React.ReactNode;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  rowClassName?: (item: T) => string;
}

export function ResponsiveTable<T>({ 
  data, 
  columns, 
  keyExtractor, 
  className,
  emptyState,
  renderMobileCard,
  rowClassName
}: ResponsiveTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className}>
      <div className="hidden md:block rounded-md border border-white/[0.08] bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {columns.map((col, i) => (
                  <TableHead key={i} className={cn("text-muted-foreground font-mono text-xs uppercase tracking-wider", col.className)}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow
                  key={keyExtractor(row, rowIndex)}
                  className={cn(
                    "transition-colors hover:bg-muted/30 zebra-row",
                    rowClassName?.(row)
                  )}
                >
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex} className={col.className}>
                      {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey] ?? "") : null)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {renderMobileCard
          ? data.map((row, rowIndex) => (
              <React.Fragment key={keyExtractor(row, rowIndex)}>
                {renderMobileCard(row, rowIndex)}
              </React.Fragment>
            ))
          : data.map((row, rowIndex) => (
              <Card key={keyExtractor(row, rowIndex)} className="overflow-hidden border-border/60">
                <CardContent className="p-4 flex flex-col gap-2">
                  {columns.map((col, colIndex) => {
                    const content = col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey] ?? "") : null);
                    const label = col.cardLabel !== undefined ? col.cardLabel : col.header;
                    
                    if (content === null || content === undefined || content === "") return null;

                    return (
                      <div key={colIndex} className={cn("flex justify-between items-start gap-4", col.className)}>
                        <span className="text-xs font-mono text-muted-foreground uppercase">{label}</span>
                        <div className="text-right text-sm">
                          {content}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
        }
      </div>
    </div>
  );
}
