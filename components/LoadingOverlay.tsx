import React, { useState, useEffect } from 'react';

const SpinningTop: React.FC = () => (
    <div style={{ filter: 'drop-shadow(0 0 10px var(--cyber-cyan))', perspective: '150px' }}>
        <style>{`
            @keyframes spin-top {
                from { transform: rotateY(0deg); }
                to { transform: rotateY(360deg); }
            }
        `}</style>
        <div className="top-spinner-wrapper" style={{ transformStyle: 'preserve-3d', animation: 'spin-top 1.2s linear infinite' }}>
            <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="topBody" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e0e0e0" />
                        <stop offset="50%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#c0c0c0" />
                    </linearGradient>
                    <linearGradient id="topTip" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#666" />
                        <stop offset="100%" stopColor="#999" />
                    </linearGradient>
                </defs>
                <g style={{ transform: 'rotateX(75deg)', transformOrigin: '50% 50%' }}>
                    <ellipse cx="50" cy="50" rx="45" ry="45" fill="url(#topBody)" stroke="#888" strokeWidth="1"/>
                    <ellipse cx="50" cy="50" rx="30" ry="30" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
                    <ellipse cx="50" cy="50" rx="15" ry="15" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
                    <circle cx="50" cy="50" r="5" fill="url(#topTip)" />
                </g>
            </svg>
        </div>
    </div>
);


interface LoadingOverlayProps {
  isGenerating: boolean;
  generationStatus: string;
}

const sandevistanTexts = [
    "开启沙德威斯坦模式......",
    "子弹时间作用中......"
];

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isGenerating, generationStatus }) => {
    const [displayText, setDisplayText] = useState(generationStatus);
    const isSandevistanMode = generationStatus === "开启沙德威斯坦模式......";

    useEffect(() => {
        let interval: number;
        if (isGenerating && isSandevistanMode) {
            let index = 0;
            setDisplayText(sandevistanTexts[index]);
            interval = window.setInterval(() => {
                index = (index + 1) % sandevistanTexts.length;
                setDisplayText(sandevistanTexts[index]);
            }, 1500);
        } else {
            setDisplayText(generationStatus);
        }
        return () => window.clearInterval(interval);
    }, [isGenerating, isSandevistanMode, generationStatus]);

    if (!isGenerating) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm">
            <div className={isSandevistanMode ? 'glitch-effect' : ''}>
                <div className="flex flex-col items-center justify-center gap-8">
                    {isSandevistanMode ? <SpinningTop /> : <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--cyber-cyan)]" />}
                    <p data-text={displayText} className="text-2xl font-bold text-white text-center px-4 relative" style={{textShadow: '0 0 8px var(--cyber-glow-cyan)'}}>{displayText}</p>
                </div>
            </div>
        </div>
    );
};