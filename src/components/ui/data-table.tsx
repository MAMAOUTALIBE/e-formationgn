"use client";

// Wrapper léger autour de @tanstack/react-table pour fournir :
//   - tri par colonne (click sur header)
//   - sélection multi (checkbox)
//   - pagination cliente (les pages serveur restent à charge des Server Components)
//   - row actions optionnelles
//
// Les Server Components passent une liste déjà filtrée/paginée côté serveur.
// Le client gère uniquement le tri local et la sélection. Pour des datasets
// volumineux, le composant parent doit faire le filter/sort côté serveur via
// les searchParams.

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Affiche une checkbox de sélection multi. */
  enableSelection?: boolean;
  /** Callback déclenché quand la sélection change. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Message affiché quand `data` est vide. */
  emptyMessage?: string;
  /** Largeur min pour activer le scroll horizontal sur mobile. */
  minWidth?: number;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  enableSelection,
  onSelectionChange,
  emptyMessage = "Aucun résultat.",
  minWidth = 720,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (onSelectionChange) {
        const ids = Object.keys(next).filter((k) => next[k]);
        const selectedIds = ids
          .map((idx) => data[Number(idx)]?.id)
          .filter((id): id is string => Boolean(id));
        onSelectionChange(selectedIds);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: enableSelection,
    getRowId: (row) => row.id,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table
        className="w-full text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {enableSelection ? (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Sélectionner tout"
                    checked={
                      table.getIsAllRowsSelected() ||
                      (table.getIsSomeRowsSelected() && false)
                    }
                    onChange={(e) =>
                      table.toggleAllRowsSelected(e.target.checked)
                    }
                  />
                </th>
              ) : null}
              {headerGroup.headers.map((header) => {
                const sort = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    className={cn("px-4 py-3 font-medium", canSort && "cursor-pointer select-none")}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? (
                        sort === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sort === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (enableSelection ? 1 : 0)}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                {enableSelection ? (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Sélectionner la ligne"
                      checked={row.getIsSelected()}
                      onChange={(e) => row.toggleSelected(e.target.checked)}
                    />
                  </td>
                ) : null}
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
