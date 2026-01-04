

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
  TRANSLATING_TEXT = 'TRANSLATING_TEXT', // New: for when text is being translated
  COMPLETED = 'COMPLETED',
}

export enum CustomTextInputMode {
  KEYWORD = 'KEYWORD',
  CUSTOM_TEXT = 'CUSTOM_TEXT',
}

// FIX: To resolve the "Subsequent property declarations must have the same type" error for 'aistudio',
// explicitly define the 'AIStudio' interface in the global scope and then use it as the type for 'window.aistudio'.
// This ensures a consistent type definition that aligns with what TypeScript expects,
// resolving conflicts where 'AIStudio' might be expected by other declarations or types.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

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