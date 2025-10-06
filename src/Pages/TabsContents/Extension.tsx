import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Minus,
  Plus,
} from 'lucide-react';
import React from 'react';
import { DependencyType } from './Dependency';
import { useExtensionStore } from '@/Store/extensionStore';

function ActiveItemDependencyType({
  dependencies,
  priority,
}: {
  dependencies: string[];
  priority: number;
}) {
  const store = useExtensionStore();

  for (const dependency of dependencies) {
    const extension = store.extensions.find(
      (extension: any) => extension.name === dependency,
    );

    if (!extension) return <DependencyType type="warning" size={14} />;

    if (!extension.active) return <DependencyType type="error" size={14} />;

    if (extension.priority > priority)
      return <DependencyType type="warning" size={14} />;
  }
}

export const Extensions = {
  Root({ children }: { children?: React.ReactNode }) {
    return (
      <div className="block h-full">
        <div className="relative flex flex-col gap-2 w-72 h-full">
          {children}
        </div>
      </div>
    );
  },

  DummyItem({
    children,
    shadow,
  }: {
    children?: React.ReactNode;
    shadow?: boolean;
  }) {
    return (
      <div
        className={cn(
          'pointer-events-none flex items-center p-3 bg-white dark:bg-secondary gap-2 transition-all duration-100 h-14 rounded-sm dark:text-white',
          shadow && 'shadow-md',
        )}
      >
        {children}
      </div>
    );
  },

  Droppable({ id }: { id: string }) {
    let { setNodeRef, isOver } = useDroppable({
      id,
    });
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'pointer-events-none flex items-center p-3 bg-white dark:bg-secondary gap-2 h-14 rounded-sm dark:text-white',
          !isOver && 'opacity-0',
        )}
      />
    );
  },

  Draggable({
    className,
    id,
    children,
    selected,
    disabled,
    onClick,
  }: {
    id: string;
    className?: string;
    children?: React.ReactNode;
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }) {
    let { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id,
      disabled,
      data: {
        element: <Extensions.DummyItem shadow>{children}</Extensions.DummyItem>,
      },
    });

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          'flex items-center p-3 even:bg-gray-100 even:dark:bg-white/5 gap-2 hover:bg-secondary/10 dark:hover:bg-secondary transition-all duration-100 h-14 rounded-sm',
          selected && '!bg-secondary/10 dark:!bg-gray-700',
          isDragging && 'opacity-10',
          className,
        )}
        onClick={onClick}
      >
        {children}
      </div>
    );
  },

  Sortable({
    className,
    id,
    children,
    selected,
    disabled,
    onClick,
  }: {
    id: string;
    className?: string;
    children?: React.ReactNode;
    selected?: boolean;
    sortable?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }) {
    let {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id,
      disabled,
      data: {
        element: <Extensions.DummyItem shadow>{children}</Extensions.DummyItem>,
      },
    });

    const style = {
      transition,
      transform: CSS.Transform.toString(transform),
    };

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={style}
        className={cn(
          'flex items-center p-3 even:bg-gray-100 even:dark:bg-white/5 gap-2 hover:bg-secondary/10 dark:hover:bg-secondary transition-all duration-100 h-14 rounded-sm',
          selected && '!bg-secondary/10 dark:!bg-gray-700',
          isDragging && 'opacity-10',
          className,
        )}
        onClick={onClick}
      >
        {children}
      </div>
    );
  },

  AvailableItem({
    id,
    name,
    active,
    selected,
    disabled,
    onActivate,
    onSelected,
  }: {
    id: string;
    name: string;
    active: boolean;
    selected?: boolean;
    disabled?: boolean;
    onActivate?: () => void;
    onSelected: () => void;
  }) {
    return (
      <Extensions.Draggable
        disabled={disabled || active}
        onClick={onSelected}
        selected={selected}
        id={'available@' + id}
      >
        <GripVertical className="opacity-50" size={16} />
        <label
          className={cn(
            'flex-1 text-sm truncate pointer-events-none',
            active && 'opacity-20',
          )}
        >
          {name}
        </label>
        <TooltipWrapper content="Activate">
          <Button
            className="p-[2px] rounded-sm !bg-orange-600"
            size="icon"
            disabled={active}
            onClick={(e) => {
              e.stopPropagation();
              onActivate?.();
            }}
          >
            <Plus color="white" size={13} />
          </Button>
        </TooltipWrapper>
      </Extensions.Draggable>
    );
  },

  PriorityNumber({
    priority,
    canUp,
    canDown,
    onUp,
    onDown,
  }: {
    priority: number;
    canUp?: boolean;
    canDown?: boolean;
    onUp?: () => void;
    onDown?: () => void;
  }) {
    return (
      <div className="flex gap-1 items-center">
        <label className="text-sm pointer-events-none">{priority}</label>
        <div className="flex flex-col gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canUp}
            onClick={(e) => {
              e.stopPropagation();
              onUp?.();
            }}
          >
            <ChevronUp size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!canDown}
            onClick={(e) => {
              e.stopPropagation();
              onDown?.();
            }}
          >
            <ChevronDown size={12} />
          </Button>
        </div>
      </div>
    );
  },

  ActiveItem({
    id,
    name,
    priority,
    dependencies,
    selected,
    canUp,
    canDown,
    onUp,
    onDown,
    onDeactivate,
    onSelected,
  }: {
    id: string;
    name: string;
    priority: number;
    dependencies: string[];
    selected?: boolean;
    canUp?: boolean;
    canDown?: boolean;
    onUp?: () => void;
    onDown?: () => void;
    onDeactivate?: () => void;
    onSelected: () => void;
  }) {
    return (
      <Extensions.Sortable
        onClick={onSelected}
        selected={selected}
        id={'active@' + id}
        sortable
      >
        <TooltipWrapper content="Deactivate">
          <Button
            className="p-[2px] rounded-sm !bg-orange-600/10 hover:!bg-orange-600/30"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDeactivate?.();
            }}
          >
            <Minus color="orange" size={13} />
          </Button>
        </TooltipWrapper>
        <GripVertical className="opacity-50" size={16} />
        <label className="flex-1 text-sm truncate pointer-events-none">
          {name}
        </label>
        <ActiveItemDependencyType
          dependencies={dependencies}
          priority={priority}
        />
        <Extensions.PriorityNumber
          priority={priority}
          canUp={canUp}
          canDown={canDown}
          onUp={onUp}
          onDown={onDown}
        />
      </Extensions.Sortable>
    );
  },

  Header({
    title,
    count,
    children,
  }: {
    title: string;
    count: number;
    children?: React.ReactNode;
  }) {
    return (
      <div className="flex gap-1 text-sm h-8 items-center">
        <label>{title}</label>
        <label className="text-orange-600">({count})</label>
        {children && <div className="flex-1" />}
        {children}
      </div>
    );
  },

  Content({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) {
    return (
      <div className={cn('flex flex-col overflow-y-auto', className)}>
        {children}
      </div>
    );
  },
};
