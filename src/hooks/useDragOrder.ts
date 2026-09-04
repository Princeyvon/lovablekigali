import { useEffect, useRef, useState } from "react";

type Item = { id: string };

/**
 * Lightweight HTML5 drag-to-reorder for a list of rows/cards.
 * Keeps a local order while dragging and commits the new id order on drop.
 */
export function useDragOrder<T extends Item>(items: T[], onCommit: (ids: string[]) => void) {
  const [ids, setIds] = useState<string[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const committed = useRef<string>("");

  const incoming = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (dragId) return;
    setIds((prev) => (prev.join(",") === incoming ? prev : incoming ? incoming.split(",") : []));
  }, [incoming, dragId]);

  const ordered = ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as T[];
  const list = ordered.length === items.length ? ordered : items;

  const move = (from: string, to: string) => {
    if (from === to) return;
    setIds((prev) => {
      const next = [...prev];
      const f = next.indexOf(from);
      const t = next.indexOf(to);
      if (f < 0 || t < 0) return prev;
      next.splice(t, 0, next.splice(f, 1)[0]!);
      return next;
    });
  };

  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", id);
      } catch {
        /* noop */
      }
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId) move(dragId, id);
    },
    onDragEnd: () => {
      setDragId(null);
      const key = ids.join(",");
      if (key && key !== incoming && key !== committed.current) {
        committed.current = key;
        onCommit(ids);
      }
    },
  });

  return { list, dragId, dragProps };
}
