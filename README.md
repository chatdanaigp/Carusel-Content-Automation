# TradingFlow GenAI

An automated workflow application that helps traders generate educational social media content and infographics using Google's Gemini AI models.

## Features

- **Topic to Ideas**: Enter a keyword (e.g., "Mindset") to generate engaging content angles.
- **Content Expansion**: Automatically generates titles, educational content, and visual prompts for carousel slides.
- **AI Image Generation**: Creates professional-grade infographics. Users can select between:
  - **Gemini 2.5 Flash Image** (Free tier compatible)
  - **Gemini 3 Pro Image Preview** (Paid tier, requires Google Cloud billing)
- **Multi-Style Support**: Choose from Original, Modern, Cyberpunk, Luxury, or Minimalist designs.
- **Social Media Integration**: Configure footers for TikTok, YouTube, Instagram, etc.
- **Bilingual Support**: Generates content in Thai (TH) or English (EN).

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **Models Used**:
  - `gemini-3-flash-preview` (Text Generation)
  - `gemini-2.5-flash-image` or `gemini-3-pro-image-preview` (Image Generation, user selectable)

## Setup & Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. **API Key Management (Automated):**
   - The application is designed to automatically retrieve the API key from `process.env.API_KEY`.
   - **For local development:** You will need to set `process.env.API_KEY` in your environment (e.g., via a `.env` file, which your build tool like Vite or Create React App would read).
   - **For deployment to Google AI Studio or similar platforms:** The `process.env.API_KEY` will be automatically provided by the platform. If you use paid models (e.g., Gemini 3 Pro Image) and encounter a permission error, `window.aistudio.openSelectKey()` will be triggered *on demand* to let you select a billing-enabled API key, without an initial setup prompt from the app itself.
   - **Important:** The application will *not* prompt you to enter an API key in the UI. Ensure `process.env.API_KEY` is available in your execution environment.

4. Run the development server:
   ```bash
   npm start
   ```

## Usage

1. **Enter a Topic**: Type a trading keyword.
2. **Select an Idea**: Choose from the generated content angles.
3. **Customize**: Set the design style, **select your desired Image Model (Free/Paid)**, and aspect ratio.
4. **Generate**: The app will generate text slides and corresponding images sequentially. Images will appear and be downloadable as they are completed.
5. **Download**: Save the generated infographics.

## License

MIT