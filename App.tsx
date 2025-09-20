import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useCanvasState } from './hooks/useCanvasState';
import { useZIndexManager } from './hooks/useZIndexManager';
import { useConnections } from './hooks/useConnections';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useI18n } from './hooks/useI18n';

import { InfiniteCanvas } from './components/InfiniteCanvas';
import { Toolbar, Tool } from './components/Toolbar';
import { FloatingToolbar } from './components/FloatingToolbar';
import { LayersPanel } from './components/LayersPanel';
import { Navigator } from './components/Navigator';
import { DrawingModal } from './components/DrawingModal';
import { OutpaintingModal } from './components/CroppingModal';
import { InpaintingModal } from './components/InpaintingModal';
import { CameraModal } from './components/CameraModal';
import { ContextMenu, ContextMenuItem } from './components/ContextMenu';
import { InspirationModal } from './components/InspirationModal';
import { InspirationPanel } from './components/InspirationPanel';
import { CinematicPanel } from './components/CinematicPanel';
import { ShortcutHints } from './components/ShortcutHints';
import { MusicPlayer } from './components/MusicPlayer';
import { LyricsDisplay } from './components/LyricsDisplay';
import { CaptureBox } from './components/CaptureBox';
import { AlignmentPopover } from './components/AlignmentPopover';
import { Lightbox } from './LightboxComponents';
import { LoadingOverlay } from './components/LoadingOverlay';

import type { CanvasElement, DrawingElement, ImageElement, ImageCompareElement, NoteElement } from './types';
import { Edit, Group, Wand2 } from 'lucide-react';
import { calculateNoteHeight } from './utils';

interface ContextualActionModalProps {
  onClose: () => void;
  onSelectAction: (action: 'prompt' | 'group' | 'generate') => void;
}

const ContextualActionModal: React.FC<ContextualActionModalProps> = ({ onClose, onSelectAction }) => {
    const { t } = useI18n();
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm" onMouseDown={onClose}>
            <div
                className="bg-[var(--cyber-bg)] border border-[var(--cyber-border)] p-6 rounded-xl shadow-2xl flex flex-col gap-4 w-full max-w-md"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-[var(--cyber-cyan)] text-center">{t('app.contextualActionTitle')}</h2>
                <p className="text-sm text-gray-400 text-center -mt-2">{t('app.contextualActionDesc')}</p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => onSelectAction('prompt')}
                        className="w-full text-left p-4 bg-slate-800/50 rounded-md text-gray-200 hover:bg-slate-700/80 border border-transparent hover:border-cyan-500 transition-all flex items-center gap-4"
                    >
                        <Edit className="text-cyan-400" />
                        <div>
                            <h3 className="font-bold">{t('app.contextActionPromptTitle')}</h3>
                            <p className="text-xs text-gray-400">{t('app.contextActionPromptDesc')}</p>
                        </div>
                    </button>
                    <button
                        onClick={() => onSelectAction('group')}
                        className="w-full text-left p-4 bg-slate-800/50 rounded-md text-gray-200 hover:bg-slate-700/80 border border-transparent hover:border-cyan-500 transition-all flex items-center gap-4"
                    >
                        <Group className="text-cyan-400" />
                        <div>
                            <h3 className="font-bold">{t('app.contextActionGroupTitle')}</h3>
                            <p className="text-xs text-gray-400">{t('app.contextActionGroupDesc')}</p>
                        </div>
                    </button>
                    <button
                        onClick={() => onSelectAction('generate')}
                        className="w-full text-left p-4 bg-slate-800/50 rounded-md text-gray-200 hover:bg-slate-700/80 border border-transparent hover:border-cyan-500 transition-all flex items-center gap-4"
                    >
                        <Wand2 className="text-cyan-400" />
                        <div>
                            <h3 className="font-bold">{t('app.contextActionGenerateTitle')}</h3>
                            <p className="text-xs text-gray-400">{t('app.contextActionGenerateDesc')}</p>
                        </div>
                    </button>
                </div>
                <div className="flex justify-end mt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-500">{t('app.cancel')}</button>
                </div>
            </div>
        </div>
    );
};

export const App: React.FC = () => {
    const { t } = useI18n();
    const {
        elements, setElements, undo, redo, canUndo, canRedo,
        viewport, setViewport,
        selectedElementIds, setSelectedElementIds,
        lockedGroupIds, setLockedGroupIds,
        singlySelectedIdInGroup, setSinglySelectedIdInGroup
    } = useCanvasState();

    const { ensureArrowPriority } = useZIndexManager(elements, setElements);

    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [previousTool, setPreviousTool] = useState<Tool>('select');
    
    const [lastInteractedLayerId, setLastInteractedLayerId] = useState<string | null>(null);
    const [ghostElements, setGhostElements] = useState<CanvasElement[] | null>(null);

    const [prompts, setPrompts] = useState<Record<string, string>>({});
    const [aspectRatios, setAspectRatios] = useState<Record<string, number | null>>({});
    const [artStyles, setArtStyles] = useState<Record<string, string>>({});

    const [isInspirationPanelOpen, setIsInspirationPanelOpen] = useState(false);
    const [isCinematicPanelOpen, setIsCinematicPanelOpen] = useState(false);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [isToolbarOpen, setIsToolbarOpen] = useState(false);
    const [isAnimationActive, setIsAnimationActive] = useState(true);
    const [isCapturing, setIsCapturing] = useState(false);
    const [contextualAction, setContextualAction] = useState<{prompt: string, selectedIds: string[]} | null>(null);


    const isSpacePanning = useRef(false);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const screenToCanvasCoords = useCallback((screenPoint: { x: number; y: number; }) => {
        return {
            x: (screenPoint.x - viewport.pan.x) / viewport.zoom,
            y: (screenPoint.y - viewport.pan.y) / viewport.zoom,
        };
    }, [viewport.pan, viewport.zoom]);

    const {
        connections,
        newConnection,
        handleStartConnection,
        handleClearConnections,
        updateConnection,
    } = useConnections({
        elements,
        setElements,
        lockedGroupIds,
        setLockedGroupIds,
        screenToCanvasCoords
    });
    
    const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
    const [inspirationData, setInspirationData] = useState<{ modificationSuggestions: string[], textPrompts: string[] } | null>(null);
    const [inspirationConfirm, setInspirationConfirm] = useState<{ elementId?: string; onApplyCallback?: (newPrompt: string) => void; isSingleChoice?: boolean } | null>(null);


    const {
        addElement,
        addNote,
        addPlaceholder,
        addInpaintPlaceholder,
        addOutpaintPlaceholder,
        addImageCompare,
        addImageFromUpload,
        addDrawing,
        updateElements,
        handleCommitHistory,
        deleteElements,
        duplicateElements,
        handleAltDragDuplicate,
        reorderElements,
        handleGroup,
        handleUngroup,
        handleToggleGroupLock,
        handleAddLayerToGroup,
        handleFitScreen,
        handleCenterView,
        handlePaste,
        handleReplacePlaceholder,
        handleReplacePlaceholderWithImageAndEdit,
        handleFillPlaceholderFromCamera,
        handleFillPlaceholderFromPaste,
        handleCameraCapture,
        handleTriggerCameraForCompare,
        handleTriggerPasteForCompare,
        handleAIGenerate,
        handleAIZoomOut,
        handleAIGroupGenerate,
        handleNoteGenerate,
        handleRequestInspiration,
        onOptimizeSingleElementPrompt,
        handleCreateComparison,
        handleConvertToComparison,
        handleUnpackComparison,
        handleAIOutpaint,
        handleInpaintGenerate,
        handleContextualGeneration,
        handleCreateAndProcessGroup,
        handleModalRequestInspiration,
        handleModalOptimizePrompt,
        captureScreen,
        isGenerating,
        generationStatus,
        isDrawing, setIsDrawing,
        drawingToEdit, setDrawingToEdit,
        outpaintingElement, setOutpaintingElement,
        inpaintingElement, setInpaintingElement,
        isTakingPhoto, setIsTakingPhoto,
        placeholderTarget,
        setPlaceholderTarget,
        imageCompareTarget,
        setImageCompareTarget,
        modalPrompt, setModalPrompt,
        musicHandlers,
        fileInputRef,
        handleFileUploads,
        handleTriggerSandevistanMode,
        handleDropOnCanvas,
    } = useCanvasHandlers({
        elements,
        setElements,
        viewport,
        setViewport,
        canvasSize,
        screenToCanvasCoords,
        prompts,
        setPrompts,
        aspectRatios,
        setAspectRatios,
        artStyles,
        setArtStyles,
        setSelectedElementIds,
        setSinglySelectedIdInGroup,
        ensureArrowPriority,
        selectedElementIds,
        lockedGroupIds,
        setLockedGroupIds,
        setIsCapturing,
        setIsInspirationModalOpen,
        setInspirationData,
        setInspirationConfirm,
    });
    
    const {
        isMusicPlayerVisible, setIsMusicPlayerVisible,
        isPlaying, currentTrackName, isLibraryEmpty, musicTracks, currentTrackIndex,
        repeatMode, isShuffle, playlists, activePlaylistName,
        currentTime, duration, currentLyric,
        handlePlayPause, handleStop, handleNextTrack, handlePrevTrack, handleSelectTrack,
        handleFolderUpload, handleMusicDrop, handleLrcUpload, handleClearMusic,
        handleReloadFromLocal, handleCycleRepeatMode, handleToggleShuffle,
        handleSwitchPlaylist, handleDeleteTrack, handleSaveCurrentTracksAsPlaylist,
        handleExportPlaylists, handleImportPlaylists, handleSeek,
        musicUploadRefForLink
    } = musicHandlers;


    const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
    
    const onTriggerContextualAction = useCallback((prompt: string) => {
        const imageSelections = selectedElements.filter(el => el.type === 'image' || el.type === 'drawing');
        if (imageSelections.length > 0) {
            setContextualAction({ prompt, selectedIds: imageSelections.map(el => el.id) });
        } else {
            // Fallback: create a note with the prompt
            const noteWidth = 250;
            const noteHeight = calculateNoteHeight(prompt, noteWidth, 16);
            const center = screenToCanvasCoords({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
            addElement({
                type: 'note',
                content: prompt,
                color: 'var(--cyber-cyan)',
                fontSize: 16,
                position: { x: center.x - noteWidth / 2, y: center.y - noteHeight / 2 },
                width: noteWidth,
                height: noteHeight,
                rotation: 0
            } as Omit<NoteElement, 'id' | 'zIndex'>);
        }
    }, [selectedElements, addElement, screenToCanvasCoords, canvasSize]);

    const handleContextualActionSelected = (action: 'prompt' | 'group' | 'generate') => {
        if (!contextualAction) return;
        const { prompt, selectedIds } = contextualAction;
        if (action === 'prompt') {
            handleContextualGeneration(prompt);
        } else if (action === 'group') {
            handleCreateAndProcessGroup(selectedIds, prompt, 'suggest');
        } else if (action === 'generate') {
            handleCreateAndProcessGroup(selectedIds, prompt, 'generate');
        }
        setContextualAction(null);
    };

    const handleSelectElements = (ids: string[], additive = false) => {
        const clickedElement = ids.length === 1 ? elements.find(el => el.id === ids[0]) : null;

        if (clickedElement && clickedElement.groupId && lockedGroupIds.has(clickedElement.groupId) && selectedElementIds.includes(clickedElement.id)) {
            setSinglySelectedIdInGroup(prevId => prevId === clickedElement.id ? null : clickedElement.id);
            return;
        }

        setSinglySelectedIdInGroup(null);
        let finalSelection = new Set<string>();

        const groupId = clickedElement?.groupId;
        if (groupId && lockedGroupIds.has(groupId)) {
            elements.forEach(el => {
                if (el.groupId === groupId) finalSelection.add(el.id);
            });
        } else if (additive) {
            finalSelection = new Set(selectedElementIds);
            ids.forEach(id => {
                if (finalSelection.has(id)) {
                    if (selectedElementIds.length > 1) finalSelection.delete(id);
                } else {
                    finalSelection.add(id);
                }
            });
        } else {
            finalSelection = new Set(ids);
        }
        setSelectedElementIds(Array.from(finalSelection));
        if (ids.length === 1) {
            setLastInteractedLayerId(ids[0]);
        }
    };

    const handleLayerSelect = (clickedId: string, e: React.MouseEvent) => {
        const isCmdCtrl = e.metaKey || e.ctrlKey;
        const isShift = e.shiftKey;

        const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const sortedIds = sortedElements.map(el => el.id);

        let newSelectedIds: string[];

        if (isShift && lastInteractedLayerId) {
            const lastIdx = sortedIds.indexOf(lastInteractedLayerId);
            const currentIdx = sortedIds.indexOf(clickedId);
            if (lastIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx);
                const end = Math.max(lastIdx, currentIdx);
                newSelectedIds = sortedIds.slice(start, end + 1);
            } else {
                newSelectedIds = [clickedId];
            }
        } else if (isCmdCtrl) {
            const newSelectionSet = new Set(selectedElementIds);
            if (newSelectionSet.has(clickedId)) {
                newSelectionSet.delete(clickedId);
            } else {
                newSelectionSet.add(clickedId);
            }
            newSelectedIds = Array.from(newSelectionSet);
        } else {
            newSelectedIds = [clickedId];
        }

        setSelectedElementIds(newSelectedIds);
        setLastInteractedLayerId(clickedId);
    };
    
    const handleLayerReorder = (elementId: string, newVisualIndex: number) => {
        const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const targetZ = sortedElements[newVisualIndex]?.zIndex;
        const prevZ = sortedElements[newVisualIndex - 1]?.zIndex;
        
        let newZIndex: number;
        if (targetZ !== undefined && prevZ !== undefined) {
          newZIndex = (targetZ + prevZ) / 2;
        } else if (targetZ !== undefined) {
          newZIndex = targetZ - 1;
        } else if (prevZ !== undefined) {
          newZIndex = prevZ + 1;
        } else {
          newZIndex = 1;
        }
        
        updateElements([{ id: elementId, data: { zIndex: newZIndex }}]);
    };
    
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const targetElementDiv = (e.target as HTMLElement).closest('[data-element-id]');
        const clickedElementId = targetElementDiv?.getAttribute('data-element-id');
    
        const items: ContextMenuItem[] = [];
    
        if (clickedElementId) {
            const clickedElement = elements.find(el => el.id === clickedElementId);
            let currentSelection = selectedElements;
    
            if (!selectedElementIds.includes(clickedElementId)) {
                handleSelectElements([clickedElementId]);
                currentSelection = clickedElement ? [clickedElement] : [];
            }
    
            items.push({ label: t('contextMenu.copy', { count: currentSelection.length }), action: () => duplicateElements(currentSelection.map(el => el.id)) });
            items.push({ label: t('contextMenu.delete', { count: currentSelection.length }), action: () => deleteElements(currentSelection.map(el => el.id)) });
            items.push({ type: 'separator' });
            items.push({ label: t('contextMenu.bringToFront'), action: () => reorderElements('front', currentSelection.map(el => el.id)) });
            items.push({ label: t('contextMenu.sendToBack'), action: () => reorderElements('back', currentSelection.map(el => el.id)) });
    
            if (currentSelection.length > 1) {
                const firstGroupId = currentSelection[0].groupId;
                const isGrouped = firstGroupId && currentSelection.every(el => el.groupId === firstGroupId);
                if (isGrouped) {
                    items.push({ label: t('contextMenu.ungroup'), action: handleUngroup });
                } else {
                    items.push({ label: t('contextMenu.group'), action: handleGroup });
                }
            }
    
            if (currentSelection.length === 1) {
                const el = currentSelection[0];
                items.push({ type: 'separator' });
                if (el.type === 'image' || el.type === 'drawing') {
                    items.push({ label: t('contextMenu.inpaint'), action: () => { setInpaintingElement(el); setModalPrompt(''); } });
                    items.push({ label: t('contextMenu.outpaint'), action: () => { setOutpaintingElement(el); setModalPrompt(''); } });
                    items.push({ label: t('contextMenu.download'), action: () => musicHandlers.downloadImageElement(el.id) });
                }
                if (el.type === 'imageCompare') {
                    if (el.wasInpainted) {
                        items.push({ label: t('contextMenu.inpaint'), action: () => { setInpaintingElement(el); setModalPrompt(el.inpaintedPrompt || ''); } });
                    }
                    if (el.srcAfter) {
                        items.push({ label: t('contextMenu.downloadGenerated'), action: () => musicHandlers.downloadImage(el.srcAfter, `compare-after-${el.id}.png`) });
                    }
                }
                if (el.type === 'drawing') {
                    items.push({ label: t('contextMenu.editDrawing'), action: () => setDrawingToEdit(el as DrawingElement) });
                }
            }
        } else {
            handleSelectElements([]);
            items.push({ label: t('contextMenu.addNote'), action: addNote });
            items.push({ label: t('contextMenu.addImage'), action: addImageFromUpload });
            items.push({ label: t('contextMenu.addArrow'), action: () => setActiveTool('arrow') });
            items.push({ label: t('contextMenu.draw'), action: () => setIsDrawing(true) });
            items.push({ label: t('contextMenu.camera'), action: () => setIsTakingPhoto(true) });
            items.push({ type: 'separator' });
            items.push({ label: t('contextMenu.addInpaint'), action: addInpaintPlaceholder });
            items.push({ label: t('contextMenu.addOutpaint'), action: addOutpaintPlaceholder });
            items.push({ label: t('contextMenu.addPlaceholder'), action: addPlaceholder });
            items.push({ label: t('contextMenu.addCompare'), action: addImageCompare });
        }
    
        if (items.length > 0 && items[items.length - 1].type !== 'separator') {
            items.push({ type: 'separator' });
        }
        items.push({ label: t('contextMenu.paste'), action: () => handlePaste() });
        items.push({ label: t('contextMenu.screenshot'), action: () => setIsCapturing(true) });
        items.push({ type: 'separator' });
        items.push({ label: t('contextMenu.undo'), action: undo, disabled: !canUndo });
        items.push({ label: t('contextMenu.redo'), action: redo, disabled: !canRedo });
    
        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    const handleTogglePanels = useCallback(() => {
        const anyPanelOpen = isToolbarOpen || isLayersPanelOpen || isInspirationPanelOpen || isCinematicPanelOpen;
        const nextState = !anyPanelOpen;
        
        setIsToolbarOpen(nextState);
        setIsLayersPanelOpen(nextState);
        setIsInspirationPanelOpen(nextState);
        if (!nextState) {
            setIsCinematicPanelOpen(false);
        }
    }, [isToolbarOpen, isLayersPanelOpen, isInspirationPanelOpen, isCinematicPanelOpen]);

    const [alignmentPopoverAnchor, setAlignmentPopoverAnchor] = useState<HTMLDivElement | null>(null);
    const [lightboxElement, setLightboxElement] = useState<CanvasElement | null>(null);

    const handleOpenLightbox = (elementId: string) => {
        const el = elements.find(e => e.id === elementId);
        if (el && (el.type === 'image' || el.type === 'drawing' || el.type === 'imageCompare')) {
            setLightboxElement(el);
        }
    };
    
    const isLightboxOpen = !!lightboxElement;

    useEffect(() => {
        const handleAutoInspire = () => {
             if (selectedElementIds.length !== 1) return;
            
            const selectedElement = elements.find(el => el.id === selectedElementIds[0]);
            if (!selectedElement || !selectedElement.meta?.autoInspire) return;

            updateElements([{ id: selectedElement.id, data: { meta: { ...selectedElement.meta, autoInspire: false } } }], false);
            
            setTimeout(() => {
                handleRequestInspiration(selectedElement.id);
            }, 100);
        };
        handleAutoInspire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedElementIds, elements]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isEditing = target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
    
            if (e.key === ' ' && !isEditing) {
                e.preventDefault();
                if (!isSpacePanning.current && activeTool !== 'pan') {
                    isSpacePanning.current = true;
                    setPreviousTool(activeTool);
                    setActiveTool('pan');
                }
                return;
            }
    
            if (isEditing) return;
    
            const key = e.key.toLowerCase();
            const isMod = e.metaKey || e.ctrlKey;
            
            if (e.key === 'Tab') {
                e.preventDefault();
                handleTogglePanels();
            }
    
            if (key === 'backspace' || key === 'delete') deleteElements(selectedElementIds);
            if (isMod && key === 'z') { e.shiftKey ? redo() : undo(); }
            if (isMod && key === 'y') redo();
            if (isMod && key === 'd') { e.preventDefault(); duplicateElements(selectedElementIds); }
            if (isMod && key === ']') { e.preventDefault(); reorderElements('front', selectedElementIds); }
            if (isMod && key === '[') { e.preventDefault(); reorderElements('back', selectedElementIds); }
            if (isMod && key === 'g') { e.preventDefault(); handleGroup(); }
            if (isMod && e.shiftKey && key === 'g') { e.preventDefault(); handleUngroup(); }
            if (isMod && key === 'l') { e.preventDefault(); handleToggleGroupLock(); }
            
            if (!isMod && !e.altKey) {
                switch(key) {
                    case 'v': setActiveTool('select'); break;
                    case 'h': setActiveTool('pan'); break;
                    case 'a': setActiveTool('arrow'); break;
                    case 'n': addNote(); break;
                    case 'u': addImageFromUpload(); break;
                    case 'i': addInpaintPlaceholder(); break;
                    case 'o': addOutpaintPlaceholder(); break;
                    case 'p': addPlaceholder(); break;
                    case 'x': addImageCompare(); break;
                    case 'd': setIsDrawing(true); break;
                    case 'c': setIsTakingPhoto(true); break;
                    case 'escape': setContextMenu(null); break;
                }
            }
            
            if (e.altKey) {
                switch(key) {
                    case 'c': if (selectedElements.length === 1 && (selectedElements[0].type === 'image' || selectedElements[0].type === 'drawing')) { setOutpaintingElement(selectedElements[0] as ImageElement | DrawingElement); setModalPrompt(''); }; break;
                    case 'e': if (selectedElements.length === 1 && selectedElements[0].type === 'drawing') setDrawingToEdit(selectedElements[0] as DrawingElement); break;
                    case 'i': if (selectedElements.length === 1) handleRequestInspiration(selectedElements[0].id); break;
                    case 'p': if (selectedElements.length === 1) onOptimizeSingleElementPrompt(selectedElements[0].id); break;
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ' && isSpacePanning.current) {
                isSpacePanning.current = false;
                setActiveTool(previousTool);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedElementIds, elements, canUndo, canRedo, handleTogglePanels, activeTool, previousTool, deleteElements, duplicateElements, reorderElements, handleGroup, handleUngroup, handleToggleGroupLock, addNote, addImageFromUpload, addInpaintPlaceholder, addOutpaintPlaceholder, addPlaceholder, addImageCompare, setIsDrawing, setIsTakingPhoto, undo, redo, handleRequestInspiration, onOptimizeSingleElementPrompt, selectedElements, setOutpaintingElement, setDrawingToEdit, setModalPrompt]);
    
  return (
    <div className="w-screen h-screen bg-[var(--cyber-bg)] text-white font-sans overflow-hidden relative canvas-glow-container cyber-grid-background" onContextMenu={handleContextMenu}>
      <InfiniteCanvas
        ref={canvasWrapperRef}
        elements={elements}
        connections={connections}
        viewport={viewport}
        onViewportChange={setViewport}
        onUpdateElements={(updates) => updateElements(updates, false)}
        onCommitHistory={handleCommitHistory}
        selectedElementIds={selectedElementIds}
        onSelectElements={handleSelectElements}
        onDoubleClickElement={() => {}}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isDraggingOver={false} // Drag over for canvas is disabled
        onReplacePlaceholder={handleReplacePlaceholder}
        onReplacePlaceholderWithImageAndEdit={handleReplacePlaceholderWithImageAndEdit}
        drawingConnection={newConnection ? { start: newConnection.startPoint, end: newConnection.endPoint } : null}
        onAddElement={addElement as any}
        lockedGroupIds={lockedGroupIds}
        singlySelectedIdInGroup={singlySelectedIdInGroup}
        isAnimationActive={isAnimationActive}
        onTriggerCameraForCompare={handleTriggerCameraForCompare}
        onTriggerPasteForCompare={handleTriggerPasteForCompare}
        onFillPlaceholderFromCamera={handleFillPlaceholderFromCamera}
        onFillPlaceholderFromPaste={handleFillPlaceholderFromPaste}
        ghostElements={ghostElements}
        onStartAltDrag={(els) => setGhostElements(els)}
        onEndAltDrag={() => setGhostElements(null)}
        onAltDragDuplicate={handleAltDragDuplicate}
        onUpdateConnection={updateConnection}
        onTriggerSandevistanMode={handleTriggerSandevistanMode}
        onDropOnCanvas={handleDropOnCanvas}
      />
      
      <Toolbar 
        isOpen={isToolbarOpen}
        setIsOpen={setIsToolbarOpen}
        activeTool={activeTool} 
        onToolChange={setActiveTool} 
        onAddNote={addNote}
        onAddImage={addImageFromUpload}
        onAddPlaceholder={addPlaceholder}
        onAddImageCompare={addImageCompare}
        onAddInpaintPlaceholder={addInpaintPlaceholder}
        onAddOutpaintPlaceholder={addOutpaintPlaceholder}
        onPaste={handlePaste}
        onDraw={() => setIsDrawing(true)}
        onCamera={() => setIsTakingPhoto(true)}
        canUndo={canUndo} onUndo={undo}
        canRedo={canRedo} onRedo={redo}
        zoom={viewport.zoom}
        onZoomChange={(newZoom) => setViewport(v => ({...v, zoom: newZoom}))}
        onFitScreen={handleFitScreen}
        onCenterView={handleCenterView}
      />

      <div className="fixed top-4 left-0 z-40">
        <InspirationPanel 
            isOpen={isInspirationPanelOpen}
            setIsOpen={(val) => { setIsInspirationPanelOpen(val); if(val) setIsCinematicPanelOpen(false); }}
            selectedElements={selectedElements}
            lockedGroupIds={lockedGroupIds}
            prompts={prompts}
            onPromptsChange={setPrompts}
            addElement={addElement}
            screenToCanvas={screenToCanvasCoords}
            canvasSize={canvasSize}
            elements={elements}
            updateElements={updateElements}
            onTriggerContextualAction={onTriggerContextualAction}
        />
        <CinematicPanel
            isOpen={isCinematicPanelOpen}
            setIsOpen={(val) => { setIsCinematicPanelOpen(val); if(val) setIsInspirationPanelOpen(false); }}
            selectedElements={selectedElements}
            onTriggerContextualAction={onTriggerContextualAction}
            addElement={addElement as any}
            screenToCanvas={screenToCanvasCoords}
            canvasSize={canvasSize}
        />
      </div>

      <LayersPanel 
        isOpen={isLayersPanelOpen}
        setIsOpen={setIsLayersPanelOpen}
        elements={elements}
        selectedElementIds={selectedElementIds}
        onLayerSelect={handleLayerSelect}
        onGroupLayerSelect={(groupId) => handleSelectElements(elements.filter(el => el.groupId === groupId).map(el => el.id))}
        lockedGroupIds={lockedGroupIds}
        onDelete={deleteElements}
        onReorder={handleLayerReorder}
        isAnimationActive={isAnimationActive}
        onAnimationToggle={() => setIsAnimationActive(prev => !prev)}
        isMusicPlayerVisible={isMusicPlayerVisible}
        onMusicPlayerToggle={() => setIsMusicPlayerVisible(prev => !prev)}
      />

      {elements.length > 0 && (
        <Navigator 
            elements={elements} 
            viewport={viewport} 
            canvasSize={canvasSize} 
            onClick={(x, y) => setViewport(v => ({ ...v, pan: { x: -x * v.zoom, y: -y * v.zoom }}))} 
        />
      )}

      <ShortcutHints
        actions={{
          addNote,
          addArrow: () => setActiveTool('arrow'),
          addImage: addImageFromUpload,
          addInpaint: addInpaintPlaceholder,
          addOutpaint: addOutpaintPlaceholder,
          addPlaceholder,
          draw: () => setIsDrawing(true),
          camera: () => setIsTakingPhoto(true),
          addCompare: addImageCompare,
          inspiration: () => selectedElements[0] && handleRequestInspiration(selectedElements[0].id),
          optimize: () => selectedElements[0] && onOptimizeSingleElementPrompt(selectedElements[0].id)
        }}
        isLightboxOpen={isLightboxOpen}
      />

      {selectedElements.length > 0 && (
        <FloatingToolbar 
            elements={elements}
            selectedElements={selectedElements}
            viewport={viewport}
            prompts={prompts}
            onPromptsChange={setPrompts}
            aspectRatios={aspectRatios}
            onAspectRatiosChange={setAspectRatios as any}
            artStyles={artStyles}
            onArtStylesChange={setArtStyles}
            onDelete={() => deleteElements(selectedElementIds)}
            onDuplicate={() => duplicateElements(selectedElementIds)}
            onBringToFront={() => reorderElements('front', selectedElementIds)}
            onSendToBack={() => reorderElements('back', selectedElementIds)}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onUpdateElements={updateElements}
            onCommitHistory={handleCommitHistory}
            onOutpaint={() => { setOutpaintingElement(selectedElements[0] as ImageElement | DrawingElement); setModalPrompt(''); }}
            onInpaint={() => { 
                const el = selectedElements[0] as ImageElement | DrawingElement | ImageCompareElement;
                setInpaintingElement(el);
                setModalPrompt(el.type === 'imageCompare' && el.wasInpainted ? el.inpaintedPrompt || '' : '');
            }}
            onEditDrawing={() => setDrawingToEdit(selectedElements[0] as DrawingElement)}
            onDownload={musicHandlers.downloadImageElement}
            onAIGenerate={handleAIGenerate}
            onAIZoomOut={handleAIZoomOut}
            isGenerating={isGenerating}
            onAIGroupGenerate={handleAIGroupGenerate}
            onRequestInspiration={handleRequestInspiration}
            onRequestGroupInspiration={handleRequestInspiration}
            onOptimizeGroupPrompt={onOptimizeSingleElementPrompt}
            onOptimizeSingleElementPrompt={onOptimizeSingleElementPrompt}
            onNoteInspiration={handleRequestInspiration}
            onNoteOptimization={onOptimizeSingleElementPrompt}
            onNoteGenerate={handleNoteGenerate}
            onCreateComparison={handleCreateComparison}
            onConvertToComparison={handleConvertToComparison}
            onUnpackComparison={handleUnpackComparison}
            onStartConnection={handleStartConnection}
            onToggleGroupLock={handleToggleGroupLock}
            lockedGroupIds={lockedGroupIds}
            onClearConnections={handleClearConnections}
            onFillPlaceholderFromCamera={handleFillPlaceholderFromCamera}
            onFillPlaceholderFromPaste={handleFillPlaceholderFromPaste}
            onOpenLightbox={handleOpenLightbox}
            onAddLayerToGroup={handleAddLayerToGroup}
        />
      )}

        {isMusicPlayerVisible && (
            <MusicPlayer 
                isPlaying={isPlaying}
                currentTrackName={currentTrackName}
                isLibraryEmpty={isLibraryEmpty}
                musicTracks={musicTracks}
                currentTrackIndex={currentTrackIndex}
                onPlayPause={handlePlayPause}
                onStop={handleStop}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSelectTrack={handleSelectTrack}
                onFolderUpload={handleFolderUpload}
                onDrop={handleMusicDrop}
                onLrcUpload={handleLrcUpload}
                onClear={handleClearMusic}
                onReloadFromLocal={handleReloadFromLocal}
                repeatMode={repeatMode}
                isShuffle={isShuffle}
                onCycleRepeatMode={handleCycleRepeatMode}
                onToggleShuffle={handleToggleShuffle}
                playlists={playlists}
                activePlaylistName={activePlaylistName}
                onSwitchPlaylist={handleSwitchPlaylist}
                onDeleteTrack={handleDeleteTrack}
                onSaveCurrentTracksAsPlaylist={handleSaveCurrentTracksAsPlaylist}
                onExportPlaylists={handleExportPlaylists}
                onImportPlaylists={handleImportPlaylists}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
                currentLyric={currentLyric}
            />
        )}
        
      <LyricsDisplay lyric={isMusicPlayerVisible ? (currentLyric || '') : ''} />
      
      <LoadingOverlay isGenerating={isGenerating} generationStatus={generationStatus} />

      {isDrawing && <DrawingModal onClose={() => setIsDrawing(false)} onSave={addDrawing} initialDrawing={drawingToEdit?.src} />}
      {drawingToEdit && <DrawingModal onClose={() => setDrawingToEdit(null)} onSave={(src) => { updateElements([{ id: drawingToEdit.id, data: { src }}]); setDrawingToEdit(null); }} initialDrawing={drawingToEdit.src} />}
      {outpaintingElement && <OutpaintingModal element={outpaintingElement} onClose={() => setOutpaintingElement(null)} onGenerate={handleAIOutpaint} prompt={modalPrompt} onPromptChange={setModalPrompt} onRequestInspiration={() => handleModalRequestInspiration(outpaintingElement.src)} onOptimizePrompt={() => handleModalOptimizePrompt(outpaintingElement.src, modalPrompt)}/>}
      {inpaintingElement && <InpaintingModal element={inpaintingElement} onClose={() => setInpaintingElement(null)} onGenerate={handleInpaintGenerate} prompt={modalPrompt} onPromptChange={setModalPrompt} onRequestInspiration={() => handleModalRequestInspiration(inpaintingElement.type === 'imageCompare' ? inpaintingElement.srcBefore : inpaintingElement.src)} onOptimizePrompt={() => handleModalOptimizePrompt(inpaintingElement.type === 'imageCompare' ? inpaintingElement.srcBefore : inpaintingElement.src, modalPrompt)} />}
      {isTakingPhoto && <CameraModal onClose={() => { setIsTakingPhoto(false); setPlaceholderTarget(null); setImageCompareTarget(null); }} onCapture={(dataUrl, bgOption) => { handleCameraCapture(dataUrl, bgOption); setIsTakingPhoto(false); }} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      {contextualAction && <ContextualActionModal onClose={() => setContextualAction(null)} onSelectAction={handleContextualActionSelected} />}
      {isInspirationModalOpen && inspirationData && <InspirationModal 
        suggestions={inspirationData.modificationSuggestions} 
        prompts={inspirationData.textPrompts} 
        isSingleChoice={inspirationConfirm?.isSingleChoice}
        onClose={() => setIsInspirationModalOpen(false)} 
        onApply={(suggestions, prompt) => {
            setIsInspirationModalOpen(false);
            
            if (inspirationConfirm?.onApplyCallback) {
                const newPromptTextForModal = [prompt, ...suggestions].filter(Boolean).join(', ');
                inspirationConfirm.onApplyCallback(newPromptTextForModal);
            } else if (inspirationConfirm?.elementId) {
                
                const suggestionsPart = suggestions.length > 0
                    ? `<span class="prompt-ai-suggestion-1">- ${suggestions.join('<br>- ')}</span>`
                    : '';

                const promptPart = prompt
                    ? `<span class="prompt-ai-suggestion-2">${prompt}</span>`
                    : '';

                const newPromptHtml = [suggestionsPart, promptPart].filter(Boolean).join('<br><br>');

                const el = elements.find(e => e.id === inspirationConfirm.elementId);
                if(el?.type === 'note') {
                    // Notes don't support rich text, so we convert to plain text for them.
                    const plainText = newPromptHtml.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
                     const currentContent = el.content.trim();
                     const newContent = currentContent ? `${currentContent}\n\n${plainText}` : plainText;
                     const newHeight = calculateNoteHeight(newContent, el.width, el.fontSize);
                     updateElements([{ id: inspirationConfirm.elementId, data: { content: newContent, height: newHeight } }]);
                } else {
                    setPrompts(p => ({ ...p, [inspirationConfirm.elementId!]: newPromptHtml }));
                }
            }
        }} 
      />}
       <input type="file" ref={fileInputRef} onChange={(e) => handleFileUploads(e.target.files)} className="hidden" accept="image/*" multiple />
       <input
        type="file"
        ref={musicUploadRefForLink}
        onChange={(e) => musicHandlers.handleRelinkFolderSelect(e.target.files)}
        className="hidden"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
      />
       {isCapturing && <CaptureBox onCapture={captureScreen} onCancel={() => setIsCapturing(false)} />}
       {alignmentPopoverAnchor && <AlignmentPopover anchorEl={alignmentPopoverAnchor} onClose={() => setAlignmentPopoverAnchor(null)} selectedElements={selectedElements} canvasSize={canvasSize} viewport={viewport} screenToCanvas={screenToCanvasCoords} onUpdateElements={updateElements} onCommitHistory={handleCommitHistory} />}
       {lightboxElement && <Lightbox element={lightboxElement as any} onClose={() => setLightboxElement(null)} />}
    </div>
  );
};
