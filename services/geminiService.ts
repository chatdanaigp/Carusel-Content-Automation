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
            A high-quality educational infographic trading cover image.
            Style: ${userPrompt}.
            
            Visual Elements:
            - Headline Text: "${titleText}" (Make it the primary focus, large and readable).
            - Hook/Subtext: "${contentText}".
            
            ${footerInstruction}
        ` : `
            A high-quality educational trading infographic slide.
            Style: ${userPrompt}.
            
            Layout Requirements:
            1. Headline: "${titleText}" (Clear and readable at the top).
            2. Main Content Text: "${contentText}" (Readable text body).
            3. Central Visual: "${visualPrompt}".
            
            ${footerInstruction}
        `;
        break;

    case 'CYBERPUNK':
        finalPrompt = isTitleSlide ? `
            A Cyberpunk / Neon Trader style cover image. High-tech, futuristic.
            Visuals: Dark city grid background, rain-slicked textures, deep purple/magenta/cyan lighting.
            Typography: "Glitch" effect or Neon Sign font.
            
            TEXT TO RENDER:
            - Headline: "${titleText}" (Neon Blue).
            - Subtext: "${contentText}" (Hot Pink or Bright Yellow).
            
            ${footerInstruction}
        ` : `
            A Cyberpunk / Neon Trader style educational slide.
            Visuals: Holographic wireframe 3D chart in center, glowing edges. HUD/Terminal interface elements.
            Palette: Black, Cyan, Magenta.
            
            TEXT TO RENDER:
            - Headline (Top): "${titleText}" (Neon style).
            - Body Text: "${contentText}" (HUD/Terminal font style).
            - Footer: ${footerInstruction}
        `;
        break;

    case 'LUXURY':
        finalPrompt = isTitleSlide ? `
            A High-End Luxury Prestige style cover image. Expensive, elegant, premium.
            Visuals: Black Marble, Silk texture, or Matte Black with Gold dust background.
            Typography: Serif fonts (Vogue/Rolex style).
            
            TEXT TO RENDER:
            - Headline: "${titleText}" (Metallic Gold).
            - Subtext: "${contentText}" (White Serif).
            
            ${footerInstruction}
        ` : `
            A High-End Luxury Prestige style educational slide.
            Visuals: Realistic, cinematic lighting, gold accents on trading charts.
            Palette: Black, Gold, White.
            
            TEXT TO RENDER:
            - Headline (Top): "${titleText}" (Gold Serif).
            - Body Text: "${contentText}" (Elegant White).
            - Footer: ${footerInstruction}
        `;
        break;

    case 'MINIMALIST':
        finalPrompt = isTitleSlide ? `
            An Ultra Minimalist Swiss Graphic Design cover image. Clean, high contrast.
            Visuals: Off-white (#f8f9fa) or Very Light Grey background.
            Typography: Massive Bold Black Helvetica/Sans-Serif.
            
            TEXT TO RENDER:
            - Headline: "${titleText}" (Black).
            - Subtext: "${contentText}" (Accent Color: International Orange or Royal Blue).
            
            ${footerInstruction} (Dark icons).
        ` : `
            An Ultra Minimalist Swiss Graphic Design educational slide.
            Visuals: Flat vector, clean lines, isometric chart, no gradients.
            Palette: White background, Black text, One accent color.
            
            TEXT TO RENDER:
            - Headline (Top): "${titleText}" (Bold Black).
            - Body Text: "${contentText}" (Clean Dark Grey).
            - Footer: ${footerInstruction}
        `;
        break;

    case 'MODERN':
        // Slate/Electric Blue Fintech
        finalPrompt = isTitleSlide ? `
          A Modern Fintech UI/UX style cover image. Clean, trustworthy, tech-forward.
          Visuals: Deep Slate Grey (#1e293b) background. Glassmorphism effects.
          Typography: Sans-Serif Bold.
          
          TEXT TO RENDER:
          - Headline: "${titleText}" (White).
          - Subtext: "${contentText}" (Electric Blue/Cyan).
          
          ${footerInstruction}
        ` : `
          A Modern Fintech UI/UX style educational slide.
          Visuals: Abstract 3D, Gradient shapes, clean interface elements.
          
          TEXT TO RENDER:
          - Headline: "${titleText}" (White).
          - Body Text: "${contentText}".
          - Footer: ${footerInstruction}
        `;
        break;

    case 'ORIGINAL':
    default:
        // Classic Navy/Gold
        finalPrompt = isTitleSlide ? `
            A Classic Pro Trader style cover image. Professional, financial news look.
            Visuals: Dark Navy/Black Gradient background. Subtle chart patterns overlay.
            
            TEXT TO RENDER:
            - Headline: "${titleText}" (White).
            - Subtext: "${contentText}" (Gold #FFD700, Very Large).
            
            ${footerInstruction}
        ` : `
            A Classic Pro Trader style educational slide.
            Visuals: Professional Trading Chart/Graph in center. Dark mode theme.
            
            TEXT TO RENDER:
            - Headline: "${titleText}" (Gold/White).
            - Body Text: "${contentText}" (White/Grey).
            - Footer: ${footerInstruction}
        `;
        break;
  }

  // NOTE: Imagen 3.0 via generateImages does not support "parts" or "inlineData" for reference images in the same way as Gemini.
  // We will proceed with text-to-image generation using the updated prompt.

  try {
      // Use Imagen 3 model which is generally available and deployable
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-001', 
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio as any, // Cast to any because TS enum definition might differ slightly but string values "1:1", "3:4", "9:16" are valid for Imagen
        }
      });

      const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
      
      if (!base64Data) {
        throw new Error("No image data returned from Imagen.");
      }

      return `data:image/jpeg;base64,${base64Data}`;

  } catch (error) {
      console.error("Imagen generation failed:", error);
      throw error;
  }
};