import React, { useEffect } from 'react';
import { GeneratedImage, DownloadMode } from '../types';

interface ImageResultProps {
  image: GeneratedImage;
  downloadMode: DownloadMode;
  onPreview: (imageUrl: string) => void;
}

const ImageResult: React.FC<ImageResultProps> = ({ image, downloadMode, onPreview }) => {
  // Auto-download logic
  useEffect(() => {
    if (downloadMode === 'AUTO' && image.status === 'success' && image.imageUrl) {
      const link = document.createElement('a');
      link.href = image.imageUrl;
      link.download = `trading-slide-${image.slideId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [image.status, image.imageUrl, image.slideId, downloadMode]);

  return (
    <div className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md">
      {image.status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-blue-400 font-mono animate-pulse">GENERATING...</p>
        </div>
      )}
      
      {image.status === 'success' ? (
        <>
          {/* Image is now clickable for preview */}
          <img 
            src={image.imageUrl} 
            alt={`Slide ${image.slideId}`} 
            className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={() => onPreview(image.imageUrl)}
          />
          
          {/* Overlay controls - always allow manual download */}
          <div 
            className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-2 pointer-events-none ${downloadMode === 'AUTO' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
          >
             {/* We wrap buttons in pointer-events-auto to make them clickable despite parent pointer-events-none */}
            <a 
              href={image.imageUrl} 
              download={`trading-slide-${image.slideId}.png`}
              className="pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg transform hover:scale-105 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()} 
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
             <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(image.imageUrl);
              }}
              className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg transform hover:scale-105 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          </div>
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none">
            DONE
          </div>
        </>
      ) : image.status === 'error' ? (
        <div className="flex items-center justify-center h-full text-red-400 text-sm p-4 text-center">
          Failed to generate image.
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Waiting...
        </div>
      )}
    </div>
  );
};

export default ImageResult;