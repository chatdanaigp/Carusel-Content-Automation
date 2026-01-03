import React, { useState, useRef } from 'react';
import { generateContentIdeas, generateTradingSlides, generateInfographic } from './services/geminiService';
import { SlideContent, GeneratedImage, WorkflowStatus, ContentIdea, UiDesignStyle, DesignStyle, DownloadMode, SocialConfig, CustomStyleConfig } from './types';
import ApiKeyGuard from './components/ApiKeyGuard';
import SlideCard from './components/SlideCard';
import ImageResult from './components/ImageResult';
import SocialSettings from './components/SocialSettings';

const App: React.FC = () => {
  const [topic, setTopic] = useState('Mindset');
  const [language, setLanguage] = useState<'TH' | 'EN'>('TH');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [status, setStatus] = useState<WorkflowStatus>(WorkflowStatus.IDLE);
  
  // Configuration States
  const [uiDesignStyle, setUiDesignStyle] = useState<UiDesignStyle>('ORIGINAL');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('AUTO');
  
  // Custom Style State
  const [customStyleConfig, setCustomStyleConfig] = useState<CustomStyleConfig>({
    prompt: '',
    referenceImage: null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Social Media Configuration State
  const [socialConfig, setSocialConfig] = useState<SocialConfig>({
    useSameHandle: true,
    masterHandle: 'crt.trader',
    platforms: [
        { id: 'tiktok', name: 'TikTok', iconName: 'TikTok Logo', selected: true, handle: 'crt.trader' },
        { id: 'youtube', name: 'YouTube', iconName: 'YouTube Logo', selected: true, handle: 'crt.trader' },
        { id: 'instagram', name: 'Instagram', iconName: 'Instagram Logo', selected: true, handle: 'crt.trader.official' },
        { id: 'facebook', name: 'Facebook', iconName: 'Facebook Logo', selected: false, handle: '' },
        { id: 'x', name: 'X', iconName: 'X (Twitter) Logo', selected: false, handle: '' },
        { id: 'line', name: 'Line', iconName: 'Line App Logo', selected: false, handle: '' },
    ]
  });
  
  // Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Step 1 Data
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  
  // Step 2 Data
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  // Helper for image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setCustomStyleConfig(prev => ({
                ...prev,
                referenceImage: reader.result as string
            }));
        };
        reader.readAsDataURL(file);
    }
  };

  const clearReferenceImage = () => {
      setCustomStyleConfig(prev => ({ ...prev, referenceImage: null }));
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    
    // Resolve the style for this generation session
    let activeStyle: DesignStyle = 'ORIGINAL';
    if (uiDesignStyle === 'RANDOM') {
        const pool: DesignStyle[] = ['MODERN', 'CYBERPUNK', 'LUXURY', 'MINIMALIST'];
        const randomIndex = Math.floor(Math.random() * pool.length);
        activeStyle = pool[randomIndex];
    } else {
        activeStyle = uiDesignStyle as DesignStyle;
    }

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

      // 2b. Start Image Generation with the resolved style
      await generateImagesSequentially(generatedSlides, activeStyle);

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

  const generateImagesSequentially = async (slideData: SlideContent[], style: DesignStyle) => {
    setStatus(WorkflowStatus.GENERATING_IMAGES);

    // Using a loop to process sequentially to handle auth errors gracefully and rate limits
    for (let i = 0; i < slideData.length; i++) {
        const slide = slideData[i];
        const isTitleSlide = i === 0; // Identify first slide
        
        // Update specific image to loading
        setImages(prev => prev.map(img => 
            img.slideId === slide.id ? { ...img, status: 'loading' } : img
        ));

        let attempts = 0;
        let success = false;
        const maxAttempts = 5;

        while (attempts < maxAttempts && !success) {
            try {
                // Pass content text, isTitleSlide flag, design style AND social config
                const base64Image = await generateInfographic(
                    slide.visualPrompt, 
                    slide.title, 
                    slide.content, 
                    aspectRatio,
                    isTitleSlide,
                    style,
                    socialConfig,
                    customStyleConfig // Pass custom config
                );
                
                setImages(prev => prev.map(img => 
                    img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64Image } : img
                ));
                success = true;

                // Success! Wait a bit before next slide to be nice to rate limiter (pacing)
                // Skip delay on the very last slide
                if (i < slideData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 4000));
                }

            } catch (e: any) {
                // Check for 429 Rate Limit
                const is429 = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || JSON.stringify(e).includes('RESOURCE_EXHAUSTED');
                
                if (is429) {
                    attempts++;
                    // Exponential backoff: 5s, 10s, 15s...
                    const waitTime = 5000 * attempts;
                    console.warn(`Rate limit hit for slide ${slide.id}. Waiting ${waitTime/1000}s before retry ${attempts}/${maxAttempts}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry loop
                }

                // Check for Permission Error
                if (isPermissionError(e) && window.aistudio?.openSelectKey) {
                     try {
                         await window.aistudio.openSelectKey();
                         // Retry with same params immediately after new key selection
                         const base64ImageRetry = await generateInfographic(
                            slide.visualPrompt, 
                            slide.title, 
                            slide.content, 
                            aspectRatio,
                            isTitleSlide,
                            style,
                            socialConfig,
                            customStyleConfig
                         );
                         setImages(prev => prev.map(img => 
                            img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64ImageRetry } : img
                         ));
                         success = true;
                         // Wait after success
                         if (i < slideData.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 4000));
                         }
                     } catch (retryError: any) {
                         if (isPermissionError(retryError)) {
                            setImages(prev => prev.map(img => 
                                img.slideId === slide.id ? { ...img, status: 'error' } : img
                            ));
                            setError("Permission denied. Billing enabled project required.");
                            setStatus(WorkflowStatus.IDLE); 
                            return; // Stop the entire process
                         }
                         console.error(`Retry after permission grant failed for slide ${slide.id}`, retryError);
                     }
                }
                
                if (success) break;

                // If not 429 and not permission error (or permission fix failed), log and break.
                console.error(`Failed to generate image for slide ${slide.id}`, e);
                break;
            }
        }

        if (!success) {
            setImages(prev => prev.map(img => 
                img.slideId === slide.id ? { ...img, status: 'error' } : img
            ));
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

                {/* Controls Container */}
                <div className="flex flex-col gap-6 mb-8 items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                    
                    {/* Top Row: Language & Download Mode */}
                    <div className="flex flex-wrap gap-6 justify-center w-full">
                        {/* Language Selection */}
                        <div className="flex flex-col items-center gap-2">
                            <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Language</label>
                            <div className="bg-slate-800 p-1 rounded-lg border border-slate-600 inline-flex">
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
                        </div>

                         {/* Download Mode */}
                         <div className="flex flex-col items-center gap-2">
                            <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Download Mode</label>
                            <div className="bg-slate-800 p-1 rounded-lg border border-slate-600 inline-flex">
                                <button
                                    onClick={() => setDownloadMode('AUTO')}
                                    disabled={isGenerating}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                        downloadMode === 'AUTO' 
                                        ? 'bg-emerald-600 text-white shadow' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                    Auto
                                </button>
                                <button
                                    onClick={() => setDownloadMode('MANUAL')}
                                    disabled={isGenerating}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                        downloadMode === 'MANUAL' 
                                        ? 'bg-emerald-600 text-white shadow' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    Manual
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-slate-700/50"></div>

                    {/* Middle Row: Design Style */}
                    <div className="flex flex-col items-center gap-2 w-full">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Visual Style</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                             <button
                                onClick={() => setUiDesignStyle('ORIGINAL')}
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center p-3 rounded-lg border transition-all relative overflow-hidden
                                    ${uiDesignStyle === 'ORIGINAL' 
                                        ? 'bg-slate-700 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                                `}
                            >
                                <span className={`font-bold text-sm ${uiDesignStyle === 'ORIGINAL' ? 'text-yellow-400' : 'text-slate-300'}`}>Original</span>
                                <span className="text-[9px] opacity-70 mt-1">Navy & Gold</span>
                            </button>

                            <button
                                onClick={() => setUiDesignStyle('MODERN')}
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center p-3 rounded-lg border transition-all relative overflow-hidden
                                    ${uiDesignStyle === 'MODERN' 
                                        ? 'bg-slate-700 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                                `}
                            >
                                <span className={`font-bold text-sm ${uiDesignStyle === 'MODERN' ? 'text-cyan-300' : 'text-slate-300'}`}>Modern</span>
                                <span className="text-[9px] opacity-70 mt-1">Slate & Neon</span>
                            </button>

                            <button
                                onClick={() => setUiDesignStyle('CUSTOM')}
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center p-3 rounded-lg border transition-all relative overflow-hidden
                                    ${uiDesignStyle === 'CUSTOM' 
                                        ? 'bg-slate-700 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                                `}
                            >
                                <span className={`font-bold text-sm ${uiDesignStyle === 'CUSTOM' ? 'text-pink-400' : 'text-slate-300'}`}>Custom</span>
                                <span className="text-[9px] opacity-70 mt-1">Your Prompt + Ref</span>
                            </button>

                            <button
                                onClick={() => setUiDesignStyle('RANDOM')}
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center p-3 rounded-lg border transition-all relative overflow-hidden
                                    ${uiDesignStyle === 'RANDOM' 
                                        ? 'bg-slate-700 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.2)]' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                                `}
                            >
                                <span className={`font-bold text-sm ${uiDesignStyle === 'RANDOM' ? 'text-purple-300' : 'text-slate-300'}`}>Surprise Me</span>
                                <span className="text-[9px] opacity-70 mt-1">Random Variety</span>
                            </button>
                        </div>
                        
                        {/* CUSTOM STYLE INPUTS */}
                        {uiDesignStyle === 'CUSTOM' && (
                            <div className="w-full max-w-2xl mt-4 bg-slate-900/50 rounded-xl p-4 border border-pink-500/30 animate-fade-in text-left">
                                <h4 className="text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                    Custom Style Configuration
                                </h4>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Style Prompt (Describe the look, colors, vibe)</label>
                                        <textarea
                                            value={customStyleConfig.prompt}
                                            onChange={(e) => setCustomStyleConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                            placeholder="E.g. Vintage newspaper aesthetic, beige background, typewriter font, highly detailed illustrations..."
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-pink-500 min-h-[80px]"
                                            disabled={isGenerating}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Reference Image (Optional - Styles the output based on this)</label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                ref={fileInputRef}
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                id="ref-image-upload"
                                                disabled={isGenerating}
                                            />
                                            <label 
                                                htmlFor="ref-image-upload"
                                                className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-pink-500/50 text-slate-300 text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {customStyleConfig.referenceImage ? 'Change Image' : 'Upload Image'}
                                            </label>

                                            {customStyleConfig.referenceImage && (
                                                <div className="relative group">
                                                    <img 
                                                        src={customStyleConfig.referenceImage} 
                                                        alt="Reference" 
                                                        className="h-10 w-10 object-cover rounded border border-slate-600"
                                                    />
                                                    <button 
                                                        onClick={clearReferenceImage}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600"
                                                        title="Remove"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full h-px bg-slate-700/50"></div>

                    {/* Social Media Settings */}
                    <SocialSettings 
                        config={socialConfig} 
                        onChange={setSocialConfig} 
                        disabled={isGenerating}
                    />

                    <div className="w-full h-px bg-slate-700/50"></div>

                    {/* Bottom Row: Aspect Ratio */}
                    <div className="flex flex-col items-center gap-2 w-full">
                         <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Aspect Ratio</label>
                        <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                            {ratioOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setAspectRatio(opt.id)}
                                    disabled={isGenerating}
                                    className={`
                                        flex flex-col items-center justify-center p-2 rounded-lg border transition-all
                                        ${aspectRatio === opt.id 
                                            ? 'bg-blue-600/20 border-blue-500 text-white' 
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-750'}
                                    `}
                                >
                                    <span className="font-bold text-sm">{opt.label}</span>
                                </button>
                            ))}
                        </div>
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
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-slate-400">{selectedIdea.summary}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
                                {uiDesignStyle === 'RANDOM' ? 'Surprise Style' : uiDesignStyle}
                            </span>
                        </div>
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
                            {img && <ImageResult image={img} downloadMode={downloadMode} onPreview={(url) => setPreviewImage(url)} />}
                        </div>
                        );
                    })}
                </div>
            </div>
          )}

          {/* IMAGE PREVIEW MODAL */}
          {previewImage && (
            <div 
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
                onClick={() => setPreviewImage(null)}
            >
                <div className="relative max-w-5xl w-full max-h-screen flex flex-col items-center">
                    <img 
                        src={previewImage} 
                        alt="Preview" 
                        className="max-h-[85vh] w-auto object-contain rounded-md shadow-2xl border border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="mt-4 flex gap-4" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-full font-bold transition-all"
                        >
                            Close
                        </button>
                        <a 
                            href={previewImage} 
                            download={`trading-slide-preview-${Date.now()}.png`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full font-bold transition-all shadow-lg flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download High Res
                        </a>
                    </div>
                </div>
            </div>
          )}

        </main>
      </div>
    </ApiKeyGuard>
  );
};

export default App;