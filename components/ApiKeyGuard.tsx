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
        // If process.env.API_KEY was present it would be handled here, but if not we show the guard
        // In this case, if hardcoded key is not set, we assume false unless env exists
        setHasKey(!!process.env.API_KEY); 
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
      setHasKey(true);
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
            <p className="mb-2">Open <code>services/geminiService.ts</code></p>
            <p>Paste your API Key into the <code>GEMINI_API_KEY</code> variable.</p>
          </div>

          <div className="text-sm text-slate-500 mb-4">- OR -</div>

          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!window.aistudio?.openSelectKey}
          >
            Select API Key (Temporary)
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiKeyGuard;