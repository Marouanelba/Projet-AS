import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, GripVertical, RotateCcw } from 'lucide-react';

interface DataTableWithExportProps {
  entetes: any[][];
  donnees: any[][];
  displaySource?: string;
}

interface SortableHeaderCellProps {
  id: string;
  children: React.ReactNode;
  isFirstRow: boolean;
}

const highlightIndices = (text: string | null) => {
  if (!text) return null;
  const parts = text.split(/(\(\d+\))/g);
  return parts.map((part, i) => {
    if (/(\(\d+\))/.test(part)) {
      return (
        <span key={i} className="px-1 rounded bg-primary/10 text-primary">
          {part}
        </span>
      );
    }
    return part;
  });
};

const renderTableCell = (cell: any, isHeader = false) => {
  if (typeof cell === 'string') return highlightIndices(cell);
  if (cell === null || cell === undefined) return isHeader ? '' : '';
  return String(cell);
};

function SortableHeaderCell({ id, children, isFirstRow }: SortableHeaderCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`border border-border px-3 py-2 text-left font-medium ${
        isDragging ? 'bg-primary/20' : ''
      }`}
    >
      <div className="flex items-center gap-1">
        {isFirstRow && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-primary transition-colors"
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        {children}
      </div>
    </th>
  );
}

export default function DataTableWithExport({
  entetes,
  donnees,
  displaySource,
}: DataTableWithExportProps) {
  const numCols = useMemo(() => {
    if (entetes.length > 0 && Array.isArray(entetes[0])) {
      return entetes[0].length;
    }
    if (donnees.length > 0 && Array.isArray(donnees[0])) {
      return donnees[0].length;
    }
    return 0;
  }, [entetes, donnees]);

  const [columnOrder, setColumnOrder] = useState<number[]>(() =>
    Array.from({ length: numCols }, (_, i) => i)
  );

  // IMPORTANT: quand les données changent (ex: série fusionnée = +colonnes),
  // on doit adapter l'ordre, sinon les nouvelles colonnes ne s'affichent pas.
  useEffect(() => {
    setColumnOrder((prev) => {
      if (prev.length === numCols) return prev;
      return Array.from({ length: numCols }, (_, i) => i);
    });
  }, [numCols]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(Number(active.id));
        const newIndex = items.indexOf(Number(over.id));
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const resetColumnOrder = useCallback(() => {
    setColumnOrder(Array.from({ length: numCols }, (_, i) => i));
  }, [numCols]);

  const isReordered = useMemo(() => {
    return !columnOrder.every((val, idx) => val === idx);
  }, [columnOrder]);

  const reorderedEntetes = useMemo(() => {
    return entetes.map((row) =>
      Array.isArray(row) ? columnOrder.map((colIdx) => row[colIdx]) : row
    );
  }, [entetes, columnOrder]);

  const reorderedDonnees = useMemo(() => {
    return donnees.map((row) =>
      Array.isArray(row) ? columnOrder.map((colIdx) => row[colIdx]) : row
    );
  }, [donnees, columnOrder]);

  const exportToCSV = useCallback(() => {
    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: string[] = [];

    reorderedEntetes.forEach((row) => {
      if (Array.isArray(row)) {
        rows.push(row.map(escapeCSV).join(','));
      }
    });

    reorderedDonnees.forEach((row) => {
      if (Array.isArray(row)) {
        rows.push(row.map(escapeCSV).join(','));
      }
    });

    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export_${displaySource?.replace(/\s+/g, '_') || 'data'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reorderedEntetes, reorderedDonnees, displaySource]);

  const exportToJSON = useCallback(() => {
    const headers: string[] = [];
    if (reorderedEntetes.length > 0 && Array.isArray(reorderedEntetes[0])) {
      reorderedEntetes[0].forEach((cell) => {
        headers.push(cell === null || cell === undefined ? '' : String(cell));
      });
    }

    const data = reorderedDonnees.map((row) => {
      const obj: Record<string, any> = {};
      if (Array.isArray(row)) {
        row.forEach((cell, idx) => {
          const key = headers[idx] || `col_${idx}`;
          obj[key] = cell;
        });
      }
      return obj;
    });

    const json = JSON.stringify({ entetes: reorderedEntetes, donnees: data }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export_${displaySource?.replace(/\s+/g, '_') || 'data'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reorderedEntetes, reorderedDonnees, displaySource]);

  if (!entetes || !donnees) {
    return <div className="text-muted-foreground italic">Aucune donnée disponible.</div>;
  }

  const columnIds = columnOrder.map((idx) => String(idx));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isReordered && (
            <Button variant="outline" size="sm" onClick={resetColumnOrder} className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Réinitialiser l'ordre
            </Button>
          )}
          {displaySource && (
            <Badge variant="outline" className="text-xs font-normal">
              {displaySource}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToCSV}>
              Exporter en CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToJSON}>
              Exporter en JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[70vh]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              {reorderedEntetes.map((row, rowIndex) => (
                <tr key={`header-${rowIndex}`} className="bg-muted">
                  {rowIndex === 0 ? (
                    <SortableContext
                      items={columnIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      {Array.isArray(row) &&
                        row.map((cell, cellIndex) => (
                          <SortableHeaderCell
                            key={String(columnOrder[cellIndex])}
                            id={String(columnOrder[cellIndex])}
                            isFirstRow={true}
                          >
                            {renderTableCell(cell, true)}
                          </SortableHeaderCell>
                        ))}
                    </SortableContext>
                  ) : (
                    Array.isArray(row) &&
                    row.map((cell, cellIndex) => (
                      <th
                        key={`header-${rowIndex}-${cellIndex}`}
                        className="border border-border px-3 py-2 text-left font-medium"
                      >
                        {renderTableCell(cell, true)}
                      </th>
                    ))
                  )}
                </tr>
              ))}
            </thead>
            <tbody>
              {reorderedDonnees.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="hover:bg-muted/50">
                  {Array.isArray(row) &&
                    row.map((cell, cellIndex) => (
                      <td
                        key={`cell-${rowIndex}-${cellIndex}`}
                        className="border border-border px-3 py-2"
                      >
                        {renderTableCell(cell)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>

      <div className="text-xs text-muted-foreground">
        💡 Glissez les en-têtes pour réorganiser les colonnes
      </div>
    </div>
  );
}
