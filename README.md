# TradingFlow GenAI

An automated workflow application that helps traders generate educational social media content and infographics using Google's Gemini AI models.

## Features

- **Topic to Ideas**: Enter a keyword (e.g., "Mindset") to generate engaging content angles.
- **Content Expansion**: Automatically generates titles, educational content, and visual prompts for carousel slides.
- **AI Image Generation**: Creates professional-grade infographics using **Gemini 2.5 Flash Image** (Free tier compatible).
- **Multi-Style Support**: Choose from Original, Modern, Cyberpunk, Luxury, or Minimalist designs.
- **Social Media Integration**: Configure footers for TikTok, YouTube, Instagram, etc.
- **Bilingual Support**: Generates content in Thai (TH) or English (EN).

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **Models Used**:
  - `gemini-3-flash-preview` (Text Generation)
  - `gemini-2.5-flash-image` (Image Generation)

## Setup & Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your API Key:
   - Create a `.env` file in the root.
   - Add `API_KEY=your_google_genai_api_key`.

4. Run the development server:
   ```bash
   npm start
   ```

## Usage

1. **Enter a Topic**: Type a trading keyword.
2. **Select an Idea**: Choose from the generated content angles.
3. **Customize**: Set the design style and aspect ratio.
4. **Generate**: The app will generate text slides and corresponding images sequentially.
5. **Download**: Save the generated infographics.

## License

MIT
