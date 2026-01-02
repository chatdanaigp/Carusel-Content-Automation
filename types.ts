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

export enum WorkflowStatus {
  IDLE = 'IDLE',
  GENERATING_IDEAS = 'GENERATING_IDEAS',
  IDEAS_READY = 'IDEAS_READY',
  GENERATING_SLIDES = 'GENERATING_SLIDES', // generating text slides
  GENERATING_IMAGES = 'GENERATING_IMAGES', // generating images
  COMPLETED = 'COMPLETED',
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}