import { GoogleGenAI, Type } from "@google/genai";
import { SlideContent, ContentIdea } from "../types";

// Helper to initialize AI client. 
// Note: We create a new instance per call to ensure latest API key is used if re-selected.
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    model: 'gemini-3-pro-preview',
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
    model: 'gemini-3-pro-preview',
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
  isTitleSlide: boolean = false
): Promise<string> => {
  const ai = getAiClient();

  let finalPrompt = "";

  if (isTitleSlide) {
    // Special prompt for Slide 1: Text Only, No illustrations
    // Matches the request to mimic the attached style: Text emphasis, dark background, no pictures.
    finalPrompt = `
      Role: Senior Graphic Designer & Pro Trader Content Creator.
      Task: Create a TEXT-ONLY Cover/Hook image for a trading carousel.
      
      CRITICAL INSTRUCTION: DO NOT generate any characters, people, 3D objects, or cartoons. This image must be TYPOGRAPHY ONLY.
      
      Visual Style:
      - Background: Professional Dark Navy/Black Gradient. Can have very subtle, low-opacity abstract technical chart lines blended into the background.
      - Vibe: Premium, Serious, Secretive, "Clickbait" but professional.
      
      Text Layout & Styling:
      1. TOP HEADLINE: "${titleText}"
         - Font: Large, Bold, Sans-Serif.
         - Color: White with a subtle outer glow.
         
      2. CENTER HOOK (Main Focus):
         - Text to Display: "${contentText}"
         - Note: This text must be VERY LARGE and readable. It represents the key essence or hook.
         - Font: Very Large, Heavy weight.
         - Color: Gold (#FFD700) or Bright Yellow to contrast against the dark background.
         - Layout: Center of the image, dominating the space.
         
      3. FOOTER: 
         - Layout: Horizontal row at the very bottom.
         - Content:
           [Tiktok Logo] crt.trader   [YouTube Logo] crt.trader   [Instagram Logo] crt.trader.official
         - IMPORTANT: Use actual minimalist icons for Tiktok, YouTube, and Instagram. Do NOT write the platform names as text.
      
      Aspect Ratio: ${aspectRatio}.
    `;
  } else {
    // Standard prompt for subsequent slides (Visuals + Text)
    // Updated Layout: Headline -> Content -> Image -> Content -> Footer
    finalPrompt = `
      Role: Senior Graphic Designer and Professional Gold Trading Content Creator.
      Task: Create an educational Infographic Slide.

      STRICT VERTICAL LAYOUT ORDER:
      1. **HEADLINE** (Top): "${titleText}"
         - Style: Bold, Professional font, Gold or White.
      
      2. **TEXT SECTION 1** (Upper Body): 
         - Display the first part or summary of this text: "${contentText}"
         - Clear, readable typography.
      
      3. **ILLUSTRATION** (Center):
         - Visual: "${visualPrompt}"
         - Style: High-quality Chart/Graph/Trading Visual. Professional, Dark Mode aesthetic. NO CARTOONS. 
         - Must be the focal point in the middle.

      4. **TEXT SECTION 2** (Lower Body):
         - Display any remaining text or key takeaway from: "${contentText}"
         - Place this below the illustration.

      5. **FOOTER** (Bottom): 
         - Layout: Horizontal row at the very bottom.
         - Content:
           [Tiktok Logo] crt.trader   [YouTube Logo] crt.trader   [Instagram Logo] crt.trader.official
         - IMPORTANT: Use actual minimalist icons for Tiktok, YouTube, and Instagram. Do NOT write the platform names as text.

      General Style:
      - Background: Dark Navy/Black Gradient (Professional Trading Theme).
      - Composition: Balanced "Sandwich" layout (Text - Image - Text).
      - Aspect Ratio: ${aspectRatio}.
      - Atmosphere: Knowledgeable, Premium, Trustworthy.
    `;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image', 
    contents: {
      parts: [
        { text: finalPrompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        // imageSize is not supported in gemini-2.5-flash-image
      }
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found in response");
};