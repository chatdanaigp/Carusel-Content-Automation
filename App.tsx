import React, { useState } from 'react';
import { generateContentIdeas, generateTradingSlides, generateInfographic } from './services/geminiService';
import { SlideContent, GeneratedImage, WorkflowStatus, ContentIdea } from './types';
import ApiKeyGuard from './components/ApiKeyGuard';
import SlideCard from './components/SlideCard';
import ImageResult from './components/ImageResult';

const App: React.FC = () => {
  const [topic, setTopic] = useState('Mindset');
  const [language, setLanguage] = useState<'TH' | 'EN'>('TH');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [status, setStatus] = useState<WorkflowStatus>(WorkflowStatus.IDLE);
  
  // Step 1 Data
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  
  // Step 2 Data
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  // STEP 1: Generate Ideas
  const handleGenerateIdeas = async () => {
    if (!topic.trim()) return;
    setError(null);
    setStatus(WorkflowStatus.GENERATING_IDEAS);
    setContentIdeas([]);
    setSelectedIdea(null);
    setSlides([]);
    setImages([]);

    try {
      const ideas = await generateContentIdeas(topic, language);
      setContentIdeas(ideas);
      setStatus(WorkflowStatus.IDEAS_READY);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setStatus(WorkflowStatus.IDLE);
    }
  };

  // STEP 2: Select Idea & Generate Slides -> Images
  const handleSelectIdea = async (idea: ContentIdea) => {
    setSelectedIdea(idea);
    setStatus(WorkflowStatus.GENERATING_SLIDES);
    
    try {
      // 2a. Generate Text Slides
      const generatedSlides = await generateTradingSlides(idea, language);
      setSlides(generatedSlides);
      
      // Initialize image placeholders
      const initialImages: GeneratedImage[] = generatedSlides.map(s => ({
        slideId: s.id,
        imageUrl: '',
        status: 'pending'
      }));
      setImages(initialImages);

      // 2b. Start Image Generation
      await generateImagesSequentially(generatedSlides);

    } catch (err) {
       console.error(err);
       setError(err instanceof Error ? err.message : 'Error generating content');
       setStatus(WorkflowStatus.IDLE);
    }
  };

  const isPermissionError = (err: any): boolean => {
    try {
        const str = typeof err === 'string' ? err : JSON.stringify(err);
        const msg = err?.message || '';
        return str.includes('403') || 
               str.includes('PERMISSION_DENIED') || 
               msg.includes('403') || 
               msg.includes('PERMISSION_DENIED');
    } catch (e) {
        return false;
    }
  };

  const generateImagesSequentially = async (slideData: SlideContent[]) => {
    setStatus(WorkflowStatus.GENERATING_IMAGES);

    // Using a loop to process sequentially to handle auth errors gracefully
    for (let i = 0; i < slideData.length; i++) {
        const slide = slideData[i];
        const isTitleSlide = i === 0; // Identify first slide
        
        // Update specific image to loading
        setImages(prev => prev.map(img => 
            img.slideId === slide.id ? { ...img, status: 'loading' } : img
        ));

        try {
            // Pass content text and isTitleSlide flag
            const base64Image = await generateInfographic(
                slide.visualPrompt, 
                slide.title, 
                slide.content, 
                aspectRatio,
                isTitleSlide
            );
            
            setImages(prev => prev.map(img => 
                img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64Image } : img
            ));
        } catch (e: any) {
            console.error(`Failed to generate image for slide ${slide.id}`, e);
            
            let retrySuccess = false;

            if (isPermissionError(e) && window.aistudio?.openSelectKey) {
                 try {
                     await window.aistudio.openSelectKey();
                     // Retry with same params
                     const base64ImageRetry = await generateInfographic(
                        slide.visualPrompt, 
                        slide.title, 
                        slide.content, 
                        aspectRatio,
                        isTitleSlide
                     );
                     setImages(prev => prev.map(img => 
                        img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64ImageRetry } : img
                     ));
                     retrySuccess = true;
                 } catch (retryError: any) {
                     if (isPermissionError(retryError)) {
                        setImages(prev => prev.map(img => 
                            img.slideId === slide.id ? { ...img, status: 'error' } : img
                        ));
                        setError("Permission denied. Billing enabled project required.");
                        setStatus(WorkflowStatus.IDLE); 
                        return; 
                     }
                 }
            }

            if (!retrySuccess) {
                setImages(prev => prev.map(img => 
                    img.slideId === slide.id ? { ...img, status: 'error' } : img
                ));
            }
        }
    }
    
    setStatus(WorkflowStatus.COMPLETED);
  };

  const handleChangeKey = async () => {
      if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
      } else {
          alert("API Key selection is not available in this environment.");
      }
  };

  // UI Helpers
  const isGenerating = status === WorkflowStatus.GENERATING_IDEAS || status === WorkflowStatus.GENERATING_SLIDES || status === WorkflowStatus.GENERATING_IMAGES;
  
  const ratioOptions = [
      { id: '1:1', label: 'Square (1:1)', desc: '1080x1080px' },
      { id: '3:4', label: 'Portrait (3:4)', desc: '1080x1350px' },
      { id: '9:16', label: 'Story (9:16)', desc: '1080x1920px' },
  ];

  return (
    <ApiKeyGuard>
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
        
        {/* Header */}
        <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                G
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                TradingFlow AI
              </h1>
            </div>
            <div className="flex items-center gap-4">
                 <button 
                    onClick={handleChangeKey}
                    className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1 rounded transition-all"
                 >
                    Change API Key
                 </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          
          {/* STEP 1: Input & Configuration */}
          <div className="max-w-3xl mx-auto mb-12 text-center">
            
            {!selectedIdea && (
                <>
                <h2 className="text-3xl font-bold mb-4">Content Idea Generator</h2>
                <p className="text-slate-400 mb-8">
                Enter a keyword to generate catchy trading content ideas (Step 1 of 2)
                </p>

                {/* Controls */}
                <div className="flex flex-col gap-4 mb-6 items-center">
                    {/* Language Selection */}
                    <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 inline-flex">
                        <button
                        onClick={() => setLanguage('TH')}
                        disabled={isGenerating}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            language === 'TH' 
                            ? 'bg-blue-600 text-white shadow' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        >
                        Thai 🇹🇭
                        </button>
                        <button
                        onClick={() => setLanguage('EN')}
                        disabled={isGenerating}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            language === 'EN' 
                            ? 'bg-blue-600 text-white shadow' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        >
                        English 🇺🇸
                        </button>
                    </div>

                    {/* Aspect Ratio Selection */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                        {ratioOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setAspectRatio(opt.id)}
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                                    ${aspectRatio === opt.id 
                                        ? 'bg-blue-600/20 border-blue-500 text-white' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-750'}
                                `}
                            >
                                <span className="font-bold text-sm">{opt.label}</span>
                                <span className="text-[10px] opacity-70">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 p-2 bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
                <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter keyword (e.g. Mindset, Risk, Sniper Entry)"
                    disabled={isGenerating}
                    className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-white placeholder-slate-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
                />
                <button
                    onClick={handleGenerateIdeas}
                    disabled={isGenerating || !topic.trim()}
                    className={`
                    px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
                    ${!isGenerating && topic.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    {status === WorkflowStatus.GENERATING_IDEAS ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Thinking...
                        </>
                    ) : (
                        <>
                            <span>Generate Ideas</span>
                        </>
                    )}
                </button>
                </div>
                </>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    <strong>Error:</strong> {error}
                </div>
            )}
          </div>

          {/* STEP 2: Display & Select Ideas */}
          {status === WorkflowStatus.IDEAS_READY && contentIdeas.length > 0 && !selectedIdea && (
            <div className="animate-fade-in">
                 <h3 className="text-xl font-bold mb-6 text-center text-slate-200">Select a Content Direction</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    {contentIdeas.map((idea) => (
                        <button
                            key={idea.id}
                            onClick={() => handleSelectIdea(idea)}
                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 p-6 rounded-xl text-left transition-all hover:scale-[1.01] hover:shadow-xl group"
                        >
                            <h4 className="text-lg font-bold text-white group-hover:text-blue-400 mb-2">{idea.title}</h4>
                            <p className="text-slate-400 text-sm">{idea.summary}</p>
                            <div className="mt-4 text-xs font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                Select this idea &rarr;
                            </div>
                        </button>
                    ))}
                 </div>
            </div>
          )}

          {/* STEP 3: Workflow Progress & Results */}
          {selectedIdea && (
            <div className="animate-fade-in">
                 {/* Workflow Header */}
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                    <div>
                        <button 
                            onClick={() => {
                                setSelectedIdea(null);
                                setStatus(WorkflowStatus.IDEAS_READY);
                            }}
                            className="text-xs text-slate-500 hover:text-white mb-1 flex items-center gap-1"
                        >
                            &larr; Back to Ideas
                        </button>
                        <h2 className="text-2xl font-bold text-white">{selectedIdea.title}</h2>
                        <p className="text-sm text-slate-400">{selectedIdea.summary}</p>
                    </div>
                    
                    {/* Progress Badge */}
                    <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
                        {status === WorkflowStatus.GENERATING_SLIDES && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"/>}
                        {status === WorkflowStatus.GENERATING_IMAGES && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>}
                        {status === WorkflowStatus.COMPLETED && <span className="w-2 h-2 rounded-full bg-emerald-500"/>}
                        
                        <span className="text-xs font-mono font-bold uppercase">
                            {status === WorkflowStatus.GENERATING_SLIDES && "Generating Content..."}
                            {status === WorkflowStatus.GENERATING_IMAGES && "Creating Graphics..."}
                            {status === WorkflowStatus.COMPLETED && "Done"}
                        </span>
                    </div>
                 </div>

                 {/* Results */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Placeholders while generating text */}
                    {status === WorkflowStatus.GENERATING_SLIDES && (
                        Array.from({length: 4}).map((_, i) => (
                             <div key={i} className="aspect-[3/4] bg-slate-800/50 rounded-lg animate-pulse border border-slate-800"></div>
                        ))
                    )}

                    {/* Real Results */}
                    {slides.map((slide) => {
                        const img = images.find(i => i.slideId === slide.id);
                        return (
                        <div key={slide.id} className="flex flex-col gap-4">
                            <SlideCard slide={slide} />
                            {img && <ImageResult image={img} />}
                        </div>
                        );
                    })}
                </div>
            </div>
          )}

        </main>
      </div>
    </ApiKeyGuard>
  );
};

export default App;