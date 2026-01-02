import React from 'react';
import { SlideContent } from '../types';

interface SlideCardProps {
  slide: SlideContent;
}

const SlideCard: React.FC<SlideCardProps> = ({ slide }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-md hover:shadow-lg transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
          SLIDE {slide.id}
        </span>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{slide.title}</h3>
      <p className="text-slate-300 text-sm leading-relaxed mb-4">{slide.content}</p>
      <div className="bg-slate-900/50 p-3 rounded text-xs text-slate-400 border border-slate-700/50">
        <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">Visual Prompt</span>
        {slide.visualPrompt}
      </div>
    </div>
  );
};

export default SlideCard;
