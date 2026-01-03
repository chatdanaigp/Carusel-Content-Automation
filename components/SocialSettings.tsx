import React from 'react';
import { SocialConfig, SocialPlatform } from '../types';

interface SocialSettingsProps {
  config: SocialConfig;
  onChange: (newConfig: SocialConfig) => void;
  disabled?: boolean;
}

const SocialSettings: React.FC<SocialSettingsProps> = ({ config, onChange, disabled }) => {
  
  const handleTogglePlatform = (id: string) => {
    const newPlatforms = config.platforms.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    );
    onChange({ ...config, platforms: newPlatforms });
  };

  const handleHandleChange = (id: string, value: string) => {
    const newPlatforms = config.platforms.map(p => 
      p.id === id ? { ...p, handle: value } : p
    );
    onChange({ ...config, platforms: newPlatforms });
  };

  const handleMasterHandleChange = (value: string) => {
    onChange({ ...config, masterHandle: value });
  };

  const handleSameHandleToggle = () => {
    onChange({ ...config, useSameHandle: !config.useSameHandle });
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Social Footer Settings
        </h3>
        
        {/* Same Handle Toggle */}
        <label className="flex items-center gap-2 cursor-pointer group">
           <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${config.useSameHandle ? 'bg-blue-600' : 'bg-slate-600'}`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${config.useSameHandle ? 'translate-x-5' : 'translate-x-0'}`}></div>
           </div>
           <input type="checkbox" className="hidden" checked={config.useSameHandle} onChange={handleSameHandleToggle} disabled={disabled} />
           <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Use same handle for all</span>
        </label>
      </div>

      {/* Master Handle Input */}
      {config.useSameHandle && (
        <div className="mb-6 animate-fade-in">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <span className="text-sm">@</span>
                </div>
                <input 
                    type="text" 
                    value={config.masterHandle}
                    onChange={(e) => handleMasterHandleChange(e.target.value)}
                    placeholder="your.username"
                    disabled={disabled}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-8 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
             </div>
             <p className="text-[10px] text-slate-500 mt-1 text-right">Applied to all active platforms</p>
        </div>
      )}

      {/* Platform Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {config.platforms.map((platform) => (
            <div 
                key={platform.id} 
                className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${platform.selected ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/30 border-slate-800 opacity-60 hover:opacity-100'}
                `}
            >
                {/* Checkbox */}
                <input 
                    type="checkbox" 
                    checked={platform.selected} 
                    onChange={() => handleTogglePlatform(platform.id)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 bg-slate-700 cursor-pointer"
                />
                
                {/* Platform Name/Icon placeholder */}
                <span className={`text-sm font-medium min-w-[70px] ${platform.selected ? 'text-white' : 'text-slate-500'}`}>
                    {platform.name}
                </span>

                {/* Handle Input (Only if not master mode) */}
                {!config.useSameHandle && platform.selected && (
                    <div className="flex-1 relative animate-fade-in">
                        <input 
                            type="text" 
                            value={platform.handle}
                            onChange={(e) => handleHandleChange(platform.id, e.target.value)}
                            placeholder="username"
                            disabled={disabled}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                )}
                
                {/* Static handle display if master mode */}
                {config.useSameHandle && platform.selected && (
                    <span className="text-xs text-slate-400 truncate flex-1 text-right">
                        {config.masterHandle || '...'}
                    </span>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};

export default SocialSettings;