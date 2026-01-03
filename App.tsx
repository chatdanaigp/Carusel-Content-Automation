import React, { useState, useRef } from 'react';
import { generateContentIdeas, generateTradingSlides, generateInfographic, generateVisualPrompt, TEXT_MODEL, INTERNAL_IMAGE_MODEL_FALLBACK } from './services/geminiService';
import { SlideContent, GeneratedImage, WorkflowStatus, ContentIdea, UiDesignStyle, DesignStyle, DownloadMode, SocialConfig, CustomStyleConfig, CustomTextInputMode } from './types';
import SlideCard from './components/SlideCard';
import ImageResult from './components/ImageResult';
import SocialSettings from './components/SocialSettings';

const App: React.FC = () => {
  const [topic, setTopic] = useState('Mindset');
  const [language, setLanguage] = useState<'TH' | 'EN'>('TH');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [status, setStatus] = useState<WorkflowStatus>(WorkflowStatus.IDLE);
  
  // New State for custom input
  const [inputMode, setInputMode] = useState<CustomTextInputMode>(CustomTextInputMode.KEYWORD);
  const [customTextInput, setCustomTextInput] = useState('');

  // Configuration States
  const [uiDesignStyle, setUiDesignStyle] = useState<UiDesignStyle>('ORIGINAL');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('AUTO');
  const [imageModel, setImageModel] = useState<'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'>('gemini-2.5-flash-image');
  
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

  const handleResetWorkflow = () => {
    setTopic('Mindset');
    setLanguage('TH');
    setAspectRatio('1:1');
    setStatus(WorkflowStatus.IDLE);
    setInputMode(CustomTextInputMode.KEYWORD);
    setCustomTextInput('');
    setUiDesignStyle('ORIGINAL');
    setDownloadMode('AUTO');
    setImageModel('gemini-2.5-flash-image');
    setCustomStyleConfig({ prompt: '', referenceImage: null });
    setSocialConfig({
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
    setPreviewImage(null);
    setContentIdeas([]);
    setSelectedIdea(null);
    setSlides([]);
    setImages([]);
    setError(null);
  };


  // Helper to parse custom text input
  const parseCustomSlidesInput = (text: string): { slideTitle: string; slideContent: string }[] => {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const parsedSlides: { slideTitle: string; slideContent: string }[] = [];

      // --- 1. Identify "Slide X" markers and their content blocks ---
      const slideBlocks: { markerLine: string; contentLines: string[] }[] = [];
      let currentContentBlock: string[] = [];
      let currentMarkerLine: string | null = null;
      let firstSlideMarkerIndex = -1;

      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/^Slide \d+.*$/i)) {
              if (firstSlideMarkerIndex === -1) {
                  firstSlideMarkerIndex = i; // Mark the beginning of numbered slides
              }
              // If we have accumulated content for a previous slide, push it
              if (currentMarkerLine !== null) {
                  slideBlocks.push({
                      markerLine: currentMarkerLine,
                      contentLines: currentContentBlock,
                  });
              }
              // Start a new slide block
              currentMarkerLine = line;
              currentContentBlock = [];
          } else {
              currentContentBlock.push(line);
          }
      }

      // Push the last accumulated slide block
      if (currentMarkerLine !== null) {
          slideBlocks.push({
              markerLine: currentMarkerLine,
              contentLines: currentContentBlock,
          });
      }

      // --- 2. Process Cover Slide (content before the first "Slide X" marker) ---
      if (firstSlideMarkerIndex > 0) { // If there's content before the first "Slide X"
          const coverContentLines = lines.slice(0, firstSlideMarkerIndex);
          const coverContent = coverContentLines.filter(Boolean).join('\n').trim();
          if (coverContent) {
              parsedSlides.push({
                  slideTitle: coverContent.split('\n')[0] || "Cover Slide", // First line as title
                  slideContent: coverContent,
              });
          }
      } else if (firstSlideMarkerIndex === -1 && lines.length > 0) {
          // If no "Slide X" markers at all, treat the whole input as cover
          const coverContent = lines.filter(Boolean).join('\n').trim();
          if (coverContent) {
              parsedSlides.push({
                  slideTitle: coverContent.split('\n')[0] || "Cover Slide",
                  slideContent: coverContent,
              });
          }
      }


      // --- 3. Process Numbered Slides ---
      for (const block of slideBlocks) {
          const fullContent = block.contentLines.filter(Boolean).join('\n').trim();
          let slideTitle = block.markerLine.replace(/^Slide \d+\s*[:-]?\s*/i, '').trim(); // Try to get title from marker
          if (!slideTitle && fullContent) {
              slideTitle = fullContent.split('\n')[0]; // Fallback: first line of content
          }
          if (!slideTitle) {
              slideTitle = `Slide ${parsedSlides.length + 1}`; // Final fallback
          }
          
          parsedSlides.push({
              slideTitle: slideTitle,
              slideContent: fullContent,
          });
      }

      // --- 4. Assign 1-based IDs ---
      return parsedSlides.map((slide, index) => ({
        ...slide,
        id: index + 1
      }));
  };

  // STEP 1: Generate Ideas / Process Custom Content
  const handleGenerateContent = async () => {
    setError(null);
    setSlides([]);
    setImages([]);
    setSelectedIdea(null); // Clear selected idea

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
      if (inputMode === CustomTextInputMode.KEYWORD) {
        if (!topic.trim()) return;
        setStatus(WorkflowStatus.GENERATING_IDEAS);
        setContentIdeas([]);
        const ideas = await generateContentIdeas(topic, language);
        setContentIdeas(ideas);
        setStatus(WorkflowStatus.IDEAS_READY);
      } else { // CustomTextInputMode.CUSTOM_TEXT
        if (!customTextInput.trim()) {
            setError('Please enter your custom slide content.');
            setStatus(WorkflowStatus.IDLE); // Added to clear status if input is empty
            return;
        }
        setStatus(WorkflowStatus.GENERATING_SLIDES); // Directly generate slides
        
        const parsedSlides = parseCustomSlidesInput(customTextInput);
        if (parsedSlides.length === 0) {
            setError('No valid slides found in your custom content. Please check the format.');
            setStatus(WorkflowStatus.IDLE);
            return;
        }

        // Generate visual prompts for each custom slide
        const slidesWithVisualPrompts: SlideContent[] = [];
        for (let i = 0; i < parsedSlides.length; i++) {
            const slide = parsedSlides[i];
            const visualPrompt = await generateVisualPrompt(slide.slideTitle, slide.slideContent);
            slidesWithVisualPrompts.push({
                id: i + 1, // Start IDs from 1 for display
                title: slide.slideTitle,
                // FIX: Correctly map 'slideContent' to 'content' for the SlideContent interface.
                content: slide.slideContent, 
                visualPrompt: visualPrompt,
            });
            // Add a small delay between visual prompt generations to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setSlides(slidesWithVisualPrompts);

        // Treat custom content as a "selected idea" to proceed to image generation
        setSelectedIdea({ 
            id: 0, 
            title: parsedSlides[0]?.slideTitle || "Custom Content Workflow", // Use the first slide's title as the overall idea title
            summary: `Generated ${slidesWithVisualPrompts.length} slides from your input.` 
        });

        const initialImages: GeneratedImage[] = slidesWithVisualPrompts.map(s => ({
            slideId: s.id,
            imageUrl: '',
            status: 'pending'
        }));
        setImages(initialImages);
        
        await generateImagesSequentially(slidesWithVisualPrompts, activeStyle, imageModel);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setStatus(WorkflowStatus.IDLE);
    }
  };

  // STEP 2: Select Idea & Generate Slides -> Images (called for keyword mode)
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
      await generateImagesSequentially(generatedSlides, activeStyle, imageModel);

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

  const generateImagesSequentially = async (slideData: SlideContent[], style: DesignStyle, selectedModel: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview', currentCustomConfig?: CustomStyleConfig) => {
    setStatus(WorkflowStatus.GENERATING_IMAGES);

    // Using a loop to process sequentially to handle auth errors gracefully and rate limits
    for (let i = 0; i < slideData.length; i++) {
        const slide = slideData[i];
        // isTitleSlide is true if it's the very first slide in the sequence (id === 1)
        const isTitleSlide = (slide.id === 1); 
        
        // Update specific image to loading
        setImages(prev => prev.map(img => 
            img.slideId === slide.id ? { ...img, status: 'loading' } : img
        ));

        let attempts = 0;
        let success = false;
        const maxAttempts = 5;

        while (attempts < maxAttempts && !success) {
            try {
                // Determine which custom config to use: a new one for global style apply, or the current state's
                const configToUse = currentCustomConfig || customStyleConfig;
                
                // Pass content text, isTitleSlide flag, design style AND social config
                const base64Image = await generateInfographic(
                    slide.visualPrompt, 
                    slide.title, 
                    slide.content, 
                    aspectRatio,
                    isTitleSlide,
                    style,
                    socialConfig,
                    configToUse,
                    selectedModel // Pass the selected image model
                );
                
                setImages(prev => prev.map(img => 
                    img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64Image } : img
                ));
                success = true;

                // Success! Wait a bit before next slide to be nice to rate limiter (pacing)
                // Skip delay on the very last slide
                if (i < slideData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // Increased from 4000 to 10000 for Free Tier safety
                }

            } catch (e: any) {
                // Check for 429 Rate Limit or 503 Service Unavailable
                const is429 = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || JSON.stringify(e).includes('RESOURCE_EXHAUSTED');
                const is503 = e.message?.includes('503') || e.message?.includes('Unavailable');
                
                if (is429 || is503) {
                    attempts++;
                    // Exponential backoff: 10s, 20s, 30s... (Increased from 5s)
                    const waitTime = 10000 * attempts;
                    const errorType = is429 ? "Rate limit" : "Service unavailable";
                    console.warn(`${errorType} for slide ${slide.id}. Waiting ${waitTime/1000}s before retry ${attempts}/${maxAttempts}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry loop
                }

                // Check for Permission Error
                // Per guidelines, API key selection is handled via window.aistudio if available.
                // If a permission error occurs AND window.aistudio.openSelectKey is available, prompt for key re-selection.
                if (isPermissionError(e) && window.aistudio?.openSelectKey) {
                     try {
                         console.warn(`Permission error for slide ${slide.id}. Prompting user to re-select API key via AI Studio...`);
                         await window.aistudio.openSelectKey();
                         // Per race condition guideline: assume key selection was successful and proceed.
                         // Do not add delay. The next iteration/retry of generateInfographic will pick up the updated process.env.API_KEY.
                         
                         // We must retry the *entire* call with the potentially new API key.
                         const base64ImageRetry = await generateInfographic(
                            slide.visualPrompt, 
                            slide.title, 
                            slide.content, 
                            aspectRatio,
                            isTitleSlide,
                            style,
                            socialConfig,
                            (currentCustomConfig || customStyleConfig),
                            selectedModel 
                         );
                         setImages(prev => prev.map(img => 
                            img.slideId === slide.id ? { ...img, status: 'success', imageUrl: base64ImageRetry } : img
                         ));
                         success = true;
                         if (i < slideData.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 10000));
                         }
                     } catch (retryError: any) {
                         // If re-selection itself fails or the subsequent retry still gets permission denied.
                         if (isPermissionError(retryError)) {
                            setImages(prev => prev.map(img => 
                                img.slideId === slide.id ? { ...img, status: 'error' } : img
                            ));
                            setError("Permission denied even after API key selection. Ensure a billing-enabled project is used.");
                            setStatus(WorkflowStatus.IDLE); 
                            return; // Stop the entire process
                         }
                         console.error(`Retry after permission grant failed for slide ${slide.id}`, retryError);
                     }
                }
                
                if (success) break;

                // If not 429/503 and not permission error (or permission fix failed), log and break.
                console.error(`Failed to generate image for slide ${slide.id}:`, e);
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

  const handleRepromptImage = async (slideId: number, newPrompt: string) => {
    setError(null);
    setSlides(prevSlides => prevSlides.map(s => s.id === slideId ? { ...s, visualPrompt: newPrompt } : s));
    setImages(prevImages => prevImages.map(img => img.slideId === slideId ? { ...img, status: 'loading' } : img));

    try {
        const targetSlide = slides.find(s => s.id === slideId);
        if (!targetSlide) throw new Error("Slide not found for reprompt.");

        let activeStyle: DesignStyle = 'ORIGINAL';
        if (uiDesignStyle === 'RANDOM') {
            const pool: DesignStyle[] = ['MODERN', 'CYBERPUNK', 'LUXURY', 'MINIMALIST'];
            const randomIndex = Math.floor(Math.random() * pool.length);
            activeStyle = pool[randomIndex];
        } else {
            activeStyle = uiDesignStyle as DesignStyle;
        }

        const isTitleSlide = slideId === 1; // Assuming first slide is always id 1
        const base64Image = await generateInfographic(
            newPrompt,
            targetSlide.title,
            targetSlide.content,
            aspectRatio,
            isTitleSlide,
            activeStyle,
            socialConfig,
            customStyleConfig,
            imageModel // Pass the selected image model
        );

        setImages(prevImages => prevImages.map(img => 
            img.slideId === slideId ? { ...img, status: 'success', imageUrl: base64Image } : img
        ));
    } catch (e: any) {
        console.error("Error reprompting image:", e);
        setError(e instanceof Error ? e.message : 'Failed to regenerate image with new prompt.');
        setImages(prevImages => prevImages.map(img => img.slideId === slideId ? { ...img, status: 'error' } : img));
    }
  };

  const handleApplyStyleToAll = async (sourceSlideId: number) => {
    setError(null);
    setStatus(WorkflowStatus.GENERATING_IMAGES); // Indicate re-generation of all images

    const sourceImage = images.find(img => img.slideId === sourceSlideId);
    const sourceSlide = slides.find(s => s.id === sourceSlideId);

    if (!sourceImage || !sourceImage.imageUrl || !sourceSlide) {
      setError("Could not find source image or slide to apply style from.");
      setStatus(WorkflowStatus.IDLE);
      return;
    }

    // Update custom style config based on the source image/prompt
    const newCustomStyleConfig: CustomStyleConfig = {
      referenceImage: sourceImage.imageUrl,
      prompt: sourceSlide.visualPrompt, // Use the visual prompt of the source slide
    };

    setUiDesignStyle('CUSTOM'); // Force custom style mode
    setCustomStyleConfig(newCustomStyleConfig); // Set new custom config

    // Regenerate all images with the new custom style
    // The generateImagesSequentially function will pick up the updated customStyleConfig
    // Note: It's important to pass newCustomStyleConfig directly if state updates are asynchronous
    await generateImagesSequentially(slides, 'CUSTOM', imageModel, newCustomStyleConfig);
  };


  // UI Helpers
  const isGenerating = status === WorkflowStatus.GENERATING_IDEAS || status === WorkflowStatus.GENERATING_SLIDES || status === WorkflowStatus.GENERATING_IMAGES;
  const isGeneratingAllImages = status === WorkflowStatus.GENERATING_IMAGES; // To disable controls during global re-generation
  
  const ratioOptions = [
      { id: '1:1', label: 'Square (1:1)', desc: '1080x1080px' },
      { id: '4:5', label: 'Portrait (4:5)', desc: '1080x1350px' }, // Updated to 4:5 1080x1350px
      { id: '9:16', label: 'Story (9:16)', desc: '1080x1920px' },
  ];

  return (
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
            {/* Model names - Updated for minimalist style */}
            <div className="flex items-center gap-4 text-xs font-sans text-slate-400">
                <span>Text: {TEXT_MODEL}</span>
                {/* Removed INTERNAL_IMAGE_MODEL_FALLBACK from UI display, as it's an internal fallback */}
                <span>Image: {imageModel === 'gemini-2.5-flash-image' ? 'Gemini 2.5 Flash' : 'Gemini 3 Pro Image'}</span>
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
                Generate content ideas or directly input custom slide content.
                </p>

                {/* Input Mode Toggle */}
                <div className="flex justify-center mb-6">
                    <div className="bg-slate-800 p-1 rounded-lg border border-slate-600 inline-flex">
                        <button
                            onClick={() => setInputMode(CustomTextInputMode.KEYWORD)}
                            disabled={isGenerating}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                inputMode === CustomTextInputMode.KEYWORD 
                                ? 'bg-indigo-600 text-white shadow' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            Keyword Ideas
                        </button>
                        <button
                            onClick={() => setInputMode(CustomTextInputMode.CUSTOM_TEXT)}
                            disabled={isGenerating}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                inputMode === CustomTextInputMode.CUSTOM_TEXT 
                                ? 'bg-indigo-600 text-white shadow' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            Custom Content
                        </button>
                    </div>
                </div>

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

                    {/* Image Model Selection */}
                    <div className="flex flex-col items-center gap-2 w-full">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Image Model</label>
                        <div className="bg-slate-800 p-1 rounded-lg border border-slate-600 inline-flex">
                            <button
                                onClick={() => setImageModel('gemini-2.5-flash-image')}
                                disabled={isGenerating}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                    imageModel === 'gemini-2.5-flash-image' 
                                    ? 'bg-purple-600 text-white shadow' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <span className="mr-1">🚀</span> Gemini 2.5 Flash (Free)
                            </button>
                            <button
                                onClick={() => setImageModel('gemini-3-pro-image-preview')}
                                disabled={isGenerating}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                    imageModel === 'gemini-3-pro-image-preview' 
                                    ? 'bg-purple-600 text-white shadow' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <span className="mr-1">💎</span> Gemini 3 Pro Image (Paid)
                            </button>
                        </div>
                        {imageModel === 'gemini-3-pro-image-preview' && (
                            <p className="text-[10px] text-orange-400 mt-1">
                                Using Gemini 3 Pro Image requires a Google Cloud project with billing enabled.
                            </p>
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

                {inputMode === CustomTextInputMode.KEYWORD ? (
                    <div className="flex gap-2 p-2 bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
                        <input 
                            type="text" 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter keyword (e.g. Mindset, Risk, Sniper Entry)"
                            disabled={isGenerating}
                            className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-white placeholder-slate-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateContent()}
                        />
                        <button
                            onClick={handleGenerateContent}
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
                ) : (
                    <div className="flex flex-col gap-4 p-2 bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
                        <textarea
                            value={customTextInput}
                            onChange={(e) => setCustomTextInput(e.target.value)}
                            placeholder={`Enter your custom slide content here.
The first line will be the overall carousel title (and cover slide title).

Use "Slide X: [Your Title]" to define new slides, where X is a number.
Content for the slide follows until the next "Slide X" or end of input.

Example:
Pro Guide to Trading Non-Farm Payroll (NFP)
This text before Slide 1 will be the cover image!

Slide 1: How to Trade NFP Without Blowing Your Account!
Headline: This is the actual headline for Slide 1.
Visual: A massive candlestick chart (spike) + a Bomb icon 💣
Sub-headline: The survival guide for Gold Traders.

Slide 2: What is Non-Farm Payroll?
Content: Forex (FX) is the global marketplace for exchanging national currencies. It's the largest market in the world...`}
                            disabled={isGenerating}
                            className="flex-1 bg-transparent border border-slate-700 rounded-lg outline-none px-4 py-3 text-white placeholder-slate-500 min-h-[200px]"
                        />
                        <button
                            onClick={handleGenerateContent}
                            disabled={isGenerating || !customTextInput.trim()}
                            className={`
                            px-6 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
                            ${!isGenerating && customTextInput.trim()
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'}
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing Content...
                                </>
                            ) : (
                                <>
                                    <span>Generate Slides & Images</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
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
                            disabled={isGenerating}
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
                            onClick={handleResetWorkflow}
                            className="text-xs text-slate-500 hover:text-white mb-1 flex items-center gap-1 px-3 py-1 bg-slate-800 rounded-md border border-slate-700 hover:border-slate-500 transition-colors"
                            disabled={isGenerating}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0" /></svg>
                            Start New Workflow
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
                            {img && 
                                <ImageResult 
                                    image={img} 
                                    downloadMode={downloadMode} 
                                    onPreview={(url) => setPreviewImage(url)} 
                                    aspectRatio={aspectRatio}
                                    currentVisualPrompt={slide.visualPrompt} // Pass current prompt
                                    onRepromptImage={handleRepromptImage}
                                    onApplyStyleToAll={handleApplyStyleToAll}
                                    isGeneratingAll={isGeneratingAllImages}
                                />
                            }
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
  );
};

export default App;