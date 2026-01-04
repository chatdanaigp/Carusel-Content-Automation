import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react'; // Added forwardRef, useImperativeHandle
import { GeneratedImage, DownloadMode } from '../types';
import html2canvas from 'html2canvas'; // Import html2canvas

interface ImageResultProps {
  image: GeneratedImage;
  downloadMode: DownloadMode;
  onPreview: (imageUrl: string) => void;
  aspectRatio: string;
  // New props for editing
  currentVisualPrompt: string; // The original visual prompt for the slide
  onRepromptImage: (slideId: number, newPrompt: string) => Promise<void>;
  onApplyStyleToAll: (sourceSlideId: number) => Promise<void>;
  isGeneratingAll: boolean; // Indicates if the overall workflow is in the GENERATING_IMAGES phase
  slideTitle: string; // New: pass slide title for combined export
  slideContent: string; // New: pass slide content for combined export
  currentLanguage: 'TH' | 'EN'; // New: pass current language for combined export
}

// Use forwardRef to allow parent components to access DOM node or methods
const ImageResult = forwardRef<HTMLDivElement & { exportToPngWithText?: () => Promise<string | null> }, ImageResultProps>(({ 
  image, 
  downloadMode, 
  onPreview, 
  aspectRatio,
  currentVisualPrompt,
  onRepromptImage,
  onApplyStyleToAll,
  isGeneratingAll,
  slideTitle, // Destructure new prop
  slideContent, // Destructure new prop
  currentLanguage, // Destructure new prop
}, ref) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(currentVisualPrompt);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Ref for the hidden container to capture with html2canvas
  const hiddenCanvasContainerRef = useRef<HTMLDivElement>(null); 

  // Update editedPrompt if the original visualPrompt changes from parent
  useEffect(() => {
    setEditedPrompt(currentVisualPrompt);
  }, [currentVisualPrompt]);

  // Expose exportToPngWithText function to parent via ref
  useImperativeHandle(ref, () => ({
    exportToPngWithText: async () => {
      if (hiddenCanvasContainerRef.current) {
        try {
          // Ensure the image has loaded within the hidden container before capturing
          const imgElement = hiddenCanvasContainerRef.current.querySelector('img');
          if (imgElement && !imgElement.complete) {
            await new Promise(resolve => { imgElement.onload = resolve; });
          }

          const canvas = await html2canvas(hiddenCanvasContainerRef.current, {
            useCORS: true, // Required if images are from different origin
            allowTaint: true, // Allow images to be "tainted" on the canvas
            backgroundColor: null, // Transparent background if not explicitly set
            scale: 2, // Increase resolution for better quality
          });
          return canvas.toDataURL('image/png');
        } catch (error) {
          console.error("Error capturing element to PNG:", error);
          return null;
        }
      }
      return null;
    }
  }), [image.imageUrl, slideTitle, slideContent, aspectRatio, hiddenCanvasContainerRef]);


  // Auto-download logic
  useEffect(() => {
    // Image should download automatically as soon as it's a success, regardless of batch generation status
    // And if downloadMode is 'AUTO', regardless of currentLanguage
    if (downloadMode === 'AUTO' && image.status === 'success' && image.imageUrl) {
        const performDownload = async () => {
            let downloadUrl = image.imageUrl;

            // Always use exportToPngWithText for auto-download if we have text to overlay
            if (hiddenCanvasContainerRef.current && slideTitle && slideContent) {
                try {
                    const canvas = await html2canvas(hiddenCanvasContainerRef.current, { 
                      useCORS: true, 
                      allowTaint: true, 
                      backgroundColor: null,
                      scale: 2, // Double resolution for download
                    });
                    downloadUrl = canvas.toDataURL('image/png');
                } catch (error) {
                    console.error("Error generating combined image for auto-download:", error);
                    // Fallback to original image if combination fails
                }
            }
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `trading-slide-${image.slideId}-${currentLanguage}-${Date.now()}.png`; // Include language in filename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        performDownload();
    }
  }, [image.status, image.imageUrl, image.slideId, downloadMode, slideTitle, slideContent, currentLanguage]);

  const getAspectClass = () => {
    switch (aspectRatio) {
      case '3:4': return 'aspect-[3/4]';
      case '4:5': return 'aspect-[4/5]'; 
      case '9:16': return 'aspect-[9/16]';
      case '1:1': return 'aspect-square';
      default: return 'aspect-square';
    }
  };

  const handleSaveEdit = async () => {
    if (!editedPrompt.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onRepromptImage(image.slideId, editedPrompt);
      setIsEditingPrompt(false);
    } catch (error) {
      console.error("Failed to re-prompt image:", error);
      // Optionally show an an error message to the user
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApplyStyle = async () => {
    if (isGeneratingAll) return;
    try {
      await onApplyStyleToAll(image.slideId);
    } catch (error) {
      console.error("Failed to apply style to all images:", error);
      // Optionally show an error message
    }
  };

  const renderStatusOverlay = () => {
    // Show overlay if this specific image is loading,
    // or if it's pending AND part of an ongoing batch generation.
    // Do NOT show overlay if status is success or error.
    if (image.status === 'loading') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-blue-400 font-mono animate-pulse">
            GENERATING...
          </p>
        </div>
      );
    }
    if (image.status === 'pending' && isGeneratingAll) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-slate-400 font-mono animate-pulse">
            WAITING...
          </p>
        </div>
      );
    }
    return null; // No overlay for success, error, or if not actively generating/waiting
  };

  return (
    <div className="relative">
      <div 
        className={`group relative ${getAspectClass()} bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md transition-all duration-300`}
      >
        {renderStatusOverlay()}
        
        {image.status === 'success' ? (
          <>
            <img 
              src={image.imageUrl} 
              alt={`Slide ${image.slideId}`} 
              className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
              onClick={() => onPreview(image.imageUrl)}
              crossOrigin="anonymous" // Required for html2canvas (even if for hidden container)
            />
            
            {/* Overlay controls */}
            <div 
              className={`absolute inset-0 bg-black/40 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none ${downloadMode === 'AUTO' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
            >
              <div className="flex gap-2">
                <a 
                  href={image.imageUrl} // Default href, will be overridden by onClick
                  download={`trading-slide-${image.slideId}-${currentLanguage}-${Date.now()}.png`} // Updated filename with language
                  className="pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg transform hover:scale-105 flex items-center gap-2"
                  onClick={async (e) => { 
                    e.stopPropagation();
                    // On click, use the exposed ref method to get the combined image if available
                    if (ref && 'current' in ref && ref.current && typeof ref.current.exportToPngWithText === 'function') {
                        const exportedDataUrl = await ref.current.exportToPngWithText();
                        if (exportedDataUrl) {
                            const link = document.createElement('a');
                            link.href = exportedDataUrl;
                            link.download = `trading-slide-${image.slideId}-${currentLanguage}-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else {
                            console.error(`Failed to export combined image for slide ${image.slideId}, falling back to original image.`);
                            // Fallback to original image if combination fails
                            window.open(image.imageUrl, '_blank'); // Open in new tab
                        }
                    } else {
                        // Fallback: direct download of the original image URL
                        const link = document.createElement('a');
                        link.href = image.imageUrl;
                        link.download = `trading-slide-${image.slideId}-${currentLanguage}-${Date.now()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                  }} 
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
              
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditingPrompt(true); }}
                className="pointer-events-auto bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg transform hover:scale-105 flex items-center gap-2 mt-2"
                disabled={isGeneratingAll} // Disable if overall generation is active (e.g., translation)
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Image
              </button>
              {image.status === 'success' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleApplyStyle(); }}
                  disabled={isGeneratingAll}
                  className="pointer-events-auto bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg transform hover:scale-105 flex items-center gap-2 mt-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 2v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Apply this style to all
                </button>
              )}
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

      {/* HIDDEN container for html2canvas to combine image and text for download */}
      {/* This DIV is NEVER displayed to the user. It is only for canvas capture. */}
      <div 
        ref={hiddenCanvasContainerRef} 
        className={getAspectClass()} 
        style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1, width: '100%', height: '100%' }}
      >
        <img 
          src={image.imageUrl} 
          alt={`Slide ${image.slideId} - base`} 
          className="w-full h-full object-cover" 
          crossOrigin="anonymous" 
        />
        {/* Text overlay for html2canvas capture */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white font-sans text-center"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.6)', // Add subtle shadow for readability
          }}
        >
          <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 p-2 leading-tight bg-black/30 rounded-md">
            {slideTitle}
          </h3>
          <p className="text-sm md:text-base lg:text-lg mt-2 p-2 leading-relaxed bg-black/30 rounded-md max-w-[80%]">
            {slideContent}
          </p>
        </div>
      </div>


      {/* Edit Prompt Modal */}
      {isEditingPrompt && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsEditingPrompt(false)}>
          <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">Edit Visual Prompt for Slide {image.slideId}</h3>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
              placeholder="Describe the image you want to see for this slide..."
              disabled={isSavingEdit}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setIsEditingPrompt(false)}
                disabled={isSavingEdit}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editedPrompt.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors flex items-center gap-2"
              >
                {isSavingEdit && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                )}
                Save & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ImageResult;