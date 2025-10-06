import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { Check, OctagonAlert, XOctagon } from 'lucide-react';

export function DependencyType({
  type,
  size = 19,
}: {
  type: string;
  size?: number;
}) {
  switch (type) {
    case 'success':
      return <Check color="green" size={size} />;
    case 'warning':
      return <OctagonAlert color="orange" size={size} />;
    case 'error':
      return <XOctagon color="red" size={size} />;
  }
}

function Dependency({
  name,
  type,
  tooltip,
}: {
  name: string;
  type: string;
  tooltip?: string;
}) {
  if (!tooltip)
    return (
      <div className="flex gap-[7px] items-center">
        <DependencyType type={type} />
        <label className="text-sm whitespace-nowrap">{name}</label>
      </div>
    );

  return (
    <TooltipWrapper content={tooltip}>
      <div className="flex gap-[7px] items-center">
        <DependencyType type={type} />
        <label className="text-sm whitespace-nowrap">{name}</label>
      </div>
    </TooltipWrapper>
  );
}

export function DependencyList({
  dependencies,
}: {
  dependencies: {
    name: string;
    type: string;
    tooltip?: string;
  }[];
}) {
  const dependencyItems = dependencies.map(({ name, type, tooltip }) => (
    <Dependency key={name} name={name} type={type} tooltip={tooltip} />
  ));

  if (dependencyItems.length === 0)
    return <label className="text-sm font-bold flex-shrink-0">N/A</label>;

  return (
    <div className="flex gap-5 w-full flex-wrap flex-shrink-0">
      {dependencyItems}
    </div>
  );
}
