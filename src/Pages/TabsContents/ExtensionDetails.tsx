import { useExtensionStore } from '@/Store/extensionStore';
import { DependencyList } from './Dependency';

const EXTENSION_NOT_FOUND_TOOLTIP = 'This extension not found.';
const EXTENSION_NOT_ACTIVE_TOOLTIP = 'This extension is not active.';
const EXTENSION_WRONG_ORDER_TOOLTIP = 'This extension must be loaded first.';

export function ExtensionDetails({
  image,
  dependencies,
  name,
  version,
  description,
  active,
  priority,
}: {
  image?: string;
  dependencies: string[];
  name: string;
  version?: string;
  description?: string;
  active?: boolean;
  priority: number;
}) {
  const store = useExtensionStore();
  const wow = dependencies
    .map((name) => {
      const extension = store.extensions.find(
        (extension: any) => extension.name === name,
      );

      if (!extension)
        return {
          name,
          type: 'error',
          tooltip: EXTENSION_NOT_FOUND_TOOLTIP,
        };

      if (!active)
        return {
          name,
          type: 'success',
        };

      if (!extension.active)
        return {
          name,
          type: 'error',
          tooltip: EXTENSION_NOT_ACTIVE_TOOLTIP,
        };

      if (extension.priority > priority)
        return {
          name,
          type: 'warning',
          tooltip: EXTENSION_WRONG_ORDER_TOOLTIP,
        };

      return {
        name,
        type: 'success',
      };
    })
    .filter((v) => v);

  return (
    <div className="flex flex-col flex-1 gap-2 h-full">
      {image && (
        <div className="block bg-gray-100 dark:bg-secondary w-full h-80 rounded-lg mb-4 flex-shrink-0 overflow-hidden">
          <img
            src={image}
            alt="Preview Image"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex justify-between items-center flex-shrink-0">
        <label className="text-lg font-bold truncate">{name}</label>
        {version && <label className="text-sm flex-shrink-0">{version}</label>}
      </div>
      <div className="flex flex-col gap-1 flex-1 h-0">
        <label className="text-xs text-gray-400 font-bold flex-shrink-0">
          Dependencies:
        </label>
        <DependencyList dependencies={wow} />
        {description && (
          <label className="bg-gray-100 dark:bg-secondary rounded-lg p-4 mt-4 h-0 flex-1 overflow-y-auto text-sm">
            {description}
          </label>
        )}
      </div>
    </div>
  );
}
