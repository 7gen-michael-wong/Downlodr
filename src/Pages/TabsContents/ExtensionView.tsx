import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import { useExtensionStore } from '@/Store/extensionStore';
import { AlertTriangle, ArrowDownNarrowWide, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Extensions } from './Extension';
import { ExtensionDetails } from './ExtensionDetails';
import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';

function AutoSort({ onClick }: { onClick: () => void }) {
  return (
    <TooltipWrapper content="Auto-Sort">
      <Button
        className="p-[6px] rounded-[3px] !bg-orange-600"
        size="icon"
        onClick={onClick}
      >
        <ArrowDownNarrowWide color="white" size={12} strokeWidth={1.5} />
      </Button>
    </TooltipWrapper>
  );
}

function UndoChanges({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipWrapper content="Undo Changes">
      <Button
        className="p-[6px] rounded-[3px] !bg-orange-600"
        size="icon"
        disabled={!active}
        onClick={onClick}
      >
        <RotateCcw color="white" size={12} strokeWidth={1.5} />
      </Button>
    </TooltipWrapper>
  );
}

function NeedsRestart() {
  return (
    <div className="flex justify-end gap-2 items-center px-8">
      <AlertTriangle size={16} color="orange" />
      <label>Please restart the app to apply the changes.</label>
    </div>
  );
}

export function ExtensionView() {
  const store = useExtensionStore();
  const [activeId, setActiveId] = useState<string>();
  const [overId, setOverId] = useState<string>();
  const [draggedElement, setDraggedElement] = useState();
  const [selected, setSelected] = useState<any>();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const extendedNames = store.extensions.map(
    ({ extendedName }: any) => 'available@' + extendedName,
  );
  const activeExtensions = store.getActive();
  const activeExtendedNames = activeExtensions.map(
    ({ extendedName }: any) => 'active@' + extendedName,
  );

  const draggedExtendedName = extendedNames.find(
    (name: string) => name === activeId,
  );
  const overIdIndex = overId ? activeExtendedNames.indexOf(overId) : -1;
  const draggedExtension = store.extensions.find(
    (extension: any) =>
      extension.extendedName === draggedExtendedName?.slice(10),
  );

  const availableItems = store.extensions.map(
    (extension: any, index: number) => (
      <Extensions.AvailableItem
        key={index}
        id={extension.extendedName}
        name={extension.name}
        active={extension.active}
        selected={selected?.name === extension.name}
        onSelected={() => setSelected(extension)}
        onActivate={() => {
          store.activate(extension.name, activeExtensions.length);
        }}
      />
    ),
  );
  const activeItems = activeExtensions.map((extension: any, index: number) => (
    <Extensions.ActiveItem
      key={index}
      id={extension.extendedName}
      name={extension.name}
      priority={extension.priority}
      dependencies={extension.packageJson?.extendrDependencies ?? []}
      selected={selected?.name === extension.name}
      canUp={extension.priority > 0}
      canDown={extension.priority < activeExtensions.length - 1}
      onSelected={() => setSelected(extension)}
      onUp={() => store.activate(extension.name, extension.priority - 1)}
      onDown={() => store.activate(extension.name, extension.priority + 1)}
      onDeactivate={() => store.deactivate(extension.name)}
    />
  ));

  // Insert draggedExtension at overIdIndex if dragging
  if (draggedExtension && overIdIndex >= 0) {
    activeItems.splice(overIdIndex, 0, <Extensions.DummyItem />);
  }

  function onDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
    setDraggedElement(active.data.current.element);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (active && over) return setOverId(over.id as string);

    setOverId(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    if (extendedNames.includes(active.id) && over.id === 'end@') {
      store.fromExtendedNames([
        ...activeExtendedNames.map((n: string) => n.substring(7)),
        (active.id as string).substring(10),
      ]);
      return;
    }

    // If dragging into List B
    if (
      !activeExtendedNames.includes(active.id) &&
      extendedNames.includes(active.id)
    ) {
      // insert at drop target
      const overIndex = activeExtendedNames.indexOf(over.id);
      const extendedNames = activeExtendedNames.map((n: string) =>
        n.substring(7),
      );

      if (overIndex >= 0)
        return store.fromExtendedNames([
          ...extendedNames.slice(0, overIndex),
          (active.id as string).substring(10),
          ...extendedNames.slice(overIndex),
        ]);

      store.fromExtendedNames([
        ...activeExtendedNames.map((n: string) => n.substring(7)),
        (active.id as string).substring(7),
      ]);
      return;
    }

    // If reordering inside List B
    if (
      activeExtendedNames.includes(active.id) &&
      activeExtendedNames.includes(over.id)
    ) {
      const extendedNames = activeExtendedNames.map((n: string) =>
        n.substring(7),
      );

      store.fromExtendedNames(
        arrayMove(
          extendedNames,
          activeExtendedNames.indexOf(active.id),
          activeExtendedNames.indexOf(over.id),
        ),
      );
      return;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex h-full w-full gap-12">
          <Extensions.Root>
            <Extensions.Header
              title="Available"
              count={availableItems.length}
            />
            <Extensions.Content>{availableItems}</Extensions.Content>
          </Extensions.Root>
          <Extensions.Root>
            <Extensions.Header title="Active" count={activeItems.length}>
              <UndoChanges
                active={store.needsRestart}
                onClick={() => store.reset()}
              />
              <AutoSort onClick={() => store.sortByDependencies()} />
            </Extensions.Header>
            <Extensions.Content>
              <SortableContext
                items={activeExtendedNames}
                strategy={rectSortingStrategy}
              >
                {activeItems}
              </SortableContext>
              {activeId && extendedNames.includes(activeId) && (
                <Extensions.Droppable id="end@" />
              )}
            </Extensions.Content>
          </Extensions.Root>
          {selected && (
            <ExtensionDetails
              name={selected.name}
              version={selected.packageJson?.version}
              image={selected.packageJson?.image}
              dependencies={selected.packageJson?.extendrDependencies ?? []}
              description={selected.packageJson?.description}
              active={selected.active}
              priority={selected.priority}
            />
          )}
        </div>
        {store.needsRestart && <NeedsRestart />}
        <DragOverlay dropAnimation={null}>{draggedElement}</DragOverlay>
      </div>
    </DndContext>
  );
}
