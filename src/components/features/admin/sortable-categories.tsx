"use client";

// Liste de catégories réordonnable par drag-and-drop (@dnd-kit).
// Persistance : la nouvelle séquence est envoyée à `reorderCategories` après
// chaque drop. Optimistic update local + toast de feedback.

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reorderCategories } from "@/server/actions/admin-categories-order";

export interface SortableCategoryItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  coursesCount: number;
}

interface Props {
  initial: SortableCategoryItem[];
  onDelete: (id: string) => Promise<void>;
}

export function SortableCategories({ initial, onDelete }: Props) {
  const [items, setItems] = useState<SortableCategoryItem[]>(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    const result = await reorderCategories(next.map((i) => i.id));
    if (result.success) {
      toast.success("Ordre enregistré.");
    } else {
      toast.error(result.message ?? "Échec de la réorganisation.");
      setItems(items); // rollback
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune catégorie.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  onDelete,
}: {
  item: SortableCategoryItem;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Réorganiser ${item.name}`}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {item.name}{" "}
          {!item.isActive ? <Badge variant="outline">Inactive</Badge> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          /{item.slug} · {item.coursesCount} formation{item.coursesCount !== 1 ? "s" : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={item.coursesCount > 0}
        onClick={async () => {
          if (!confirm(`Supprimer ${item.name} ?`)) return;
          await onDelete(item.id);
          toast.success("Catégorie supprimée.");
        }}
      >
        Supprimer
      </Button>
    </li>
  );
}
