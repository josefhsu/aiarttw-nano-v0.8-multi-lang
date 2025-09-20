import React, { useState, useCallback, useEffect } from 'react';
import type { Point } from '../types';
import { useI18n } from '../hooks/useI18n';

interface CaptureBoxProps {
  onCapture: (box: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

type Action = 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null;

const aspectRatios = [
    { value: 0, text: 'Free' },
    { value: 16 / 9, text: '16:9' },
    { value: 9 / 16, text: '9:16' },
    { value: 4 / 3, text: '4:3' },
    { value: 3 / 4, text: '3:4' },
    { value: 1 / 1, text: '1:1' },
];

export const CaptureBox: React.FC<CaptureBoxProps> = ({ onCapture, onCancel }) => {
  const { t } = useI18n();
  const [box, setBox] = useState({
    x: window.innerWidth / 2 - 250,
    y: window.innerHeight / 2 - 150,
    width: 500,
    height: 300,
  });
  const [action, setAction] = useState<Action>(null);
  const [startDrag, setStartDrag] = useState<{ mouseX: number; mouseY: number; box: typeof box } | null>(null);
  const [aspect, setAspect] = useState(aspectRatios[0].value);

  const handleMouseDown = useCallback((e: React.MouseEvent, newAction: Action) => {
    e.stopPropagation();
    e.preventDefault();
    setAction(newAction);
    setStartDrag({ mouseX: e.clientX, mouseY: e.clientY, box });
  }, [box]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!action || !startDrag) return;

    const dx = e.clientX - startDrag.mouseX;
    const dy = e.clientY - startDrag.mouseY;
    let newBox = { ...startDrag.box };

    switch (action) {
      case 'move':
        newBox.x = startDrag.box.x + dx;
        newBox.y = startDrag.box.y + dy;
        break;
      case 'resize-br':
        newBox.width = Math.max(20, startDrag.box.width + dx);
        newBox.height = aspect ? newBox.width / aspect : Math.max(20, startDrag.box.height + dy);
        break;
      case 'resize-bl':
        newBox.width = Math.max(20, startDrag.box.width - dx);
        newBox.x = startDrag.box.x + dx;
        newBox.height = aspect ? newBox.width / aspect : Math.max(20, startDrag.box.height + dy);
        break;
      case 'resize-tr':
        newBox.width = Math.max(20, startDrag.box.width + dx);
        newBox.y = startDrag.box.y + dy;
        newBox.height = aspect ? newBox.width / aspect : Math.max(20, startDrag.box.height - dy);
        if (aspect) newBox.y = startDrag.box.y + (startDrag.box.height - newBox.height);
        break;
      case 'resize-tl':
        newBox.width = Math.max(20, startDrag.box.width - dx);
        newBox.x = startDrag.box.x + dx;
        newBox.y = startDrag.box.y + dy;
        newBox.height = aspect ? newBox.width / aspect : Math.max(20, startDrag.box.height - dy);
        if (aspect) newBox.y = startDrag.box.y + (startDrag.box.height - newBox.height);
        break;
    }
    setBox(newBox);
  }, [action, startDrag, aspect]);

  const handleMouseUp = useCallback(() => {
    setAction(null);
    setStartDrag(null);
  }, []);

  useEffect(() => {
    if (action) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [action, handleMouseMove, handleMouseUp]);
  
  const handleConfirm = () => {
    if (box.width > 10 && box.height > 10) {
      onCapture(box);
    } else {
      onCancel();
    }
  };
  
  const ResizeHandle: React.FC<{position: 'tl'|'tr'|'bl'|'br', onMouseDown: (e: React.MouseEvent) => void}> = ({position, onMouseDown}) => {
    const cursorMap = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize'};
    const posMap = { tl: {top: -5, left: -5}, tr: {top: -5, right: -5}, bl: {bottom: -5, left: -5}, br: {bottom: -5, right: -5}};
    return <div className="absolute w-3 h-3 bg-white border border-[var(--cyber-cyan)] rounded-full" style={{...posMap[position], cursor: cursorMap[position]}} onMouseDown={onMouseDown} />;
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
       <div className="absolute inset-0" onClick={onCancel} />
       <div
          className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/10 cursor-move"
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          onMouseDown={(e) => handleMouseDown(e, 'move')}
       >
          <ResizeHandle position="tl" onMouseDown={(e) => handleMouseDown(e, 'resize-tl')} />
          <ResizeHandle position="tr" onMouseDown={(e) => handleMouseDown(e, 'resize-tr')} />
          <ResizeHandle position="bl" onMouseDown={(e) => handleMouseDown(e, 'resize-bl')} />
          <ResizeHandle position="br" onMouseDown={(e) => handleMouseDown(e, 'resize-br')} />
          <div className="absolute bottom-[-80px] left-1/2 -translate-x-1/2 bg-slate-800/80 p-2 rounded-lg flex flex-col items-center gap-2">
            <div className='flex items-center gap-2'>
              {aspectRatios.map(ar => (
                <button key={ar.text} onClick={(e) => { e.stopPropagation(); setAspect(ar.value); }} className={`px-3 py-1 text-xs rounded-md ${aspect.toFixed(4) === ar.value.toFixed(4) ? 'bg-[var(--cyber-cyan)] text-black' : 'bg-slate-700 text-gray-300'}`}>
                  {ar.text}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleConfirm} className="px-4 py-2 bg-[var(--cyber-cyan)] text-black font-bold rounded-md hover:bg-cyan-300">{t('captureBox.confirm')}</button>
                <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-gray-200 rounded-md hover:bg-slate-600">{t('captureBox.cancel')}</button>
            </div>
          </div>
       </div>
    </div>
  );
};