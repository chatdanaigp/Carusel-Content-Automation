import React, { useEffect } from 'react';
import { GeneratedImage } from '../types';

interface ImageResultProps {
  image: GeneratedImage;
}

const ImageResult: React.FC<ImageResultProps> = ({ image }) => {
  // Auto-download when status becomes success
  useEffect(() => {
    if (image.status === 'success' && image.imageUrl) {
      const link = document.createElement('a');
      link.href = image.imageUrl;
      link.download = `trading-slide-${image.slideId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [image.status, image.imageUrl, image.slideId]);

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
          <img 
            src={image.imageUrl} 
            alt={`Slide ${image.slideId}`} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <a 
              href={image.imageUrl} 
              download={`trading-slide-${image.slideId}.png`}
              className="bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              Download Again
            </a>
          </div>
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
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
