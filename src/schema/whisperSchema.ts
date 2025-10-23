export interface WhisperModel {
  name: string;
  size: string;
  description: string;
  englishOnly: boolean;
  recommended: boolean;
  isInstalled?: boolean; // Added to track installation status
}

export interface WhisperModelsResponse {
  success: boolean;
  models: WhisperModel[];
}

export interface InstalledWhisperModel {
  name: string;
  size: string;
  path: string;
}

export interface InstalledWhisperModelsResponse {
  success: boolean;
  models: InstalledWhisperModel[];
}

export interface WhisperModelDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}
