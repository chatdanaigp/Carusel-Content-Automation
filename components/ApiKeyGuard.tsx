import React, { useEffect, useState } from 'react';
import { GEMINI_API_KEY } from '../services/geminiService';

interface ApiKeyGuardProps {
  children: React.ReactNode;
}

const ApiKeyGuard: React.FC<ApiKeyGuardProps> = ({ children }) => {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkKey = async () => {
    try {
      // 1. Check if user provided a hardcoded key in the code (Prioritize this for deployment)
      if (GEMINI_API_KEY && GEMINI_API_KEY !== "PASTE_YOUR_API_KEY_HERE") {
        setHasKey(true);
        setLoading(false);
        return;
      }

      // 2. Fallback to existing mechanisms (window injection or build-time env)
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for Vercel/Browser shim if checking localStorage directly via shim logic
        // But since we updated index.html shim, window.aistudio should exist.
        // If not, use process.env check
        setHasKey(!!process.env.API_KEY || !!localStorage.getItem('gemini_api_key')); 
      }
    } catch (e) {
      console.error("Error checking API key", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Re-check key after selection
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 text-center">
          <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Setup Required
          </h2>
          <p className="mb-6 text-slate-300">
            This application requires a Google GenAI API Key.
          </p>
          
          <div className="bg-slate-900 p-4 rounded-lg text-left text-xs font-mono text-slate-400 mb-6 border border-slate-700">
            <p className="mb-2 text-yellow-500 font-bold">// Instruction:</p>
            <p className="mb-2">For security on the public web (Vercel), we do not store the key on the server.</p>
            <p>Please click the button below to enter your API Key. It will be stored securely in your browser's local storage.</p>
          </div>

          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={!window.aistudio?.openSelectKey}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            Enter API Key
          </button>
          
          <p className="mt-4 text-xs text-slate-500">
             Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Get one here</a>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiKeyGuard;