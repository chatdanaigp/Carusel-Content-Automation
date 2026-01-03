import { GoogleGenAI, Type } from "@google/genai";
import { SlideContent, ContentIdea, DesignStyle, SocialConfig, CustomStyleConfig } from "../types";

// =============================================================================================
// 🔑 API KEY CONFIGURATION
// นำ API Key ของคุณมาวางแทนที่ข้อความในเครื่องหมายคำพูดด้านล่างนี้
// =============================================================================================
export const GEMINI_API_KEY: string = "AIzaSyAwYK2a2e_ZsXanNb7jfBPe8d0x2TRYgjA"; 
// =============================================================================================

// Helper to initialize AI client. 
// Note: We create a new instance per call to ensure latest API key is used if re-selected.
const getAiClient = () => {
  // Use the hardcoded key if provided, otherwise fallback to empty string (which will cause error if not handled)
  const apiKey = GEMINI_API_KEY !== "PASTE_YOUR_API_KEY_HERE" ? GEMINI_API_KEY : (process.env.API_KEY || "");
  return new GoogleGenAI({ apiKey: apiKey });
};

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
    model: 'gemini-3-flash-preview',
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

  // Modified prompt to use the specific selected idea
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
    model: 'gemini-3-flash-preview',
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
  
  // Map to our internal type and add IDs
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

  let finalPrompt = "";
  let footerInstruction = "";

  // Dynamic Footer Construction based on Config
  if (socialConfig) {
      const activePlatforms = socialConfig.platforms.filter(p => p.selected);
      
      if (activePlatforms.length > 0) {
          const footerItems = activePlatforms.map(p => {
              const handle = socialConfig.useSameHandle ? socialConfig.masterHandle : p.handle;
              // We instruct the model to use the Icon, then the handle text
              return `[${p.iconName}] ${handle}`;
          }).join("     ");

          footerInstruction = `
            FOOTER SECTION (Bottom of image):
            - Layout: A clean, horizontal row at the very bottom.
            - Content to Display: ${footerItems}
            - STRICT RULE: DISPLAY ONLY ICONS AND HANDLES.
            - FORBIDDEN: DO NOT WRITE THE TEXT "${activePlatforms.map(p => p.name).join('" OR "')}". 
            - Example: Show [TikTok Icon] @handle. Do NOT show "TikTok @handle".
            - Visual Style: Minimalist, professional icons. Text should be small but readable.
          `;
      } else {
          footerInstruction = "FOOTER: Do not display any social media footer.";
      }
  } else {
      // Fallback if no config provided (Legacy behavior)
      footerInstruction = `
        FOOTER:
        - Minimalist row of icons: [Tiktok Logo] [YouTube Logo] [Instagram Logo]
        - Followed by handles: crt.trader / crt.trader / crt.trader.official
        - IMPORTANT: Use LOGOS, do not write platform names text.
      `;
  }

  switch (style) {
    case 'CUSTOM':
        const userPrompt = customConfig?.prompt || "Clean professional style";
        finalPrompt = isTitleSlide ? `
            Role: Expert Graphic Designer. 
            Style Description: ${userPrompt}.
            
            Task: Create a Cover Image for a trading carousel.
            
            Visual Elements to include:
            - Headline Text: "${titleText}" (Make it the primary focus).
            - Hook/Subtext: "${contentText}".
            
            ${footerInstruction}
            Aspect Ratio: ${aspectRatio}.
        ` : `
            Role: Expert Graphic Designer.
            Style Description: ${userPrompt}.
            
            Task: Create an Educational Trading Slide.
            
            Layout Requirements:
            1. Headline: "${titleText}" (Clear and readable).
            2. Main Content Text: "${contentText}".
            3. Central Visual/Chart Description: "${visualPrompt}".
            
            ${footerInstruction}
            Aspect Ratio: ${aspectRatio}.
        `;
        break;

    case 'CYBERPUNK':
        finalPrompt = isTitleSlide ? `
            Role: Expert Digital Artist. Style: CYBERPUNK / NEON TRADER.
            Task: Cover Image. NO characters. TYPOGRAPHY & FX ONLY.
            
            Visuals:
            - Background: Dark city grid, rain-slicked textures, deep purple/magenta/cyan lighting.
            - Text: "Glitch" effect or Neon Sign typography.
            - Headline: "${titleText}" (Neon Blue).
            - Hook: "${contentText}" (Hot Pink or Bright Yellow).
            
            ${footerInstruction}
            Aspect Ratio: ${aspectRatio}.
        ` : `
            Role: Expert Digital Artist. Style: CYBERPUNK / NEON TRADER.
            Task: Educational Slide.
            
            Layout:
            1. Headline (Top): "${titleText}" - Neon style.
            2. Text 1: "${contentText}" - HUD/Terminal font style.
            3. Visual (Center): "${visualPrompt}" - Holographic, wireframe 3D chart, glowing edges.
            4. Text 2: "${contentText}" - HUD style.
            5. Footer:
            ${footerInstruction}
            
            Palette: Black, Cyan, Magenta.
            Aspect Ratio: ${aspectRatio}.
        `;
        break;

    case 'LUXURY':
        finalPrompt = isTitleSlide ? `
            Role: Luxury Brand Designer. Style: HIGH-END PRESTIGE.
            Task: Cover Image. TYPOGRAPHY ONLY.
            
            Visuals:
            - Background: Black Marble, Silk texture, or Matte Black with Gold dust.
            - Text: Serif fonts (Vogue/Rolex style). Elegant, expensive.
            - Headline: "${titleText}" (Metallic Gold).
            - Hook: "${contentText}" (White Serif).
            
            ${footerInstruction}
            Aspect Ratio: ${aspectRatio}.
        ` : `
            Role: Luxury Brand Designer. Style: HIGH-END PRESTIGE.
            Task: Educational Slide.
            
            Layout:
            1. Headline (Top): "${titleText}" - Gold Serif.
            2. Text 1: "${contentText}" - Elegant White.
            3. Visual (Center): "${visualPrompt}" - Realistic, cinematic lighting, gold accents on charts.
            4. Text 2: "${contentText}".
            5. Footer:
            ${footerInstruction}
            
            Palette: Black, Gold, White.
            Aspect Ratio: ${aspectRatio}.
        `;
        break;

    case 'MINIMALIST':
        finalPrompt = isTitleSlide ? `
            Role: Swiss Graphic Designer. Style: ULTRA MINIMALIST.
            Task: Cover Image. TYPOGRAPHY ONLY.
            
            Visuals:
            - Background: Off-white (#f8f9fa) or Very Light Grey.
            - Text: Massive Bold Black Helvetica/Sans-Serif. High contrast.
            - Headline: "${titleText}" (Black).
            - Hook: "${contentText}" (Accent Color: International Orange or Royal Blue).
            
            ${footerInstruction} (Dark icons for visibility).
            Aspect Ratio: ${aspectRatio}.
        ` : `
            Role: Swiss Graphic Designer. Style: ULTRA MINIMALIST.
            Task: Educational Slide.
            
            Layout:
            1. Headline (Top): "${titleText}" - Bold Black.
            2. Text 1: "${contentText}" - Clean Dark Grey.
            3. Visual (Center): "${visualPrompt}" - Flat vector, clean lines, isometric, no gradients.
            4. Text 2: "${contentText}".
            5. Footer:
            ${footerInstruction}
            
            Palette: White background, Black text, One accent color.
            Aspect Ratio: ${aspectRatio}.
        `;
        break;

    case 'MODERN':
        // Slate/Electric Blue Fintech
        finalPrompt = isTitleSlide ? `
          Role: Expert UI/UX Designer. Style: MODERN FINTECH.
          Task: Cover Image. TYPOGRAPHY ONLY.
          
          Visuals:
          - Background: Deep Slate Grey (#1e293b). Glassmorphism effects.
          - Headline: "${titleText}" (White, Sans-Serif Bold).
          - Hook: "${contentText}" (Electric Blue/Cyan).
          
          ${footerInstruction}
          Aspect Ratio: ${aspectRatio}.
        ` : `
          Role: Expert UI/UX Designer. Style: MODERN FINTECH.
          Task: Educational Slide.
          
          Layout:
          1. Headline: "${titleText}" (White).
          2. Text 1: "${contentText}".
          3. Visual: "${visualPrompt}" - Abstract 3D, Gradient shapes, clean interface.
          4. Text 2: "${contentText}".
          5. Footer:
          ${footerInstruction}
          
          Aspect Ratio: ${aspectRatio}.
        `;
        break;

    case 'ORIGINAL':
    default:
        // Classic Navy/Gold
        finalPrompt = isTitleSlide ? `
            Role: Pro Trader Content Creator. Style: CLASSIC PRO.
            Task: TEXT-ONLY Cover/Hook.
            
            Visuals:
            - Background: Dark Navy/Black Gradient. Subtle chart patterns.
            - Headline: "${titleText}" (White).
            - Hook: "${contentText}" (Gold #FFD700). Very Large.
            
            ${footerInstruction}
            Aspect Ratio: ${aspectRatio}.
        ` : `
            Role: Pro Trader Content Creator. Style: CLASSIC PRO.
            Task: Educational Slide.
            
            Layout:
            1. Headline: "${titleText}" (Gold/White).
            2. Text 1: "${contentText}".
            3. Visual: "${visualPrompt}" - Professional Trading Chart/Graph. Dark mode.
            4. Text 2: "${contentText}".
            5. Footer:
            ${footerInstruction}
            
            Aspect Ratio: ${aspectRatio}.
        `;
        break;
  }

  // Construct parts for the API call
  const parts: any[] = [
      { text: finalPrompt }
  ];

  // If Custom style and reference image exists, add it to parts
  if (style === 'CUSTOM' && customConfig?.referenceImage) {
      const base64Data = customConfig.referenceImage.split(',')[1];
      const mimeType = customConfig.referenceImage.split(',')[0].split(':')[1].split(';')[0];
      
      // Add image part. Note: For style transfer/reference, providing the image alongside the text prompt works well.
      if (base64Data && mimeType) {
          parts.push({
              inlineData: {
                  data: base64Data,
                  mimeType: mimeType
              }
          });
      }
  }

  // Switch to Gemini 2.5 Flash Image (Nano Banana series)
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: parts,
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any, // 1:1, 3:4, 9:16 are supported
      }
    }
  });

  // Extract image from response parts
  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
      }
  }

  throw new Error("No image data found in Gemini Flash Image response");
};
