import { GoogleGenAI, Type } from "@google/genai";
import { SlideContent, ContentIdea, DesignStyle, SocialConfig, CustomStyleConfig } from "../types";

// =============================================================================================
// 🔑 API KEY CONFIGURATION
// Removed hardcoded GEMINI_API_KEY as per coding guidelines.
// The API key must be obtained exclusively from process.env.API_KEY.
// =============================================================================================

// Helper to initialize AI client. 
const getAiClient = () => {
  // Per coding guidelines, the API key must be obtained exclusively from process.env.API_KEY.
  // We assume this variable is pre-configured, valid, and accessible.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    // This console error should ideally not be reached if ApiKeyGuard functions correctly
    // or if the environment variable is properly pre-configured as assumed by guidelines.
    console.error("API_KEY is not defined. Ensure it's set in your environment or selected via AI Studio.");
  }

  // Create a new GoogleGenAI instance right before making an API call to ensure
  // it always uses the most up-to-date API key from the dialog (if applicable).
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

// 🔥 MODEL CONFIGURATION
// Text: Using Gemini 3 Flash Preview as requested ("3.0")
export const TEXT_MODEL = 'gemini-3-flash-preview'; 

// FIX: Updated INTERNAL_IMAGE_MODEL_FALLBACK to an allowed model ('gemini-2.5-flash-image')
// and removed the deprecated 'gemini-2.0-flash-exp'. This resolves the type overlap error
// and adheres to coding guidelines for image models.
export const INTERNAL_IMAGE_MODEL_FALLBACK = 'gemini-2.5-flash-image';

export const generateContentIdeas = async (keyword: string, language: 'TH' | 'EN'): Promise<ContentIdea[]> => {
  const ai = getAiClient();
  const langInstruction = language === 'TH' ? '(in Thai)' : '(in English)';

  const prompt = `
    Based on the keyword "${keyword}", generate 4 distinct, engaging content ideas/angles for a social media carousel post about trading.
    
    The audience is beginner to intermediate traders.
    
    For each idea provide:
    1. A catchy 'title' ${langInstruction}.
    2. A brief 'summary' of what the carousel would cover ${langInstruction}.
  `;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["title", "summary"],
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("No text returned from Gemini");
  }

  const rawData = JSON.parse(response.text);
  
  return rawData.map((item: any, index: number) => ({
    id: index + 1,
    title: item.title,
    summary: item.summary,
  }));
};

export const generateTradingSlides = async (selectedIdea: ContentIdea, language: 'TH' | 'EN'): Promise<SlideContent[]> => {
  const ai = getAiClient();
  
  const langInstruction = language === 'TH' ? '(in Thai)' : '(in English)';

  const prompt = `
    Create a comprehensive set of educational slides based on this specific content idea:
    Title: "${selectedIdea.title}"
    Summary: "${selectedIdea.summary}"
    
    Guidelines:
    1. Generate between 4 to 7 slides to cover this specific topic effectively.
    2. The content must be high quality, suitable for a "Pro Gold Trader" persona.
    3. SPECIAL RULE FOR SLIDE 1: This is the Cover/Hook Slide. The 'content' MUST be a short, explosive, 1-sentence hook or question (Clickbait style, max 15 words). Do NOT write a paragraph for Slide 1.
    
    For each slide, provide:
    1. A catchy 'title' ${langInstruction}.
    2. The 'content' (bullet points or short paragraph ${langInstruction}).
    3. A 'visualPrompt' (in English) describing the scene.
  `;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
          },
          required: ["title", "content", "visualPrompt"],
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("No text returned from Gemini");
  }

  const rawData = JSON.parse(response.text);
  
  return rawData.map((item: any, index: number) => ({
    id: index + 1,
    title: item.title,
    content: item.content,
    visualPrompt: item.visualPrompt,
  }));
};

// New function to generate visual prompts from custom slide content
export const generateVisualPrompt = async (title: string, content: string): Promise<string> => {
  const ai = getAiClient();
  const maxAttempts = 5; // Increased max attempts
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const prompt = `
        Given the following slide title and content, generate a concise and descriptive visual prompt (in English) for an AI image generator. 
        Focus on key elements, mood, and relevant imagery for a trading-related infographic.
        
        Title: "${title}"
        Content: "${content}"
        
        Respond only with the visual prompt.
        Visual Prompt (max 20 words):
      `;

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 50, // Keep prompt short
        },
      });

      if (response.text && response.text.trim()) {
        return response.text.trim();
      } else {
        console.warn(`Attempt ${attempts + 1} failed: No visual prompt text returned for title "${title}". Retrying...`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000 * attempts)); // Increased exponential backoff delay
      }
    } catch (e: any) {
      console.error(`Attempt ${attempts + 1} failed to generate visual prompt for title "${title}":`, e);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000 * attempts)); // Increased exponential backoff delay
    }
  }
  throw new Error(`Failed to generate visual prompt for title "${title}" after ${maxAttempts} attempts.`);
};

/**
 * Translates the title and content of an array of SlideContent to a target language.
 * @param slides The array of SlideContent objects to translate.
 * @param targetLanguage The target language ('TH' for Thai, 'EN' for English).
 * @returns A new array of SlideContent objects with translated title and content.
 */
export const translateSlideContent = async (slides: SlideContent[], targetLanguage: 'TH' | 'EN'): Promise<SlideContent[]> => {
  const ai = getAiClient();
  const translatedSlides: SlideContent[] = [];
  const langInstruction = targetLanguage === 'TH' ? 'Thai' : 'English';

  for (const slide of slides) {
    let attempts = 0;
    const maxAttempts = 3; // Max retries for each slide translation

    while (attempts < maxAttempts) {
      try {
        const prompt = `
          Translate the following JSON object's 'title' and 'content' fields into ${langInstruction}.
          Maintain the 'id' and 'visualPrompt' fields as they are.
          Return the response as a JSON object, exactly mirroring the input structure but with translated text.

          Input JSON:
          ${JSON.stringify({ id: slide.id, title: slide.title, content: slide.content, visualPrompt: slide.visualPrompt })}
        `;

        const response = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
              },
              required: ["id", "title", "content", "visualPrompt"],
            },
          },
        });

        if (response.text) {
          const translated = JSON.parse(response.text);
          translatedSlides.push({
            id: translated.id,
            title: translated.title,
            content: translated.content,
            visualPrompt: translated.visualPrompt, // Keep original visual prompt
          });
          break; // Successfully translated, move to next slide
        } else {
          console.warn(`Attempt ${attempts + 1} failed: No text returned for translation of slide ${slide.id}. Retrying...`);
        }
      } catch (e: any) {
        console.error(`Attempt ${attempts + 1} failed to translate slide ${slide.id}:`, e);
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff for translation
    }

    if (attempts === maxAttempts) {
      console.error(`Failed to translate slide ${slide.id} after ${maxAttempts} attempts. Using original content.`);
      translatedSlides.push(slide); // Fallback to original content if translation fails
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between slides for rate limits
  }

  return translatedSlides;
};


export const generateInfographic = async (
  visualPrompt: string, 
  titleText: string, 
  contentText: string, 
  aspectRatio: string = "1:1",
  isTitleSlide: boolean = false,
  style: DesignStyle = 'ORIGINAL',
  socialConfig?: SocialConfig,
  customConfig?: CustomStyleConfig,
  selectedImageModel: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview' = 'gemini-2.5-flash-image' // New param with default
): Promise<string> => {
  const ai = getAiClient();

  // 2. Style Logic
  let styleInstruction = "";
  let iconStyle = "white or gold";
  switch (style) {
    case 'CYBERPUNK':
        styleInstruction = "Style: Cyberpunk. Dark background, Neon Cyan & Magenta lights, Glitch effects, Futuristic HUD elements.";
        iconStyle = "Neon Glowing (Cyan/Magenta)";
        break;
    case 'LUXURY':
        styleInstruction = "Style: Luxury. Black marble or dark texture background, Metallic Gold typography, Elegant serif fonts, Premium feel.";
        iconStyle = "Metallic Gold";
        break;
    case 'MINIMALIST':
        styleInstruction = "Style: Swiss Minimalist. Solid Off-White background, Bold Black Typography, High contrast, Simple geometric shapes.";
        iconStyle = "Solid Black";
        break;
    case 'MODERN':
        styleInstruction = "Style: Modern Fintech. Slate Grey to Blue gradient background, Glassmorphism effects, Clean Sans-serif fonts, Tech feel.";
        iconStyle = "White Glassmorphism";
        break;
    case 'CUSTOM':
        styleInstruction = `Style: Custom. ${customConfig?.prompt || "Professional Design"}.`;
        iconStyle = "Matching the artwork style";
        break;
    case 'ORIGINAL':
    default:
        styleInstruction = "Style: Professional Trader. Navy Blue gradient background, Gold accents, Candlestick chart patterns in background.";
        iconStyle = "Metallic Gold or White";
        break;
  }

  // 1. Footer Logic
  let footerInstruction = "";
  if (socialConfig) {
      const activePlatforms = socialConfig.platforms.filter(p => p.selected);
      if (activePlatforms.length > 0) {
          const footerElements = activePlatforms.map(p => {
              const handle = socialConfig.useSameHandle ? socialConfig.masterHandle : p.handle;
              return `${p.name} (@${handle})`; 
          }).join(" / "); 

          footerInstruction = `
          Include subtle social media icons and the following handles at the very bottom: ${footerElements}.
          Ensure the icons are ${iconStyle} and text is small and legible.
          `;
      }
  }

  // MAPPING ASPECT RATIO
  let targetRatio = aspectRatio;
  if (aspectRatio === '4:5') {
      targetRatio = '3:4'; // Gemini API supports 3:4 for portrait, not 4:5
  }

  let currentFullPrompt: string;
  let currentSimplePrompt: string;

  // --- Construct Prompts (UNIVERSAL for both image models) ---
  let resolvedVisualTheme = visualPrompt;
  let resolvedDesignDirectives = `
    - ${styleInstruction}
    - The text must be clearly visible and integrated into the design.
    - High resolution, sharp details.
    - Composition: Balanced, suitable for an educational slide.
  `;

  // Special logic for title slide (applies to both models now for text integration)
  if (isTitleSlide && style !== 'CUSTOM') {
    resolvedVisualTheme = `
      A high-impact TITLE SLIDE / COVER IMAGE.
      Focus: Big, Bold, Catchy Typography for the Headline.
      Background: Abstract and textural based on the ${style} style, designed to make the text pop.
      Do NOT include distracting characters, complex scenes, or illustrations.
      Vibe: "Must Click", "Secret Revealed", "Important Lesson".
    `;
    resolvedDesignDirectives = `
      - EMPHASIZE TYPOGRAPHY: The Headline must be the main visual element. Huge font size.
      - LAYOUT: Poster style. Center or top-heavy alignment.
      - BACKGROUND: Clean, premium, abstract texture that supports text readability.
      - ${styleInstruction}
    `;
  }

  // The prompt now universally instructs models to attempt embedding text.
  currentFullPrompt = `
    Generate a high-quality, visually appealing infographic image suitable for a social media carousel.
    
    **Primary Visual Theme:** Based on "${resolvedVisualTheme}".
    
    **Visually support the following text content, and where possible, subtly incorporate key parts or keywords within the image while ensuring readability (if incorporated):**
    - **Main Headline (theme):** "${titleText}"
    - **Supporting Content (theme):** "${contentText}"
    
    ${footerInstruction}
    
    **Overall Design Directives:**
    ${resolvedDesignDirectives}
    - Ensure the composition is balanced and professional.
    - Render text clearly in Thai language if the content is in Thai.
  `;

  currentSimplePrompt = `
    Generate a high-quality illustrative image, serving as a background for an infographic.
    
    **Visual Concept:** "${resolvedVisualTheme}"
    
    ${footerInstruction} (Ensure icons and handles are present and subtle at the bottom).
    
    **Design Attributes:**
    ${resolvedDesignDirectives}
    - Avoid overcrowding. Focus on the core visual theme.
    - Visually support the main headline and body text, integrating them where appropriate.
    - Render text clearly in Thai language if the content is in Thai.
  `;

  // Construct parts for Full Prompt
  const fullParts: any[] = [{ text: currentFullPrompt }];
  if (style === 'CUSTOM' && customConfig?.referenceImage) {
      const base64Data = customConfig.referenceImage.split(',')[1];
      const mimeType = customConfig.referenceImage.split(',')[0].split(':')[1].split(';')[0];
      if (base64Data && mimeType) {
           fullParts.push({
              inlineData: {
                  data: base64Data,
                  mimeType: mimeType
              }
           });
           fullParts[0].text += " \n(Use the attached image as a style reference).";
      }
  }

  // 5. Execution with Fallback Logic
  const performGenerate = async (modelName: string, promptParts: any[], attemptType: 'full' | 'simplified', allowRateLimitPropagation: boolean = false) => {
      try {
        console.log(`Attempting image generation with model: ${modelName}, prompt type: ${attemptType}`);
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: promptParts },
            config: {
                imageConfig: {
                    aspectRatio: targetRatio as any
                }
            }
        });
        
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        if (response.text) {
             console.warn(`Model ${modelName} returned text instead of image (${attemptType}):`, response.text);
        }
        
        return null; // No image data found
      } catch (e: any) {
          if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
              if (allowRateLimitPropagation) {
                  throw e; // Propagate 429 to App.tsx for external backoff
              } else {
                  console.warn(`Model ${modelName} hit rate limit (429) for ${attemptType} prompt. Internal fallback will be attempted.`);
                  return null; // Allow internal fallback
              }
          }
          // For other errors (e.g., 403, content safety), log and return null to try next attempt or fail.
          console.warn(`Error with model ${modelName} for ${attemptType} prompt:`, e);
          return null;
      }
  };

  let image = null;

  // 1. Try selectedImageModel with full prompt
  image = await performGenerate(selectedImageModel, fullParts, 'full', false); 
  
  // 2. If selectedImageModel failed, try internal fallback (if different)
  if (!image && selectedImageModel !== INTERNAL_IMAGE_MODEL_FALLBACK) {
      console.log(`Initial attempt with ${selectedImageModel} failed. Trying internal fallback ${INTERNAL_IMAGE_MODEL_FALLBACK}...`);
      
      // For fallback, use the same currentSimplePrompt which now aims for text integration
      const fallbackSimpleParts: any[] = [{ text: currentSimplePrompt }];
      if (style === 'CUSTOM' && customConfig?.referenceImage) {
           const base64Data = customConfig.referenceImage.split(',')[1];
           const mimeType = customConfig.referenceImage.split(',')[0].split(':')[1].split(';')[0];
           if (base64Data && mimeType) {
                fallbackSimpleParts.push({
                   inlineData: {
                       data: base64Data,
                       mimeType: mimeType
                   }
                });
           }
      }

      image = await performGenerate(INTERNAL_IMAGE_MODEL_FALLBACK, fallbackSimpleParts, 'simplified', false);
  }

  // 3. If still no image, try selectedImageModel with SIMPLIFIED prompt.
  if (!image) {
      console.log(`All full prompt attempts failed. Trying selected model (${selectedImageModel}) with SIMPLIFIED prompt...`);
      
      // Construct simple parts from currentSimplePrompt (determined unconditionally earlier)
      const simpleParts: any[] = [{ text: currentSimplePrompt }];
      if (style === 'CUSTOM' && customConfig?.referenceImage) {
           const base64Data = customConfig.referenceImage.split(',')[1];
           const mimeType = customConfig.referenceImage.split(',')[0].split(':')[1].split(';')[0];
           if (base64Data && mimeType) {
                simpleParts.push({
                   inlineData: {
                       data: base64Data,
                       mimeType: mimeType
                   }
                });
           }
      }
      image = await performGenerate(selectedImageModel, simpleParts, 'simplified', true); // Propagate 429 if this fails
  }

  if (!image) {
      throw new Error(`Failed to generate image after multiple attempts. Please try a different topic or style.`);
  }

  return image;
};