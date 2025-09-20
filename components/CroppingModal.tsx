
import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import type { ImageElement, DrawingElement } from '../types';
import { Wand2, Lightbulb, Sparkles, ChevronsLeftRight } from 'lucide-react';

interface OutpaintingModalProps {
  element: ImageElement | DrawingElement;
  onClose: () => void;
  onGenerate: (element: ImageElement | DrawingElement, croppedAreaPixels: Area, aspectRatio: number, prompt: string) => Promise<string | null>;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onRequestInspiration: () => void;
  onOptimizePrompt: () => void;
}

const aspectRatios = [
    { value: 0, text: 'Free' },
    { value: 1 / 1, text: '1:1' },
    { value: 16 / 9, text: '16:9' },
    { value: 9 / 16, text: '9:16' },
    { value: 4 / 3, text: '4:3' },
    { value: 3 / 4, text: '3:4' },
    { value: 3 / 2, text: '3:2' },
    { value: 2 / 3, text: '2:3' },
];

export const OutpaintingModal: React.FC<OutpaintingModalProps> = ({ element, onClose, onGenerate, prompt, onPromptChange, onRequestInspiration, onOptimizePrompt }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aspect, setAspect] = useState(aspectRatios[0].value);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const compareContainerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: Math.min(1200, window.innerWidth * 0.8), height: Math.min(800, window.innerHeight * 0.9) });

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleGenerate = async () => {
    if (croppedAreaPixels) {
      setIsGenerating(true);
      const finalAspect = aspect === 0 ? croppedAreaPixels.width / croppedAreaPixels.height : aspect;
      const finalPrompt = prompt.trim() ? prompt : "Intelligently outpaint the provided image to create a larger, cohesive scene. The new areas must be seamlessly filled with content that logically extends the original scene, style, and lighting. Pay close attention to textures, patterns, and natural continuations of objects and landscapes.";
      const newImageSrc = await onGenerate(element, croppedAreaPixels, finalAspect, finalPrompt);
      if (newImageSrc) {
        setGeneratedImage(newImageSrc);
      }
      setIsGenerating(false);
    }
  };

  const handleMouseMoveCompare = useCallback((e: React.MouseEvent) => {
    if (!compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);
  
  const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const startSize = { ...size };
      const startPos = { x: e.clientX, y: e.clientY };

      const doDrag = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.x;
        const dy = moveEvent.clientY - startPos.y;
        setSize({
          width: Math.max(600, startSize.width + dx),
          height: Math.max(500, startSize.height + dy),
        });
      };

      const stopDrag = () => {
        window.removeEventListener('mousemove', doDrag);
        window.removeEventListener('mouseup', stopDrag);
      };

      window.addEventListener('mousemove', doDrag);
      window.addEventListener('mouseup', stopDrag, { once: true });
    };

  const renderCroppingView = () => (
    <>
      <div className="relative flex-1 bg-slate-900/50 rounded-lg min-h-0">
        <Cropper
          image={element.src}
          crop={crop}
          zoom={zoom}
          minZoom={0.1}
          aspect={aspect ? aspect : undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={false}
          restrictPosition={false}
        />
        {isGenerating && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cyber-cyan)]"></div>
                 <p className="mt-4 text-md text-white">生成中...</p>
            </div>
        )}
      </div>
       <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-start gap-2">
              <textarea 
                  placeholder="若未輸入提示，則以一般outpaint擴圖生成。"
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  className="flex-grow bg-slate-800/50 p-2 rounded-md text-sm placeholder-gray-400 outline-none resize-none focus:ring-2 focus:ring-[var(--cyber-cyan)]"
                  rows={2}
              />
               <div className="flex flex-col gap-1">
                  <button title="靈感提示" onClick={onRequestInspiration} className="p-2 hover:bg-slate-700 rounded-lg"><Lightbulb size={18}/></button>
                  <button title="優化提示" onClick={onOptimizePrompt} className="p-2 hover:bg-slate-700 rounded-lg"><Sparkles size={18}/></button>
              </div>
          </div>
           <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-400">比例:</span>
                  {aspectRatios.map(ratio => (
                      <button key={ratio.text} onClick={() => setAspect(ratio.value)} className={`px-3 py-1 text-xs rounded-md ${aspect.toFixed(4) === ratio.value.toFixed(4) ? 'bg-[var(--cyber-cyan)] text-black' : 'bg-slate-700 text-gray-300'}`}>
                          {ratio.text}
                      </button>
                  ))}
              </div>
              <div className="flex items-center gap-2 w-1/3">
                  <span className="text-sm text-gray-400">縮放:</span>
                  <input
                      type="range"
                      value={zoom}
                      min={0.1}
                      max={3}
                      step={0.01}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                  />
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-gray-200 rounded-md hover:bg-slate-600">離開</button>
                  <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 bg-[var(--cyber-cyan)] text-black font-bold rounded-md hover:bg-cyan-300 flex items-center gap-2">
                      <Wand2 size={16}/>
                      {isGenerating ? '生成中...' : '生成'}
                  </button>
              </div>
          </div>
      </div>
    </>
  );

  const renderResultView = () => (
    <>
      <div 
          ref={compareContainerRef}
          className="relative flex-1 cursor-ew-resize overflow-hidden rounded-lg bg-slate-800 min-h-0"
          onMouseMove={handleMouseMoveCompare}
      >
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
              <img src={generatedImage!} alt="After" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
          </div>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
              <img src={element.src} alt="Before" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
          </div>
          <div className="absolute top-0 bottom-0 w-1 bg-orange-500 pointer-events-none" style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}>
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <ChevronsLeftRight size={16} className="text-white" />
              </div>
          </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
          <button onClick={() => setGeneratedImage(null)} className="px-4 py-2 bg-slate-700 text-gray-200 rounded-md hover:bg-slate-600">重來</button>
          <button onClick={onClose} className="px-4 py-2 bg-[var(--cyber-cyan)] text-black font-bold rounded-md hover:bg-cyan-300">完成並離開</button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm" onMouseDown={generatedImage ? undefined : onClose}>
      <div 
        className="bg-[var(--cyber-bg)] border border-[var(--cyber-border)] p-6 rounded-xl shadow-2xl flex flex-col gap-4 relative"
        style={{ width: size.width, height: size.height, minWidth: 600, minHeight: 500 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[var(--cyber-cyan)] flex-shrink-0">Outpaint / 擴展圖片</h2>
        {generatedImage ? renderResultView() : renderCroppingView()}
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" onMouseDown={handleResizeMouseDown} />
      </div>
    </div>
  );
};
