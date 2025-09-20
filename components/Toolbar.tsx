import React from 'react';
import { StickyNote, Image, Pen, Camera, MousePointer, Hand, ZoomIn, ZoomOut, Redo, Undo, ArrowUpRight, ClipboardPaste, Maximize, Focus, Frame, ChevronUp, GitCompare, Brush, Crop } from 'lucide-react';
import { useI18n } from '../hooks/useI18n';

export type Tool = 'select' | 'pan' | 'arrow';

interface ToolbarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onAddNote: () => void;
  onAddImage: () => void;
  onAddPlaceholder: () => void;
  onAddImageCompare: () => void;
  onAddInpaintPlaceholder: () => void;
  onAddOutpaintPlaceholder: () => void;
  onPaste: () => void;
  onDraw: () => void;
  onCamera: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitScreen: () => void;
  onCenterView: () => void;
}

const IconButton: React.FC<{ active?: boolean, onClick: () => void, children: React.ReactNode, title: string, disabled?: boolean }> = 
  ({ active, onClick, children, title, disabled }) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors ${
        active ? 'bg-[var(--cyber-cyan)] text-black' : 'hover:bg-slate-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
);

export const Toolbar: React.FC<ToolbarProps> = ({
  isOpen, setIsOpen, activeTool, onToolChange, onAddNote, onAddImage, onAddPlaceholder, onAddImageCompare, onAddInpaintPlaceholder, onAddOutpaintPlaceholder, onPaste, onDraw, onCamera,
  canUndo, onUndo, canRedo, onRedo, zoom, onZoomChange, onFitScreen, onCenterView
}) => {
  const { t } = useI18n();
  return (
    <div 
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'}`}
        onMouseLeave={() => setIsOpen(false)}
    >
        <div
            onMouseEnter={() => setIsOpen(true)}
            className="p-4 -mb-4" // Larger invisible hover area
        >
            <button
                onClick={() => setIsOpen(false)}
                className="w-24 h-12 bg-slate-900/80 backdrop-blur-md rounded-t-lg border-t border-x border-[var(--cyber-border)] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                title={t('toolbar.title')}
            >
                <span className="mr-2 text-xs">{t('toolbar.tools')}</span>
                <ChevronUp className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md rounded-xl shadow-2xl border border-[var(--cyber-border)] p-2 flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg">
                <IconButton title={t('toolbar.select')} active={activeTool === 'select'} onClick={() => onToolChange('select')}><MousePointer size={20} /></IconButton>
                <IconButton title={t('toolbar.pan')} active={activeTool === 'pan'} onClick={() => onToolChange('pan')}><Hand size={20} /></IconButton>
            </div>
            <div className="w-px h-8 bg-slate-700 mx-1" />
            <div className="flex items-center gap-1">
                <IconButton title={t('toolbar.addNote')} onClick={onAddNote}><StickyNote size={20} /></IconButton>
                <IconButton title={t('toolbar.addArrow')} active={activeTool === 'arrow'} onClick={() => onToolChange('arrow')}><ArrowUpRight size={20} /></IconButton>
                <IconButton title={t('toolbar.addImage')} onClick={onAddImage}><Image size={20} /></IconButton>
                <IconButton title={t('toolbar.addInpaint')} onClick={onAddInpaintPlaceholder}><Brush size={20} /></IconButton>
                <IconButton title={t('toolbar.addOutpaint')} onClick={onAddOutpaintPlaceholder}><Crop size={20} /></IconButton>
                <IconButton title={t('toolbar.addCompare')} onClick={onAddImageCompare}><GitCompare size={20} /></IconButton>
                <IconButton title={t('toolbar.paste')} onClick={onPaste}><ClipboardPaste size={20} /></IconButton>
                <IconButton title={t('toolbar.draw')} onClick={onDraw}><Pen size={20} /></IconButton>
                <IconButton title={t('toolbar.camera')} onClick={onCamera}><Camera size={20} /></IconButton>
                <IconButton title={t('toolbar.addPlaceholder')} onClick={onAddPlaceholder}><Frame size={20} /></IconButton>
            </div>
            <div className="w-px h-8 bg-slate-700 mx-1" />
            <div className="flex items-center gap-1">
                <IconButton title={t('toolbar.undo')} onClick={onUndo} disabled={!canUndo}><Undo size={20} /></IconButton>
                <IconButton title={t('toolbar.redo')} onClick={onRedo} disabled={!canRedo}><Redo size={20} /></IconButton>
            </div>
            <div className="w-px h-8 bg-slate-700 mx-1" />
            <div className="flex items-center gap-2 text-sm text-gray-300">
                <IconButton title={t('toolbar.zoomOut')} onClick={() => onZoomChange(zoom / 1.2)}><ZoomOut size={20} /></IconButton>
                <span className="w-12 text-center cursor-pointer" title={t('toolbar.resetZoom')} onClick={() => onZoomChange(1)}>{Math.round(zoom * 100)}%</span>
                <IconButton title={t('toolbar.zoomIn')} onClick={() => onZoomChange(zoom * 1.2)}><ZoomIn size={20} /></IconButton>
                <div className="w-px h-8 bg-slate-700 mx-1" />
                <IconButton title={t('toolbar.fitScreen')} onClick={onFitScreen}><Maximize size={20} /></IconButton>
                <IconButton title={t('toolbar.centerView')} onClick={onCenterView}><Focus size={20} /></IconButton>
            </div>
        </div>
    </div>
  );
};
