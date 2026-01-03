import React, { useEffect, useState } from 'react';

interface ApiKeyGuardProps {
  children: React.ReactNode;
}

const ApiKeyGuard: React.FC<ApiKeyGuardProps> = ({ children }) => {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkKey = async () => {
    // API Key is now hardcoded in the service, so we bypass the check.
    setHasKey(true);
    setLoading(false);
  };

  useEffect(() => {
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Even if they select one, we use the hardcoded one, but we allow the flow to resolve.
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
            Authentication Required
          </h2>
          <p className="mb-6 text-slate-300">
            Please authenticate to continue.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/20"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiKeyGuard;