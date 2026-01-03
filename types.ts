

export interface ContentIdea {
  id: number;
  title: string;
  summary: string;
}

export interface SlideContent {
  id: number;
  title: string;
  content: string;
  visualPrompt: string;
}

export interface GeneratedImage {
  slideId: number;
  imageUrl: string; // Base64 data URI
  status: 'pending' | 'loading' | 'success' | 'error';
}

export type DesignStyle = 'ORIGINAL' | 'MODERN' | 'CYBERPUNK' | 'LUXURY' | 'MINIMALIST' | 'CUSTOM';
export type UiDesignStyle = DesignStyle | 'RANDOM';

export interface CustomStyleConfig {
  prompt: string;
  referenceImage: string | null; // Base64 data URI
}

export type DownloadMode = 'AUTO' | 'MANUAL';

export interface SocialPlatform {
  id: string;
  name: string;
  iconName: string; // Used for prompt instruction e.g. "Tiktok Logo"
  selected: boolean;
  handle: string;
}

export interface SocialConfig {
  useSameHandle: boolean;
  masterHandle: string;
  platforms: SocialPlatform[];
}

export enum WorkflowStatus {
  IDLE = 'IDLE',
  GENERATING_IDEAS = 'GENERATING_IDEAS',
  IDEAS_READY = 'IDEAS_READY',
  GENERATING_SLIDES = 'GENERATING_SLIDES', // generating text slides
  GENERATING_IMAGES = 'GENERATING_IMAGES', // generating images
  COMPLETED = 'COMPLETED',
}

export enum CustomTextInputMode {
  KEYWORD = 'KEYWORD',
  CUSTOM_TEXT = 'CUSTOM_TEXT',
}

// FIX: To resolve the "Subsequent property declarations must have the same type" error for 'aistudio',
// and because the error message explicitly indicates that the property expects type 'AIStudio',
// we define the 'AIStudio' interface and then reference it within the global Window interface.
// This ensures a consistent type definition for 'window.aistudio'.
// Update: Inlining the interface definition directly into 'Window' to bypass potential
// subtle conflicts that might arise from named interface merging in complex environments.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
    process?: {
      env: {
        API_KEY?: string;
        REACT_APP_API_KEY?: string; // For Create React App
        [key: string]: string | undefined;
      };
    };
  }
}