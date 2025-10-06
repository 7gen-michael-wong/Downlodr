import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';

export function DragContext({
  children,
  onDragEnd,
}: {
  children: React.ReactNode;
  onDragEnd?: (event: DragEndEvent) => void;
}) {
  const [draggedElement, setDraggedElement] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function onDragStart(event: DragStartEvent) {
    const {
      active: {
        data: {
          current: { element, onDragEnd },
        },
      },
    } = event;

    setDraggedElement(element);
    onDragEnd?.(event);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={(e) => {
        setDraggedElement(null);
        onDragEnd?.(e);
      }}
    >
      {children}
      <DragOverlay>{draggedElement}</DragOverlay>
    </DndContext>
  );
}
