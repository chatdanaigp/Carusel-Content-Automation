import { GoogleGenAI, Type } from "@google/genai";
import { SlideContent, ContentIdea, DesignStyle, SocialConfig, CustomStyleConfig } from "../types";

// =============================================================================================
// 🔑 API KEY CONFIGURATION
// Security Warning: Do NOT hardcode your API Key here if pushing to GitHub.
// For Vercel/Production: Set the 'API_KEY' environment variable in your project settings.
// =============================================================================================
export const GEMINI_API_KEY: string = ""; 
// =============================================================================================

// Helper to initialize AI client. 
const getAiClient = () => {
  // Priority:
  // 1. Environment Variable (Vercel Build Time)
  // 2. LocalStorage (Shim for Browser/Vercel Runtime)
  // 3. Hardcoded (Local Dev)
  const apiKey = process.env.API_KEY || 
                 localStorage.getItem('gemini_api_key') || 
                 (GEMINI_API_KEY !== "PASTE_YOUR_API_KEY_HERE" ? GEMINI_API_KEY : "");
  
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

// 🔥 MODEL CONFIGURATION
// Text: Using Gemini 3 Flash Preview as requested ("3.0")
const TEXT_MODEL = 'gemini-3-flash-preview'; 

// Image: Primary is 2.5 Flash Image ("2.5"), Fallback is 2.0 Flash Exp for stability
const IMAGE_MODEL_PRIMARY = 'gemini-2.5-flash-image';
const IMAGE_MODEL_FALLBACK = 'gemini-2.0-flash-exp';

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

export const generateInfographic = async (
  visualPrompt: string, 
  titleText: string, 
  contentText: string, 
  aspectRatio: string = "1:1",
  isTitleSlide: boolean = false,
  style: DesignStyle = 'ORIGINAL',
  socialConfig?: SocialConfig,
  customConfig?: CustomStyleConfig
): Promise<string> => {
  const ai = getAiClient();

  // 2. Style Logic (Moved up to be used in Footer Logic)
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

  // 1. Footer Logic with STRICT Pairing
  let footerInstruction = "";
  if (socialConfig) {
      const activePlatforms = socialConfig.platforms.filter(p => p.selected);
      if (activePlatforms.length > 0) {
          // Force construct distinct pairs: [Icon] [Name]
          const footerPairs = activePlatforms.map(p => {
              const handle = socialConfig.useSameHandle ? socialConfig.masterHandle : p.handle;
              return `[${p.iconName} Icon] "${handle}"`;
          }).join("      "); // Large space in string to hint separation

          footerInstruction = `
          FOOTER INSTRUCTION (Strict Layout):
          - Position: Bottom edge of the image.
          - Layout: Horizontal row.
          - CONTENT: ${footerPairs}
          - CRITICAL RULE: Render EXACTLY as pairs. One Icon + One Name. Do NOT group icons.
          - VISUAL STYLE: Icons must be ${iconStyle}. Font must be small, clean, sans-serif.
          - Example Look: [TikTok Logo] @user      [IG Logo] @user
          `;
      }
  }

  // 3. SPECIAL LOGIC FOR TITLE SLIDE (Preset Modes Only)
  // If it's the first slide AND not custom mode, force a Typography/Poster layout
  let finalVisualPrompt = visualPrompt;
  let finalDesignDirectives = `
    - ${styleInstruction}
    - The text must be clearly visible and integrated into the design.
    - High resolution, sharp details.
    - Composition: Balanced, suitable for an educational slide.
  `;

  if (isTitleSlide && style !== 'CUSTOM') {
      finalVisualPrompt = `
        A high-impact TITLE SLIDE / COVER IMAGE.
        Focus: Big, Bold, Catchy Typography for the Headline.
        Background: Abstract and textural based on the ${style} style, designed to make the text pop.
        Do NOT include distracting characters, complex scenes, or illustrations.
        Vibe: "Must Click", "Secret Revealed", "Important Lesson".
      `;
      
      finalDesignDirectives = `
        - EMPHASIZE TYPOGRAPHY: The Headline must be the main visual element. Huge font size.
        - LAYOUT: Poster style. Center or top-heavy alignment.
        - BACKGROUND: Clean, premium, abstract texture that supports text readability.
        - ${styleInstruction}
      `;
  }

  // 4. Image Generation Prompt (Full Detail)
  const fullPrompt = `
    Generate a high-quality, photorealistic infographic image for social media.
    
    TEXT CONTENT TO RENDER (Must be spelled correctly and legible):
    - HEADLINE (Large & Dominant): "${titleText}"
    - BODY (Readable): "${contentText}"
    
    ${footerInstruction}
    
    VISUAL CONTEXT:
    ${finalVisualPrompt}
    
    DESIGN DIRECTIVES:
    ${finalDesignDirectives}
  `;

  // Construct parts for Full Prompt
  const fullParts: any[] = [{ text: fullPrompt }];
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
  const generate = async (modelName: string, promptParts: any[]) => {
      try {
        console.log(`Attempting image generation with model: ${modelName}`);
        
        // MAPPING ASPECT RATIO
        let targetRatio = aspectRatio;
        if (aspectRatio === '4:5') {
            targetRatio = '3:4';
        }

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
             console.warn(`Model ${modelName} returned text instead of image:`, response.text);
        }
        
        return null;
      } catch (e: any) {
          // IMPORTANT: Propagate Rate Limits so App.tsx can handle backoff
          if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
              throw e;
          }
          console.warn(`Error with model ${modelName}:`, e);
          return null;
      }
  };

  // Attempt 1: Primary Model (2.5) - Full Prompt
  let image = await generate(IMAGE_MODEL_PRIMARY, fullParts);

  // Attempt 2: Fallback Model (2.0) - Full Prompt
  if (!image) {
      console.log("Attempt 1 failed. Switching to fallback model...");
      image = await generate(IMAGE_MODEL_FALLBACK, fullParts);
  }

  // Attempt 3: Primary Model (2.5) - Simplified Prompt (No Body Text, But keep Visual Footer)
  // If previous attempts failed (likely due to safety filters on text rendering), try just the visual art + footer logos.
  if (!image) {
      console.log("Attempt 2 failed. Switching to SIMPLIFIED prompt (Text-Free Body)...");
      
      const simplePrompt = `
        Create a high-quality illustration.
        
        Visual Description: ${finalVisualPrompt}
        
        ${footerInstruction}
        (Render the icons and handle clearly at the bottom as specified)
        
        Style: ${styleInstruction}
        
        Requirements: High resolution, photorealistic, professional composition. No main body text overlay, but INCLUDE the footer elements.
      `;

      const simpleParts: any[] = [{ text: simplePrompt }];
      // Re-add reference image if exists
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

      image = await generate(IMAGE_MODEL_PRIMARY, simpleParts);
  }

  if (!image) {
      throw new Error(`Failed to generate image after 3 attempts. Please try a different topic or style.`);
  }

  return image;
};