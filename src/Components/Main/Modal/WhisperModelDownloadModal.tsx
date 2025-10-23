import { useToast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import {
  WhisperModel,
  WhisperModelDownloadModalProps,
  WhisperModelsResponse,
  InstalledWhisperModelsResponse,
} from '@/schema/whisperSchema';
import { useEffect, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { MdDownload, MdInfo, MdCheckCircle } from 'react-icons/md';

const WhisperModelDownloadModal: React.FC<WhisperModelDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [models, setModels] = useState<WhisperModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<WhisperModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch available models when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableModels();
    }
  }, [isOpen]);

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedModel(null);
      setModels([]);
      setIsDownloading(false);
    }
  }, [isOpen]);

  const fetchAvailableModels = async () => {
    setIsLoading(true);
    try {
      // Fetch both available and installed models
      const [availableResponse, installedResponse] = await Promise.all([
        window.extendr.extensions['whisper-x-downloader'][
          'whisperx:listAvailable'
        ]() as Promise<WhisperModelsResponse>,
        window.extendr.extensions['whisper-x-downloader'][
          'whisperx:listInstalled'
        ]() as Promise<InstalledWhisperModelsResponse>,
      ]);

      if (availableResponse.success && availableResponse.models) {
        // Create a set of installed model names for quick lookup
        const installedModelNames = new Set(
          installedResponse.success && installedResponse.models
            ? installedResponse.models.map((model) => model.name)
            : [],
        );

        // Mark models as installed if they exist in the installed list
        const modelsWithInstallStatus = availableResponse.models.map(
          (model) => ({
            ...model,
            isInstalled: installedModelNames.has(model.name),
          }),
        );

        setModels(modelsWithInstallStatus);

        // Pre-select the first recommended model or the first model
        const recommendedModel = modelsWithInstallStatus.find(
          (model) => model.recommended,
        );
        setSelectedModel(
          recommendedModel || modelsWithInstallStatus[0] || null,
        );
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Load Models',
          description: 'Could not fetch available Whisper models',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Models',
        description:
          error?.message || String(error) || 'Failed to load available models',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadModel = async () => {
    if (!selectedModel) {
      toast({
        variant: 'destructive',
        title: 'No Model Selected',
        description: 'Please select a model to download',
        duration: 3000,
      });
      return;
    }

    if (selectedModel.isInstalled) {
      toast({
        title: 'Model Already Installed',
        description: `The ${selectedModel.name} model is already installed on your system`,
        duration: 3000,
      });
      return;
    }

    setIsDownloading(true);
    try {
      const success = await window.extendr.extensions['whisper-x-downloader'][
        'whisperx:downloadModel'
      ](selectedModel.name);

      if (success) {
        toast({
          variant: 'success',
          title: 'Model Download Successful',
          description: `Successfully downloaded ${selectedModel.name} model (${selectedModel.size})`,
          duration: 5000,
        });

        // Refresh the models list to update installation status
        await fetchAvailableModels();

        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Model Download Failed',
          description: `Failed to download ${selectedModel.name} model`,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error downloading model:', error);
      toast({
        variant: 'destructive',
        title: 'Download Error',
        description:
          error?.message || String(error) || 'Failed to download model',
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getModelTypeLabel = (model: WhisperModel) => {
    const labels = [];
    if (model.recommended) labels.push('Recommended');
    if (model.englishOnly) labels.push('English Only');
    return labels.length > 0 ? labels.join(' • ') : 'Multilingual';
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-darkModeDropdown border border-gray-200 dark:border-gray-700 rounded-lg pt-6 pr-6 pl-6 pb-4 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-gray-200 flex items-center gap-2">
            <MdDownload size={20} />
            Download Whisper Model
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            disabled={isDownloading}
          >
            <IoMdClose size={20} />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">
              Loading models...
            </span>
          </div>
        )}

        {/* Model Selection */}
        {!isLoading && models.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Model
              </label>
              <select
                value={selectedModel?.name || ''}
                onChange={(e) => {
                  const model = models.find((m) => m.name === e.target.value);
                  setSelectedModel(model || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-darkMode text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={isDownloading}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.size})
                    {model.isInstalled ? ' - Already Installed' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Model Detail*/}
            {selectedModel && (
              <div className="bg-gray-50 dark:bg-darkMode rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MdInfo
                    className="text-blue-500 mt-0.5 flex-shrink-0"
                    size={16}
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {selectedModel.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {selectedModel.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {selectedModel.size}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          selectedModel.recommended
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {getModelTypeLabel(selectedModel)}
                      </span>
                      {selectedModel.isInstalled && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          <MdCheckCircle size={12} className="mr-1" />
                          Installed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-darkModeHover dark:text-gray-200 transition-colors"
                disabled={isDownloading}
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadModel}
                disabled={
                  !selectedModel || isDownloading || selectedModel?.isInstalled
                }
                className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  selectedModel?.isInstalled
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Downloading...
                  </>
                ) : selectedModel?.isInstalled ? (
                  <>✓ Already Installed</>
                ) : (
                  <>
                    <MdDownload size={16} />
                    Download Model
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* No Models Available */}
        {!isLoading && models.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No Whisper models available
            </p>
            <button
              onClick={fetchAvailableModels}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhisperModelDownloadModal;
