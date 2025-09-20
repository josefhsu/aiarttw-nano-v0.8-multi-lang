import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ImageElement, DrawingElement, Point, ImageCompareElement } from '../types';
import { Wand2, Lightbulb, Sparkles, Brush, Eraser, Undo, Redo, Trash2, ChevronsLeftRight } from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { dataUrlToBlob } from '../utils';

interface InpaintingModalProps {
  element: ImageElement | DrawingElement | ImageCompareElement;
  onClose: () => void;
  onGenerate: (element: ImageElement | DrawingElement | ImageCompareElement, maskDataUrl: string, prompt: string) => Promise<string | null>;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onRequestInspiration: () => void;
  onOptimizePrompt: () => void;
}

const QUICK_PROMPTS = ['漂亮的手', '更清晰精細', '修飾臉部', '移除物件', '添加光影'];

const BRUSH_COLORS = {
    'White': 'rgba(255, 255, 255, 0.5)',
    'Black': 'rgba(0, 0, 0, 0.5)',
    'Cyan': 'rgba(0, 245, 212, 0.5)',
    'Pink': 'rgba(255, 0, 247, 0.5)',
    'Purple': 'rgba(157, 0, 255, 0.5)',
};

type Tool = 'brush' | 'eraser';

export const InpaintingModal: React.FC<InpaintingModalProps> = ({ element, onClose, onGenerate, prompt, onPromptChange, onRequestInspiration, onOptimizePrompt }) => {
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null); // Visible canvas
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); // Offscreen solid mask
    
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushColor, setBrushColor] = useState(BRUSH_COLORS['White']);
    const [lineWidth, setLineWidth] = useState(40);
    const [activeTool, setActiveTool] = useState<Tool>('brush');
    
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showBrushPreview, setShowBrushPreview] = useState(false);
    const [brushCursorPosition, setBrushCursorPosition] = useState<Point | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState('生成中...');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [sliderPosition, setSliderPosition] = useState(50);
    const compareContainerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: Math.min(1200, window.innerWidth * 0.9), height: Math.min(800, window.innerHeight * 0.9) });

    const lastPointRef = useRef<Point | null>(null);

    const isReEdit = element.type === 'imageCompare' && element.wasInpainted;
    const baseImageSrc = element.type === 'imageCompare' ? element.srcBefore : element.src;
    const initialMaskSrc = isReEdit ? element.maskSrc : undefined;
    
    const getDrawingContext = useCallback(() => drawingCanvasRef.current?.getContext('2d'), []);
    const getMaskContext = useCallback(() => maskCanvasRef.current?.getContext('2d'), []);

    const syncVisibleCanvas = useCallback(() => {
        const visibleCtx = getDrawingContext();
        const maskCanvas = maskCanvasRef.current;
        if (!visibleCtx || !maskCanvas) return;

        visibleCtx.clearRect(0, 0, visibleCtx.canvas.width, visibleCtx.canvas.height);
        
        visibleCtx.fillStyle = brushColor;
        visibleCtx.fillRect(0, 0, visibleCtx.canvas.width, visibleCtx.canvas.height);

        visibleCtx.globalCompositeOperation = 'destination-in';
        visibleCtx.drawImage(maskCanvas, 0, 0);

        visibleCtx.globalCompositeOperation = 'source-over';

    }, [getDrawingContext, brushColor]);

    const saveHistory = useCallback(() => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(canvas.toDataURL());
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const restoreCanvasFromHistory = useCallback(() => {
        if (historyIndex < 0 || history.length === 0) {
            const maskCtx = getMaskContext();
            if (maskCtx) {
                maskCtx.clearRect(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);
                syncVisibleCanvas();
            }
            return;
        };
        const dataUrl = history[historyIndex];
        const maskCtx = getMaskContext();
        if (maskCtx) {
            const img = new Image();
            img.onload = () => {
                maskCtx.clearRect(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);
                maskCtx.drawImage(img, 0, 0);
                syncVisibleCanvas();
            };
            img.src = dataUrl;
        }
    }, [history, historyIndex, getMaskContext, syncVisibleCanvas]);
    
    useEffect(() => {
        restoreCanvasFromHistory();
    }, [historyIndex, restoreCanvasFromHistory]);

    const setupCanvases = useCallback(() => {
        const bgCanvas = backgroundCanvasRef.current;
        const drawCanvas = drawingCanvasRef.current;
        if (!bgCanvas || !drawCanvas || !maskCanvasRef.current) return;
        
        const container = bgCanvas.parentElement?.parentElement; // The flex container
        if (!container) return;

        const img = new Image();
        img.src = baseImageSrc;
        if(!img.width || !img.height) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const scale = Math.min(containerWidth / img.width, containerHeight / img.height);
        const displayWidth = img.width * scale;
        const displayHeight = img.height * scale;
        
        bgCanvas.style.width = `${displayWidth}px`;
        bgCanvas.style.height = `${displayHeight}px`;
        drawCanvas.style.width = `${displayWidth}px`;
        drawCanvas.style.height = `${displayHeight}px`;

    }, [baseImageSrc]);

    useEffect(() => {
        const bgCanvas = backgroundCanvasRef.current;
        const drawCanvas = drawingCanvasRef.current;
        if (!bgCanvas || !drawCanvas) return;

        maskCanvasRef.current = document.createElement('canvas');
        const maskCanvas = maskCanvasRef.current;
        
        const bgCtx = bgCanvas.getContext('2d');
        if (!bgCtx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            bgCanvas.width = drawCanvas.width = maskCanvas.width = img.width;
            bgCanvas.height = drawCanvas.height = maskCanvas.height = img.height;
            setupCanvases();

            bgCtx.drawImage(img, 0, 0);
            
            const maskCtx = getMaskContext();
            if(!maskCtx) return;

            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            const blankDataUrl = maskCanvas.toDataURL();

            if (initialMaskSrc) {
                const maskImg = new Image();
                maskImg.crossOrigin = 'anonymous';
                maskImg.onload = () => {
                    maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
                    const dataUrl = maskCanvas.toDataURL();
                    setHistory([blankDataUrl, dataUrl]);
                    setHistoryIndex(1);
                    syncVisibleCanvas();
                };
                maskImg.src = initialMaskSrc;
            } else {
                setHistory([blankDataUrl]);
                setHistoryIndex(0);
                syncVisibleCanvas();
            }
        };
        img.src = baseImageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseImageSrc, initialMaskSrc]);

    useEffect(() => {
        window.addEventListener('resize', setupCanvases);
        return () => window.removeEventListener('resize', setupCanvases);
    }, [setupCanvases]);

    useEffect(() => {
        setupCanvases();
    }, [size, setupCanvases]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
        }
    };
    
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
        }
    };

    const handleClear = () => {
        const ctx = getMaskContext();
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            syncVisibleCanvas();
            saveHistory();
        }
    };

    const getMousePos = (e: React.MouseEvent): Point => {
        const canvas = drawingCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startDrawing = (e: React.MouseEvent) => {
        const ctx = getMaskContext();
        if (!ctx) return;
        setIsDrawing(true);
        lastPointRef.current = getMousePos(e);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'white';
        ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';

        ctx.beginPath();
        ctx.arc(lastPointRef.current.x, lastPointRef.current.y, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        syncVisibleCanvas();
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const ctx = getMaskContext();
        const currentPoint = getMousePos(e);
        if (ctx && lastPointRef.current) {
            ctx.beginPath();
            ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctx.lineTo(currentPoint.x, currentPoint.y);
            ctx.stroke();
        }
        lastPointRef.current = currentPoint;
        syncVisibleCanvas();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            lastPointRef.current = null;
            saveHistory();
        }
    };
    
    const handleAddQuickPrompt = (p: string) => {
        onPromptChange(prompt ? `${prompt}, ${p}` : p);
    };

    const handleGenerateClick = async () => {
        const maskShapeCanvas = maskCanvasRef.current;
        if (!maskShapeCanvas) return;

        setIsGenerating(true);
        setGenerationStatus('生成中...');

        const finalMaskCanvas = document.createElement('canvas');
        finalMaskCanvas.width = maskShapeCanvas.width;
        finalMaskCanvas.height = maskShapeCanvas.height;
        const finalMaskCtx = finalMaskCanvas.getContext('2d');
        if (!finalMaskCtx) {
            setIsGenerating(false);
            return;
        }
        
        finalMaskCtx.fillStyle = 'black';
        finalMaskCtx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
        finalMaskCtx.drawImage(maskShapeCanvas, 0, 0);

        const maskDataUrl = finalMaskCanvas.toDataURL('image/png');
        const newImageSrc = await onGenerate(element, maskDataUrl, prompt);
        
        if (newImageSrc) {
            setGeneratedImage(newImageSrc);
        }
        
        setIsGenerating(false);
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

    const renderEditingView = () => (
        <>
            <div className="relative flex-1 min-h-0 flex items-center justify-center">
                <div className="relative">
                    <canvas ref={backgroundCanvasRef} className="block rounded-lg bg-slate-800" />
                    <canvas 
                        ref={drawingCanvasRef} 
                        className="absolute top-0 left-0 rounded-lg cursor-none"
                        onMouseDown={startDrawing}
                        onMouseMove={(e) => { draw(e); setBrushCursorPosition(getMousePos(e)); }}
                        onMouseUp={stopDrawing}
                        onMouseLeave={() => { stopDrawing(); setBrushCursorPosition(null); }}
                    />
                    {showBrushPreview && (() => {
                        const canvas = drawingCanvasRef.current;
                        if (!canvas) return null;
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) return null;
                        const displaySize = lineWidth * (rect.width / canvas.width);
                        
                        return (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div 
                                    className="border-2 border-dashed border-white/50 rounded-full"
                                    style={{ width: displaySize, height: displaySize }}
                                />
                            </div>
                        );
                    })()}
                    {brushCursorPosition && !showBrushPreview && (()=>{
                        const canvas = drawingCanvasRef.current;
                        if (!canvas) return null;
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) return null;
                        
                        const displayX = brushCursorPosition.x / (canvas.width / rect.width);
                        const displayY = brushCursorPosition.y / (canvas.height / rect.height);
                        const displayWidth = lineWidth / (canvas.width / rect.width);
                        
                        return (
                            <div
                                className="absolute border border-dashed border-white rounded-full pointer-events-none"
                                style={{
                                    left: displayX,
                                    top: displayY,
                                    width: displayWidth,
                                    height: displayWidth,
                                    transform: `translate(-50%, -50%)`,
                                }}
                            />
                        );
                    })()}
                     {isGenerating && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg">
                             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cyber-cyan)]"></div>
                             <p className="mt-4 text-md text-white">{generationStatus}</p>
                        </div>
                    )}
                </div>
            </div>
             <div className="flex flex-col gap-2 flex-shrink-0">
                <div className="flex items-start gap-2">
                    <textarea 
                        placeholder="描述你想在塗抹區域看到的内容..."
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
                 <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map(p => (
                         <button key={p} onClick={() => handleAddQuickPrompt(p)} className="px-3 py-1 text-xs rounded-full bg-slate-700 text-gray-300 hover:bg-slate-600">
                            {p}
                        </button>
                    ))}
                </div>
                <div className="h-px bg-slate-700 my-1" />
                 <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 whitespace-nowrap">筆刷尺寸:</span>
                        <input 
                            type="range" min="1" max="150" value={lineWidth} 
                            onChange={e => setLineWidth(parseInt(e.target.value))}
                            onMouseDown={() => setShowBrushPreview(true)}
                            onMouseUp={() => setShowBrushPreview(false)}
                            onMouseLeave={() => setShowBrushPreview(false)}
                            className="w-24"
                        />
                         <span className="text-sm text-gray-400 w-8 text-center">{lineWidth}px</span>
                    </div>
                     <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg">
                         {Object.entries(BRUSH_COLORS).map(([name, colorValue]) => (
                            <button
                                key={name}
                                title={name}
                                onClick={() => setBrushColor(colorValue)}
                                className={`w-6 h-6 rounded-full border-2 ${brushColor === colorValue ? 'border-white' : 'border-transparent'}`}
                                style={{ backgroundColor: colorValue }}
                            />
                         ))}
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg">
                        <button title="筆刷" onClick={() => setActiveTool('brush')} className={`p-2 rounded-lg ${activeTool === 'brush' ? 'bg-cyan-500/30' : 'hover:bg-slate-700'}`}><Brush size={18} /></button>
                        <button title="橡皮擦" onClick={() => setActiveTool('eraser')} className={`p-2 rounded-lg ${activeTool === 'eraser' ? 'bg-cyan-500/30' : 'hover:bg-slate-700'}`}><Eraser size={18} /></button>
                        <div className="w-px h-6 bg-slate-700 mx-1" />
                        <button title="復原" onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><Undo size={18} /></button>
                        <button title="重做" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><Redo size={18} /></button>
                        <button title="清除" onClick={handleClear} className="p-2 rounded-lg hover:bg-slate-700"><Trash2 size={18} /></button>
                    </div>
                 </div>
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-gray-200 rounded-md hover:bg-slate-600">離開</button>
                    <button onClick={handleGenerateClick} disabled={isGenerating} className="px-4 py-2 bg-[var(--cyber-cyan)] text-black font-bold rounded-md hover:bg-cyan-300 flex items-center gap-2">
                        <Wand2 size={16}/>
                        {isGenerating ? '生成中...' : '生成'}
                    </button>
                </div>
            </div>
        </>
    );

    const renderResultView = () => (
        <>
            <div 
                ref={compareContainerRef}
                className="relative cursor-ew-resize overflow-hidden rounded-lg bg-slate-800 flex-1 flex items-center justify-center"
                onMouseMove={handleMouseMoveCompare}
            >
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
                    <img src={generatedImage!} alt="After" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                </div>
                <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                    <img src={baseImageSrc} alt="Before" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                </div>
                <div className="absolute top-0 bottom-0 w-1 bg-orange-500 pointer-events-none" style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}>
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                        <ChevronsLeftRight size={16} className="text-white" />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
                <button onClick={() => setGeneratedImage(null)} className="px-4 py-2 bg-slate-700 text-gray-200 rounded-md hover:bg-slate-600">繼續編輯</button>
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
                <h2 className="text-xl font-bold text-[var(--cyber-cyan)] flex-shrink-0">Inpaint / 局部重繪</h2>
                {generatedImage ? renderResultView() : renderEditingView()}
                <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" onMouseDown={handleResizeMouseDown} />
            </div>
        </div>
    );
};