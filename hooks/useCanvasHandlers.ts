import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';

import type {
    CanvasElement, Viewport, Point, NoteElement, ImageElement, DrawingElement, ImageCompareElement,
    PlaceholderElement, InpaintPlaceholderElement, OutpaintPlaceholderElement, ArrowElement, BackupData, ExportedTrack, ExportedPlaylist
} from '../types';

import {
    getElementsBounds, getCroppedImg, fileToBase64, createGrayImage,
    correctImageAspectRatio, dataUrlToBlob, calculateNoteHeight,
    getRandomInspirationExamples, base64ToFile,
    addTrackToDB, getAllTracksFromDB, getTrackFromDB, updateTrackLrcInDB, clearAllTracksFromDB,
    savePlaylistToDB, getPlaylistsFromDB, deleteTrackFromDB,
    parseLRC, downloadImage,
    findUnoccupiedPosition
} from '../utils';

// Fix: Removed MusicTrack, Playlist, RepeatMode as they are no longer in AppTypes
import { ASPECT_RATIO_PROMPT, initialNoteIds, NIGHT_CITY_CINEMATIC_PROMPT } from '../AppTypes';
import { useMusicHandlers } from './useMusicHandlers';

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ART_STYLES, RANDOM_GRADIENTS } from '../constants';
import { generateRandomNCLFullPrompt } from '../constants1';

interface UseCanvasHandlersProps {
    elements: CanvasElement[];
    setElements: (updater: (prev: CanvasElement[]) => CanvasElement[], options?: { addToHistory?: boolean }) => void;
    viewport: Viewport;
    setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
    canvasSize: { width: number; height: number };
    screenToCanvasCoords: (p: Point) => Point;
    prompts: Record<string, string>;
    setPrompts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    aspectRatios: Record<string, number | null>;
    setAspectRatios: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
    artStyles: Record<string, string>;
    setArtStyles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
    setSinglySelectedIdInGroup: React.Dispatch<React.SetStateAction<string | null>>;
    ensureArrowPriority: () => void;
    selectedElementIds: string[];
    lockedGroupIds: Set<string>;
    setLockedGroupIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
    setIsInspirationModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setInspirationData: React.Dispatch<React.SetStateAction<{ modificationSuggestions: string[]; textPrompts: string[] } | null>>;
    setInspirationConfirm: React.Dispatch<React.SetStateAction<{ elementId?: string; onApplyCallback?: (newPrompt: string) => void; isSingleChoice?: boolean } | null>>;
}


export const useCanvasHandlers = ({
    elements, setElements, viewport, setViewport, canvasSize, screenToCanvasCoords,
    prompts, setPrompts, aspectRatios, setAspectRatios, artStyles, setArtStyles,
    setSelectedElementIds, setSinglySelectedIdInGroup, ensureArrowPriority,
    selectedElementIds, lockedGroupIds, setLockedGroupIds,
    setIsCapturing, setIsInspirationModalOpen, setInspirationData, setInspirationConfirm
}: UseCanvasHandlersProps) => {

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState("生成中...");
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingToEdit, setDrawingToEdit] = useState<DrawingElement | null>(null);
    const [outpaintingElement, setOutpaintingElement] = useState<ImageElement | DrawingElement | null>(null);
    const [inpaintingElement, setInpaintingElement] = useState<ImageElement | DrawingElement | ImageCompareElement | null>(null);
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);
    const [placeholderTarget, setPlaceholderTarget] = useState<string | null>(null);
    const [imageCompareTarget, setImageCompareTarget] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
    const [modalPrompt, setModalPrompt] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const musicHandlers = useMusicHandlers({ elements });

    const getNewElementPosition = (width: number, height: number) => {
        return screenToCanvasCoords({
            x: canvasSize.width / 2 - width / 2,
            y: canvasSize.height / 2 - height / 2,
        });
    };

    const getMaxZIndex = () => elements.reduce((max, el) => Math.max(max, el.zIndex), 0);

    const addElement = useCallback((element: Omit<CanvasElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement => {
        // Fix: Cast to CanvasElement to resolve complex union type assignment error.
        const newElement = {
            ...element,
            id: uuidv4(),
            zIndex: getMaxZIndex() + 1,
        } as CanvasElement;
        setElements(prev => [...prev, newElement]);
        if (newElement.type === 'arrow') {
            setTimeout(ensureArrowPriority, 0);
        }
        if (sourcePrompt) {
            setPrompts(p => ({...p, [newElement.id]: sourcePrompt}));
        }
        return newElement;
    }, [elements, setElements, ensureArrowPriority, setPrompts, getMaxZIndex]);

    const addNote = () => {
        const width = 200, height = 200;
        addElement({
            type: 'note', position: getNewElementPosition(width, height), width, height, rotation: 0,
            content: '輸入文字...', color: '#facc15', fontSize: 24,
        } as Omit<NoteElement, 'id'|'zIndex'>);
    };

    const addPlaceholder = () => {
        const width = 300, height = 300;
        addElement({ type: 'placeholder', position: getNewElementPosition(width, height), width, height, rotation: 0 } as Omit<PlaceholderElement, 'id'|'zIndex'>);
    };

    const addInpaintPlaceholder = () => {
        const width = 300, height = 300;
        addElement({ type: 'inpaintPlaceholder', position: getNewElementPosition(width, height), width, height, rotation: 0 } as Omit<InpaintPlaceholderElement, 'id'|'zIndex'>);
    };

    const addOutpaintPlaceholder = () => {
        const width = 300, height = 300;
        addElement({ type: 'outpaintPlaceholder', position: getNewElementPosition(width, height), width, height, rotation: 0 } as Omit<OutpaintPlaceholderElement, 'id'|'zIndex'>);
    };

    const addImageCompare = () => {
        const width = 600, height = 400;
        addElement({ 
            type: 'imageCompare', 
            position: getNewElementPosition(width, height), 
            width, height, rotation: 0,
            srcBefore: '', intrinsicWidthBefore: 0, intrinsicHeightBefore: 0,
            srcAfter: '', intrinsicWidthAfter: 0, intrinsicHeightAfter: 0
        } as Omit<ImageCompareElement, 'id'|'zIndex'>);
    };
    
    const handleFileUploads = (files: FileList | null) => {
        if (!files) return;
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            addImageFromUpload(imageFiles);
        }
    };

    const addImageFromUpload = (files: File[] | null = null) => {
        if (files) {
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const newElement: Omit<ImageElement, 'id'|'zIndex'> = {
                            type: 'image',
                            src: img.src,
                            position: getNewElementPosition(img.width, img.height),
                            width: img.width,
                            height: img.height,
                            rotation: 0,
                            intrinsicWidth: img.naturalWidth,
                            intrinsicHeight: img.naturalHeight,
                            meta: { autoInspire: true }
                        };
                        const createdElement = addElement(newElement);
                        setSelectedElementIds([createdElement.id]);
                    };
                    img.src = e.target?.result as string;
                };
                reader.readAsDataURL(file);
            });
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleDropOnCanvas = (files: File[], position: Point) => {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const TARGET_MAX_DIMENSION = 350;
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    let newWidth, newHeight;
    
                    if (img.naturalWidth > img.naturalHeight) {
                        newWidth = TARGET_MAX_DIMENSION;
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newHeight = TARGET_MAX_DIMENSION;
                        newWidth = newHeight * aspectRatio;
                    }

                    const basePosition = {
                        x: position.x - newWidth / 2,
                        y: position.y - newHeight / 2
                    };

                    const finalPosition = findUnoccupiedPosition(
                        basePosition,
                        { width: newWidth, height: newHeight, rotation: 0 },
                        elements
                    );
    
                    const newElement: Omit<ImageElement, 'id'|'zIndex'> = {
                        type: 'image',
                        src: img.src,
                        position: finalPosition,
                        width: newWidth,
                        height: newHeight,
                        rotation: 0,
                        intrinsicWidth: img.naturalWidth,
                        intrinsicHeight: img.naturalHeight,
                    };
                    const createdElement = addElement(newElement);
                    setSelectedElementIds([createdElement.id]);
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };
    
    const addDrawing = (dataUrl: string, width: number, height: number) => {
        addElement({
            type: 'drawing',
            src: dataUrl,
            position: getNewElementPosition(width, height),
            width, height, rotation: 0
        } as Omit<DrawingElement, 'id' | 'zIndex'>);
        setIsDrawing(false);
        setDrawingToEdit(null);
    };
    
    const updateElements = (updates: { id: string, data: Partial<CanvasElement> }[], addToHistory = true) => {
        setElements(prev =>
            prev.map(el => {
                const update = updates.find(u => u.id === el.id);
                return update ? { ...el, ...update.data } : el;
            }), { addToHistory }
        );
    };

    const handleCommitHistory = (updates: { id: string, data: Partial<CanvasElement> }[]) => {
        updateElements(updates, true);
    };

    const deleteElements = (ids: string[]) => {
        setElements(prev => prev.filter(el => !ids.includes(el.id)));
        setSelectedElementIds(prev => prev.filter(id => !ids.includes(id)));
    };

    const duplicateElements = (ids: string[]) => {
        const newElements: Omit<CanvasElement, 'id'|'zIndex'>[] = [];
        const maxZ = getMaxZIndex();
        elements.forEach(el => {
            if (ids.includes(el.id)) {
                const { id, zIndex, ...rest } = el;
                newElements.push({
                    ...rest,
                    position: { x: el.position.x + 20, y: el.position.y + 20 },
                });
            }
        });

        const createdElements: CanvasElement[] = [];
        setElements(prev => {
            const elementsToAdd = newElements.map((el, i) => {
                const newEl = { ...el, id: uuidv4(), zIndex: maxZ + i + 1 } as CanvasElement;
                createdElements.push(newEl);
                return newEl;
            });
            return [...prev, ...elementsToAdd];
        });
        setSelectedElementIds(createdElements.map(el => el.id));
    };

    const handleAltDragDuplicate = (elementsToCreate: Omit<CanvasElement, 'id'|'zIndex'>[], revertUpdates: { id: string, data: Partial<CanvasElement> }[]) => {
        updateElements(revertUpdates, false);
        const createdElements: CanvasElement[] = [];
        const maxZ = getMaxZIndex();
        setElements(prev => {
            const elementsToAdd = elementsToCreate.map((el, i) => {
                 const newEl = { ...el, id: uuidv4(), zIndex: maxZ + i + 1 } as CanvasElement;
                 createdElements.push(newEl);
                 return newEl;
            });
            return [...prev, ...elementsToAdd];
        });
        setSelectedElementIds(createdElements.map(el => el.id));
    };
    
    const reorderElements = (direction: 'front' | 'back', ids: string[]) => {
        const maxZ = getMaxZIndex();
        const updates = ids.map((id, i) => ({
            id,
            data: { zIndex: direction === 'front' ? maxZ + i + 1 : -i -1 }
        }));
        updateElements(updates);
    };

    const handleGroup = () => {
        if (selectedElementIds.length < 2) return;
        const groupId = uuidv4();
        const updates = selectedElementIds.map(id => ({ id, data: { groupId } }));
        updateElements(updates);
        setLockedGroupIds(prev => new Set(prev).add(groupId));
    };
    
    const handleUngroup = () => {
        const groupIds = new Set<string>();
        selectedElementIds.forEach(id => {
            const el = elements.find(e => e.id === id);
            if (el?.groupId) groupIds.add(el.groupId);
        });

        const updates: { id: string, data: Partial<CanvasElement> }[] = [];
        const newLockedGroupIds = new Set(lockedGroupIds);

        elements.forEach(el => {
            if (el.groupId && groupIds.has(el.groupId)) {
                updates.push({ id: el.id, data: { groupId: undefined } });
                if (newLockedGroupIds.has(el.groupId)) {
                    newLockedGroupIds.delete(el.groupId);
                }
            }
        });
        updateElements(updates);
        setLockedGroupIds(newLockedGroupIds);
    };

    const handleToggleGroupLock = (groupId?: string) => {
        const targetGroupId = groupId || elements.find(el => selectedElementIds.includes(el.id))?.groupId;
        if (!targetGroupId) return;

        setLockedGroupIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(targetGroupId)) {
                newSet.delete(targetGroupId);
                setSinglySelectedIdInGroup(null);
            } else {
                newSet.add(targetGroupId);
            }
            return newSet;
        });
    };
    
    const handleAddLayerToGroup = (sourceId: string) => {
        const sourceElementOrGroup = elements.find(el => el.id === sourceId || el.groupId === sourceId);
        if (!sourceElementOrGroup) return;

        let groupId = sourceElementOrGroup.groupId;
        let referencePosition = sourceElementOrGroup.position;
        let bounds = getElementsBounds([sourceElementOrGroup]);

        if (groupId) {
             bounds = getElementsBounds(elements.filter(el => el.groupId === groupId));
             referencePosition = { x: bounds.maxX, y: bounds.minY };
        } else {
            groupId = uuidv4();
            updateElements([{ id: sourceId, data: { groupId } }]);
        }

        const width = 300, height = 300;
        const newElement = addElement({
            type: 'placeholder',
            position: { x: referencePosition.x + 20, y: referencePosition.y },
            width, height, rotation: 0, groupId
        } as Omit<PlaceholderElement, 'id'|'zIndex'>);

        if (groupId) {
            setLockedGroupIds(prev => new Set(prev).add(groupId!));
        }
        setSelectedElementIds([sourceElementOrGroup.id, newElement.id]);
    };

    const handleFitScreen = () => {
        if (elements.length === 0) return;
        const bounds = getElementsBounds(elements);
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        if (contentWidth === 0 || contentHeight === 0) return;

        const padding = 50;
        const zoomX = (canvasSize.width - padding * 2) / contentWidth;
        const zoomY = (canvasSize.height - padding * 2) / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 2);

        const newPanX = (canvasSize.width / 2) - (bounds.minX + contentWidth / 2) * newZoom;
        const newPanY = (canvasSize.height / 2) - (bounds.minY + contentHeight / 2) * newZoom;

        setViewport({ pan: { x: newPanX, y: newPanY }, zoom: newZoom });
    };
    
    const handleCenterView = () => {
        const targetElements = selectedElementIds.length > 0 ? elements.filter(el => selectedElementIds.includes(el.id)) : elements.filter(el => !initialNoteIds.has(el.id));
        if (targetElements.length === 0) {
             setViewport({pan: {x: 0, y: 0}, zoom: 1});
             return;
        };
        
        const bounds = getElementsBounds(targetElements);
        const newPanX = (canvasSize.width / 2) - (bounds.minX + (bounds.maxX - bounds.minX) / 2) * viewport.zoom;
        const newPanY = (canvasSize.height / 2) - (bounds.minY + (bounds.maxY - bounds.minY) / 2) * viewport.zoom;
        setViewport(v => ({ ...v, pan: { x: newPanX, y: newPanY } }));
    };

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    addImageFromUpload([new File([blob], "pasted_image.png", { type: imageType })]);
                    break; 
                }
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    };
    
    const handleReplacePlaceholder = (placeholderId: string, file: File) => {
        const placeholder = elements.find(el => el.id === placeholderId);
        if (!placeholder) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const newImage: ImageElement = {
                    id: placeholderId,
                    type: 'image',
                    src: img.src,
                    position: placeholder.position,
                    width: placeholder.width,
                    height: placeholder.height,
                    rotation: placeholder.rotation,
                    zIndex: placeholder.zIndex,
                    groupId: placeholder.groupId,
                    intrinsicWidth: img.naturalWidth,
                    intrinsicHeight: img.naturalHeight,
                    meta: placeholder.groupId ? {} : { autoInspire: true }
                };
                // FIX: Added an explicit return type to the map function to help TypeScript's inference engine
                // with the complex discriminated union type of CanvasElement, preventing a type error.
                setElements(prev => prev.map((el): CanvasElement => (el.id === placeholderId ? newImage : el)), { addToHistory: true });
                setSelectedElementIds([placeholderId]);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleReplacePlaceholderWithImageAndEdit = (placeholderId: string, file: File, editType: 'inpaint' | 'outpaint') => {
        const placeholder = elements.find(el => el.id === placeholderId);
        if (!placeholder) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const newImage: ImageElement = {
                    id: uuidv4(),
                    type: 'image',
                    src: img.src,
                    position: placeholder.position,
                    width: placeholder.width,
                    height: placeholder.height,
                    rotation: placeholder.rotation,
                    zIndex: placeholder.zIndex,
                    groupId: placeholder.groupId,
                    intrinsicWidth: img.naturalWidth,
                    intrinsicHeight: img.naturalHeight,
                };
                setElements(prev => [...prev.filter(el => el.id !== placeholderId), newImage]);
                setSelectedElementIds([newImage.id]);
                if(editType === 'inpaint') setInpaintingElement(newImage);
                else setOutpaintingElement(newImage);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleFillPlaceholderFromCamera = (placeholderId: string) => {
        setPlaceholderTarget(placeholderId);
        setIsTakingPhoto(true);
    };

    const handleFillPlaceholderFromPaste = async (placeholderId: string) => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    handleReplacePlaceholder(placeholderId, new File([blob], "pasted_image.png", { type: imageType }));
                    break;
                }
            }
        } catch (err) { console.error('Paste failed:', err); }
    };
    
    const handleCameraCapture = async (dataUrl: string, bgOption: 'transparent' | 'green') => {
        setIsGenerating(true);
        setGenerationStatus("優化中...");
        let finalSrc = dataUrl;
        let finalImg = new Image();
    
        const processImage = async (src: string) => {
            return new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = src;
            });
        };
    
        finalImg = await processImage(dataUrl);
    
        try {
            const { blob, base64 } = await dataUrlToBlob(dataUrl);
            let prompt = "Slightly enhance the photo, improve lighting and skin tone, but keep the facial features identical to the original. It must look like the same person. ";
            if (bgOption === 'transparent') {
                prompt += "Then, remove the background and make it transparent.";
            } else if (bgOption === 'green') {
                prompt += "Then, replace the background with a solid green screen color.";
            }
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [{ inlineData: { mimeType: blob.type, data: base64 } }, { text: prompt }] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
            });
            
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                finalSrc = `data:image/png;base64,${imagePart.inlineData.data}`;
                finalImg = await processImage(finalSrc);
            }
        } catch (e) {
            console.error("Camera image enhancement failed:", e);
        } finally {
            setIsGenerating(false);
        }
    
        await downloadImage(finalSrc, `camera_capture_${Date.now()}.png`);
    
        if (placeholderTarget) {
            handleReplacePlaceholder(placeholderTarget, base64ToFile(finalSrc.split(',')[1], 'camera.png', 'image/png'));
        } else if (imageCompareTarget) {
            const { id, side } = imageCompareTarget;
            const updates = side === 'before'
                ? { srcBefore: finalSrc, intrinsicWidthBefore: finalImg.width, intrinsicHeightBefore: finalImg.height }
                : { srcAfter: finalSrc, intrinsicWidthAfter: finalImg.width, intrinsicHeightAfter: finalImg.height };
            updateElements([{ id, data: updates }]);
        } else {
            const createdElement = addElement({
                type: 'image', src: finalSrc,
                position: getNewElementPosition(finalImg.width, finalImg.height),
                width: finalImg.width, height: finalImg.height, rotation: 0,
                intrinsicWidth: finalImg.naturalWidth, intrinsicHeight: finalImg.naturalHeight,
                meta: { autoInspire: true }
            } as Omit<ImageElement, 'id' | 'zIndex'>);
            setSelectedElementIds([createdElement.id]);
        }
    
        setPlaceholderTarget(null);
        setImageCompareTarget(null);
    };
    
    const handleTriggerCameraForCompare = (elementId: string, side: 'before' | 'after') => {
        setImageCompareTarget({ id: elementId, side });
        setIsTakingPhoto(true);
    };
    
    const handleTriggerPasteForCompare = async (elementId: string, side: 'before' | 'after') => {
         try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], 'pasted.png', { type: imageType });
                    const src = `data:${file.type};base64,${await fileToBase64(file)}`;
                    const img = new Image();
                    img.onload = () => {
                        const updates = side === 'before'
                          ? { srcBefore: src, intrinsicWidthBefore: img.width, intrinsicHeightBefore: img.height }
                          : { srcAfter: src, intrinsicWidthAfter: img.width, intrinsicHeightAfter: img.height };
                        updateElements([{ id: elementId, data: updates }]);
                    };
                    img.src = src;
                    break;
                }
            }
        } catch (err) { console.error('Paste failed:', err); }
    };
    
    const _handleGeneration = async (
        elementId: string, 
        baseImage: ImageElement | DrawingElement, 
        customPrompt?: string
    ) => {
        setIsGenerating(true);
        setGenerationStatus("生成中...");
    
        try {
            let finalPrompt = customPrompt || prompts[elementId] || "A beautiful, high-quality image.";
            const { blob, base64 } = await dataUrlToBlob(baseImage.src);
            const aspectRatio = aspectRatios[elementId];
            const artStyle = artStyles[elementId];
    
            if (artStyle && artStyle !== ART_STYLES[0]) {
                finalPrompt += `, in the style of ${artStyle}`;
            }
    
            // Fix: Safely access intrinsic properties as they don't exist on DrawingElement.
            const { url: finalSrc, width: finalWidth, height: finalHeight } = aspectRatio
                ? await correctImageAspectRatio(baseImage.src, aspectRatio)
                : { url: baseImage.src, width: 'intrinsicWidth' in baseImage ? baseImage.intrinsicWidth : baseImage.width, height: 'intrinsicHeight' in baseImage ? baseImage.intrinsicHeight : baseImage.height };
    
            const grayImageSrc = aspectRatio ? createGrayImage(aspectRatio) : null;
            
            const parts: any[] = [{ inlineData: { mimeType: blob.type, data: base64 } }];
            if (grayImageSrc) {
                const { base64: grayBase64, blob: grayBlob } = await dataUrlToBlob(grayImageSrc);
                parts.push({ inlineData: { mimeType: grayBlob.type, data: grayBase64 } });
                finalPrompt += `, ${ASPECT_RATIO_PROMPT}`;
            }
    
            parts.push({ text: finalPrompt });
    
            // Fix: Removed safetySettings as it's not a supported config for 'gemini-2.5-flash-image-preview' and causes a type error.
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
            });
    
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const newSrc = `data:image/png;base64,${imagePart.inlineData.data}`;
                
                const preferredPosition = { x: baseImage.position.x + baseImage.width + 20, y: baseImage.position.y };
                const finalPosition = findUnoccupiedPosition(
                    preferredPosition,
                    { width: baseImage.width, height: baseImage.height, rotation: 0 },
                    elements
                );
                
                const newCompareElement: Omit<ImageCompareElement, 'id'|'zIndex'> = {
                    type: 'imageCompare',
                    position: finalPosition,
                    width: baseImage.width,
                    height: baseImage.height,
                    rotation: 0,
                    srcBefore: finalSrc,
                    intrinsicWidthBefore: finalWidth,
                    intrinsicHeightBefore: finalHeight,
                    srcAfter: newSrc,
                    intrinsicWidthAfter: finalWidth, // Assume same size for now
                    intrinsicHeightAfter: finalHeight,
                };
    
                addElement(newCompareElement);
                await downloadImage(newSrc, `generated_${elementId}.png`);
            } else {
                alert("AI 未能生成圖片，請檢查提示或稍後再試。");
            }
        } catch (error) {
            console.error("AI Generation failed:", error);
            alert(`生成失敗: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAIGenerate = (elementId: string) => {
        const element = elements.find(el => el.id === elementId);
        if (element && (element.type === 'image' || element.type === 'drawing')) {
            _handleGeneration(elementId, element);
        }
    };
    
    const handleAIZoomOut = async (elementId: string) => { console.log('AI Zoom Out triggered for', elementId); };

    const handleAIGroupGenerate = async (groupId: string) => {
        setIsGenerating(true);
        setGenerationStatus("群組生成中...");
        try {
            const groupElements = elements.filter(el => el.groupId === groupId);
            const imageElements = groupElements.filter(el => el.type === 'image' || el.type === 'drawing') as (ImageElement | DrawingElement)[];
            const noteElements = groupElements.filter(el => el.type === 'note') as NoteElement[];
            
            if (imageElements.length === 0) throw new Error("群組中沒有圖片可供生成。");
    
            const mainImage = imageElements.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    
            let combinedPrompt = prompts[groupId] || '';
            noteElements.forEach(note => { combinedPrompt += ` ${note.content}`; });
            
            const artStyle = artStyles[groupId];
            if (artStyle && artStyle !== ART_STYLES[0]) {
                combinedPrompt += `, in the style of ${artStyle}`;
            }

            const isRoleplay = noteElements.some(n => n.meta?.nclCategory) && imageElements.some(i => i.meta?.isCharacter);
            const isNightCity = noteElements.some(n => n.meta?.nclCategory);

            if(isRoleplay) {
                combinedPrompt += ` Keep the person's face and identity from the original image, but adapt their clothing, pose, and the environment to match the prompt's theme. This is a roleplay scenario.`;
            }
            if (isNightCity && artStyle === ART_STYLES[0]) {
                combinedPrompt += `, ${NIGHT_CITY_CINEMATIC_PROMPT}`;
            }
    
            await _handleGeneration(groupId, mainImage, combinedPrompt.trim());
    
        } catch (error) {
            console.error("AI Group Generation failed:", error);
            alert(`群組生成失敗: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleNoteGenerate = async (noteId: string) => {
        const note = elements.find(el => el.id === noteId) as NoteElement;
        if (!note) return;
        setIsGenerating(true);
        setGenerationStatus("從便籤生成中...");
        try {
            const prompt = note.content;
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png' }
            });
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

            const img = new Image();
            img.onload = () => {
                 const preferredPosition = { x: note.position.x + note.width + 20, y: note.position.y };
                 const finalPosition = findUnoccupiedPosition(
                    preferredPosition,
                    { width: img.width, height: img.height, rotation: 0 },
                    elements
                 );
                 const newImageElement: Omit<ImageElement, 'id'|'zIndex'> = {
                    type: 'image',
                    src: imageUrl,
                    position: finalPosition,
                    width: img.width,
                    height: img.height,
                    rotation: 0,
                    intrinsicWidth: img.naturalWidth,
                    intrinsicHeight: img.naturalHeight,
                };
                addElement(newImageElement);
                downloadImage(imageUrl, `note_generated_${noteId}.png`);
            }
            img.src = imageUrl;

        } catch (error) {
             console.error("Note generation failed:", error);
             alert(`從便籤生成失敗: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRequestInspiration = async (elementId: string) => {
        const element = elements.find(el => el.id === elementId);
        if (!element) return;
    
        setIsGenerating(true);
        setGenerationStatus("尋找靈感中...");
        
        try {
            const { blob, base64 } = (element.type === 'image' || element.type === 'drawing') 
                ? await dataUrlToBlob((element as ImageElement).src)
                : { blob: null, base64: null };
    
            let requestPrompt = `You are an AI assistant for a visual canvas application. A user needs inspiration. Provide a JSON object with two keys:
            1. "modificationSuggestions": An array of 3 creative strings suggesting modifications to the user's subject.
            2. "textPrompts": An array of 2 detailed strings for generating a new image.
            Example Response: ${getRandomInspirationExamples()}`;
    
            if (element.type === 'note') {
                requestPrompt = `User's subject is from a note with content: "${(element as NoteElement).content}". ${requestPrompt}`;
            } else {
                requestPrompt = `User's subject is from an image. ${requestPrompt}`;
            }
            
            const contents: any[] = [{ text: requestPrompt }];
            if (base64 && blob) {
                contents.unshift({ inlineData: { mimeType: blob.type, data: base64 } });
            }
    
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents });
            const jsonText = response.text.match(/```json\n([\s\S]*?)\n```/)?.[1] || response.text;
            const data = JSON.parse(jsonText);
            
            setInspirationData(data);
            setInspirationConfirm({ 
                elementId, 
                onApplyCallback: (newPrompt) => {
                    const idToUpdate = element.groupId && lockedGroupIds.has(element.groupId) ? element.groupId : element.id;
                    setPrompts(p => ({ ...p, [idToUpdate]: newPrompt }));
                }
            });
            setIsInspirationModalOpen(true);
    
        } catch (error) {
            console.error("Inspiration request failed:", error);
            alert("獲取靈感失敗，請稍後再試。");
        } finally {
            setIsGenerating(false);
        }
    };

    const onOptimizeSingleElementPrompt = async (elementId: string) => {
        setIsGenerating(true);
        setGenerationStatus("優化提示中...");
        try {
            const element = elements.find(el => el.id === elementId);
            const idToUpdate = element?.groupId && lockedGroupIds.has(element.groupId) ? element.groupId : elementId;
            const currentPrompt = prompts[idToUpdate] || (element as NoteElement)?.content || "";
            if (!currentPrompt) {
                alert("沒有可優化的提示。");
                return;
            }
            
            const optimizePrompt = `You are an expert prompt engineer. Expand the user's prompt into a detailed, high-quality prompt for an AI image model.
            User's prompt: "${currentPrompt}"
            Return ONLY the new prompt as a single string.`;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: optimizePrompt });
            setPrompts(p => ({ ...p, [idToUpdate]: response.text }));
            
        } catch (error) {
            console.error("Prompt optimization failed:", error);
            alert("優化提示失敗。");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleCreateComparison = (groupId: string) => {
        const groupElements = elements.filter(el => el.groupId === groupId);
        const imageElements = groupElements.filter(el => el.type === 'image' || el.type === 'drawing') as (ImageElement | DrawingElement)[];
        if (imageElements.length !== 2) return;
    
        const [img1, img2] = imageElements;
        const groupBounds = getElementsBounds(groupElements);
        const newPosition = { x: groupBounds.maxX + 50, y: groupBounds.minY };
    
        const newCompareElement: Omit<ImageCompareElement, 'id' | 'zIndex'> = {
            type: 'imageCompare',
            position: newPosition,
            width: Math.max(img1.width, img2.width) * 1.5,
            height: Math.max(img1.height, img2.height),
            rotation: 0,
            srcBefore: img1.src,
            intrinsicWidthBefore: 'intrinsicWidth' in img1 ? img1.intrinsicWidth : img1.width,
            intrinsicHeightBefore: 'intrinsicHeight' in img1 ? img1.intrinsicHeight : img1.height,
            srcAfter: img2.src,
            intrinsicWidthAfter: 'intrinsicWidth' in img2 ? img2.intrinsicWidth : img2.width,
            intrinsicHeightAfter: 'intrinsicHeight' in img2 ? img2.intrinsicHeight : img2.height,
        };
    
        const newElement = addElement(newCompareElement);
        setSelectedElementIds([newElement.id]);
    };

    const handleConvertToComparison = (elementId: string) => {
        setElements(prev => {
            const element = prev.find(el => el.id === elementId);
            if (!element || (element.type !== 'image' && element.type !== 'drawing')) {
                return prev;
            }
    
            const newCompareElement: ImageCompareElement = {
                id: element.id,
                position: element.position,
                width: element.width,
                height: element.height,
                rotation: element.rotation,
                zIndex: element.zIndex,
                groupId: element.groupId,
                meta: element.meta,
                type: 'imageCompare',
                srcBefore: element.src,
                intrinsicWidthBefore: 'intrinsicWidth' in element ? element.intrinsicWidth : element.width,
                intrinsicHeightBefore: 'intrinsicHeight' in element ? element.intrinsicHeight : element.height,
                srcAfter: '',
                intrinsicWidthAfter: 0,
                intrinsicHeightAfter: 0,
            };
            
            return prev.map((el): CanvasElement => (el.id === elementId ? newCompareElement : el));
        }, { addToHistory: true });
    };
    

    const handleUnpackComparison = (elementId: string) => {
        const element = elements.find(el => el.id === elementId) as ImageCompareElement;
        if (!element || !element.srcBefore || !element.srcAfter) return;
    
        const imgBefore: Omit<ImageElement, 'id' | 'zIndex'> = {
            type: 'image',
            src: element.srcBefore,
            position: { x: element.position.x, y: element.position.y },
            width: element.width / 2,
            height: element.height,
            rotation: 0,
            intrinsicWidth: element.intrinsicWidthBefore,
            intrinsicHeight: element.intrinsicHeightBefore,
        };
    
        const imgAfter: Omit<ImageElement, 'id' | 'zIndex'> = {
            type: 'image',
            src: element.srcAfter,
            position: { x: element.position.x + element.width / 2 + 20, y: element.position.y },
            width: element.width / 2,
            height: element.height,
            rotation: 0,
            intrinsicWidth: element.intrinsicWidthAfter,
            intrinsicHeight: element.intrinsicHeightAfter,
        };
    
        const newImg1 = addElement(imgBefore);
        const newImg2 = addElement(imgAfter);
        
        deleteElements([elementId]);
        setSelectedElementIds([newImg1.id, newImg2.id]);
    };
    
    const handleAIOutpaint = async (element: ImageElement | DrawingElement, croppedAreaPixels: {x:number, y:number, width:number, height:number}, aspectRatio: number, prompt: string): Promise<string | null> => { return null };
    const handleInpaintGenerate = async (element: ImageElement | DrawingElement | ImageCompareElement, maskDataUrl: string, prompt: string): Promise<string | null> => { return null };

    const handleContextualGeneration = (prompt: string) => {
        const idsToUpdate = selectedElementIds.length > 0 ? selectedElementIds : [];
        if (idsToUpdate.length > 0) {
            idsToUpdate.forEach(id => {
                const el = elements.find(e => e.id === id);
                if (el?.type === 'note') {
                    const newContent = `${el.content}\n${prompt}`;
                    const newHeight = calculateNoteHeight(newContent, el.width, el.fontSize);
                    updateElements([{ id, data: { content: newContent, height: newHeight } }]);
                } else {
                    const currentPrompt = prompts[id] || '';
                    setPrompts(p => ({ ...p, [id]: currentPrompt ? `${currentPrompt}\n${prompt}` : prompt }));
                }
            });
        }
    };
    
    const handleCreateAndProcessGroup = (selectedIds: string[], prompt: string, mode: 'suggest' | 'generate') => {
        const imageElements = elements.filter(el => selectedIds.includes(el.id));
        if (imageElements.length === 0) return;
    
        const groupId = uuidv4();
        const updates = imageElements.map(el => ({ id: el.id, data: { groupId } }));
    
        const noteWidth = 250;
        const noteHeight = calculateNoteHeight(prompt, noteWidth, 16);
        const groupBounds = getElementsBounds(imageElements);
    
        const notePosition = {
            x: groupBounds.minX + (groupBounds.maxX - groupBounds.minX) / 2 - noteWidth / 2,
            y: groupBounds.maxY + 30
        };
    
        const noteElement = {
            type: 'note', content: prompt, color: 'var(--cyber-cyan)', fontSize: 16,
            position: notePosition, width: noteWidth, height: noteHeight, rotation: 0, groupId
        } as Omit<NoteElement, 'id' | 'zIndex'>;
    
        const newNote = addElement(noteElement);
        updateElements([...updates, { id: newNote.id, data: { groupId } }]);
        setLockedGroupIds(prev => new Set(prev).add(groupId));
        setSelectedElementIds([...selectedIds, newNote.id]);
    
        const process = async () => {
            const mainImage = imageElements.sort((a,b) => (b.width * b.height) - (a.width * a.height))[0] as ImageElement;
            const { blob, base64 } = await dataUrlToBlob(mainImage.src);
    
            const requestPrompt = `Based on the provided image and the user's prompt "${prompt}", provide a JSON object with:
            1. "modificationSuggestions": An array of 3 creative strings suggesting modifications.
            2. "textPrompts": An array of 2 detailed strings for generating a new image.
            Example: ${getRandomInspirationExamples()}`;
    
            const contents = [
                { inlineData: { mimeType: blob.type, data: base64 } },
                { text: requestPrompt }
            ];
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents });
            const jsonText = response.text.match(/```json\n([\s\S]*?)\n```/)?.[1] || response.text;
            const data = JSON.parse(jsonText);
            
            setInspirationData(data);
            setIsInspirationModalOpen(true);
            setInspirationConfirm({
                elementId: groupId,
                isSingleChoice: mode === 'generate',
                onApplyCallback: (newPrompt) => {
                    const finalPrompt = `${prompt}\n${newPrompt}`;
                    setPrompts(p => ({ ...p, [groupId]: finalPrompt }));
                    if (mode === 'generate') {
                        handleAIGroupGenerate(groupId);
                    }
                }
            });
        };
        
        process().catch(e => console.error("Group processing failed:", e));
    };

    const handleModalRequestInspiration = async (imageSrc: string) => {
         setIsGenerating(true);
         setGenerationStatus("尋找靈感中...");
         try {
            const { base64, blob } = await dataUrlToBlob(imageSrc);
            const requestPrompt = `You are an AI assistant. A user has provided an image and wants ideas. Return a JSON object with two keys:
            1. "modificationSuggestions": An array of 3 strings suggesting modifications.
            2. "textPrompts": An array of 2 strings, each a detailed prompt for a new image.
            Example: ${getRandomInspirationExamples()}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [ { inlineData: { mimeType: blob.type, data: base64 } }, { text: requestPrompt } ]
            });
            const jsonText = response.text.match(/```json\n([\s\S]*?)\n```/)?.[1] || response.text;
            const data = JSON.parse(jsonText);
            setInspirationData(data);
            setIsInspirationModalOpen(true);
            setInspirationConfirm({ onApplyCallback: setModalPrompt });
         } catch(e) {
            console.error("Modal inspiration failed:", e);
         } finally {
            setIsGenerating(false);
         }
    };
    
    const handleModalOptimizePrompt = async (imageSrc: string, currentPrompt: string) => {
        setIsGenerating(true);
        setGenerationStatus("優化提示中...");
        try {
            const { base64, blob } = await dataUrlToBlob(imageSrc);
            const optimizePrompt = `Analyze the provided image. Then, take the user's basic prompt and enhance it into a detailed, high-quality prompt that could be used to generate a similar or improved image.
            User's prompt: "${currentPrompt || 'the subject in the image'}"
            Return ONLY the new, optimized prompt as a single string.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [ { inlineData: { mimeType: blob.type, data: base64 } }, { text: optimizePrompt } ]
            });
            setModalPrompt(response.text);
        } catch(e) {
            console.error("Modal optimize failed:", e);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const captureScreen = async (box: { x: number; y: number; width: number; height: number }) => {
        setIsCapturing(false);
        try {
            const canvas = await html2canvas(document.body, {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                logging: false,
                useCORS: true,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
            });
            const dataUrl = canvas.toDataURL('image/png');
            const createdElement = addElement({
                type: 'image',
                src: dataUrl,
                position: getNewElementPosition(box.width, box.height),
                width: box.width,
                height: box.height,
                rotation: 0,
                intrinsicWidth: box.width,
                intrinsicHeight: box.height,
                meta: { autoInspire: true }
            } as Omit<ImageElement, 'id' | 'zIndex'>);
            setSelectedElementIds([createdElement.id]);
        } catch (error) {
            console.error("Screen capture failed:", error);
        }
    };

    const handleTriggerSandevistanMode = useCallback(() => {
        setIsGenerating(true);
        setGenerationStatus("开启沙德威斯坦模式......");
    
        setTimeout(() => {
            const center = screenToCanvasCoords({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
            const elementsToCreate: (Omit<NoteElement, 'id' | 'zIndex'> | Omit<PlaceholderElement, 'id' | 'zIndex'>)[] = [];
            const newGroupIds: string[] = [];
            const newElementIds: string[] = [];
            let maxZ = getMaxZIndex();
    
            const noteWidth = 250;
            const placeholderWidth = 300;
            const placeholderHeight = 300;
            const spacing = 20;
            const groupSpacing = 40;
    
            const groupWidth = noteWidth + spacing + placeholderWidth;
            const totalLayoutWidth = 3 * groupWidth + 2 * groupSpacing;
            const startX = center.x - totalLayoutWidth / 2;
            
            let maxHeightInLayout = 0;
    
            for (let i = 0; i < 3; i++) {
                const groupId = uuidv4();
                newGroupIds.push(groupId);
                
                const basePrompt = generateRandomNCLFullPrompt();
                const prompt = "將參考圖的人物，做角色扮演，盡可能跟原圖人物神似自然！\n\n" + basePrompt;
                const noteHeight = calculateNoteHeight(prompt, noteWidth, 16);
                maxHeightInLayout = Math.max(maxHeightInLayout, noteHeight, placeholderHeight);
    
                const currentGroupX = startX + i * (groupWidth + groupSpacing);
    
                const noteElement: Omit<NoteElement, 'id' | 'zIndex'> = {
                    type: 'note', content: prompt, color: RANDOM_GRADIENTS[i % RANDOM_GRADIENTS.length],
                    fontSize: 16, position: { x: currentGroupX, y: 0 }, width: noteWidth, height: noteHeight,
                    rotation: 0, groupId
                };
    
                const placeholderElement: Omit<PlaceholderElement, 'id' | 'zIndex'> = {
                    type: 'placeholder', position: { x: currentGroupX + noteWidth + spacing, y: 0 },
                    width: placeholderWidth, height: placeholderHeight, rotation: 0, groupId
                };
    
                elementsToCreate.push(noteElement, placeholderElement);
            }
            
            const startY = center.y - maxHeightInLayout / 2;
            elementsToCreate.forEach(el => { el.position.y += startY; });

            const newElements = elementsToCreate.map(el => {
                const newEl = { ...el, id: uuidv4(), zIndex: ++maxZ } as CanvasElement;
                newElementIds.push(newEl.id);
                return newEl;
            });

            setElements(prev => [
                ...prev.filter(el => !initialNoteIds.has(el.id)),
                ...newElements
            ], { addToHistory: true });

            setLockedGroupIds(prev => new Set([...prev, ...newGroupIds]));
            setSelectedElementIds(newElementIds);
            
            // Adjust viewport
            const bounds = getElementsBounds(newElements);
            const contentWidth = bounds.maxX - bounds.minX;
            const contentHeight = bounds.maxY - bounds.minY;
            const padding = 100;

            const zoomX = (canvasSize.width - padding * 2) / contentWidth;
            const zoomY = (canvasSize.height - padding * 2) / contentHeight;
            const newZoom = Math.min(zoomX, zoomY, 1);

            const newPanX = (canvasSize.width / 2) - (bounds.minX + contentWidth / 2) * newZoom;
            const newPanY = (canvasSize.height / 2) - (bounds.minY + contentHeight / 2) * newZoom;

            setViewport({ pan: { x: newPanX, y: newPanY }, zoom: newZoom });
            
            setIsGenerating(false);
        }, 2500);
    }, [canvasSize.width, canvasSize.height, screenToCanvasCoords, setElements, setLockedGroupIds, setSelectedElementIds, getMaxZIndex, setViewport]);


    return {
        addElement, addNote, addPlaceholder, addInpaintPlaceholder, addOutpaintPlaceholder,
        addImageCompare, addImageFromUpload, addDrawing, updateElements, handleCommitHistory,
        deleteElements, duplicateElements, handleAltDragDuplicate, reorderElements,
        handleGroup, handleUngroup, handleToggleGroupLock, handleAddLayerToGroup,
        handleFitScreen, handleCenterView, handlePaste, handleReplacePlaceholder,
        handleReplacePlaceholderWithImageAndEdit, handleFillPlaceholderFromCamera, handleFillPlaceholderFromPaste,
        handleCameraCapture, handleTriggerCameraForCompare, handleTriggerPasteForCompare,
        handleAIGenerate, handleAIZoomOut, handleAIGroupGenerate, handleNoteGenerate,
        handleRequestInspiration, onOptimizeSingleElementPrompt,
        handleCreateComparison, handleConvertToComparison, handleUnpackComparison,
        handleAIOutpaint, handleInpaintGenerate,
        handleContextualGeneration, handleCreateAndProcessGroup,

        handleModalRequestInspiration, handleModalOptimizePrompt,
        captureScreen,

        isGenerating, generationStatus,
        isDrawing, setIsDrawing,
        drawingToEdit, setDrawingToEdit,
        outpaintingElement, setOutpaintingElement,
        inpaintingElement, setInpaintingElement,
        isTakingPhoto, setIsTakingPhoto,
        placeholderTarget, setPlaceholderTarget,
        imageCompareTarget, setImageCompareTarget,
        modalPrompt, setModalPrompt,
        
        musicHandlers,
        fileInputRef,
        handleFileUploads,
        handleTriggerSandevistanMode,
        handleDropOnCanvas,
    };
};