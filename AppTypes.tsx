import type { CanvasElement, NoteElement, ImageElement, DrawingElement, ArrowElement, PlaceholderElement, ImageCompareElement, InpaintPlaceholderElement, OutpaintPlaceholderElement } from './types';
import { getLocaleObject } from './constants-i18n';

export type AddElementFn = {
    (element: Omit<NoteElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<ImageElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<DrawingElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<ArrowElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<PlaceholderElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<ImageCompareElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<InpaintPlaceholderElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
    (element: Omit<OutpaintPlaceholderElement, 'id' | 'zIndex'>, sourcePrompt?: string): CanvasElement;
};

export const getInitialElements = (): NoteElement[] => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const initialStrings = getLocaleObject('zh-TW').app; // Default to zh-TW on first load

    return [
    {
        id: 'initial-note-1', type: 'note', zIndex: 1, rotation: 0,
        position: { x: centerX - 100, y: centerY - 370 }, width: 230, height: 230,
        content: initialStrings.initialNote1, color: 'linear-gradient(135deg, #00f5d4, #9d00ff)', fontSize: 24
    },
    {
        id: 'initial-note-2', type: 'note', zIndex: 2, rotation: 3,
        position: { x: centerX - 300, y: centerY - 100 }, width: 200, height: 200,
        content: initialStrings.initialNote2, color: 'var(--cyber-pink)', fontSize: 16
    },
    {
        id: 'initial-note-3', type: 'note', zIndex: 3, rotation: -2,
        position: { x: centerX, y: centerY -50 }, width: 250, height: 200,
        content: initialStrings.initialNote3, color: 'var(--cyber-purple)', fontSize: 16
    },
     {
        id: 'initial-note-4', type: 'note', zIndex: 4, rotation: -1,
        position: { x: centerX + 50, y: centerY + 130}, width: 250, height: 50,
        content: initialStrings.initialNote4, color: 'var(--cyber-purple)', fontSize: 16
    },
     {
        id: 'initial-note-5', type: 'note', zIndex: 5, rotation: 0,
        position: { x: centerX -250, y: centerY + 200}, width: 250, height: 100,
        content: initialStrings.initialNote5, color: 'transparent', fontSize: 16
    },
    {
        id: 'initial-note-6', type: 'note', zIndex: 6, rotation: 2,
        position: { x: centerX -260, y: centerY + 230}, width: 250, height: 100,
        content: initialStrings.initialNote6, color: 'transparent', fontSize: 16
    }
]};

export const initialNoteIds = new Set(['initial-note-1', 'initial-note-2', 'initial-note-3', 'initial-note-4', 'initial-note-5', 'initial-note-6']);

export const ASPECT_RATIO_PROMPT = `將生成內容重新繪製到灰色參考圖上，如有空白加入符合內容的outpaint以適合灰色參考圖的寬高比，完全佔滿取代灰色參考圖的所有內容(包含底色背景)，僅保留灰色參考圖的寬高比，生成後如果偵測到圖片外緣有大面積灰色（#808080）區域，就自動outpaint填充合適內容，並確保"正確比例"下，生成出 比例完整的內容，也可以偵測 生成後圖片中心點、短邊為基礎，依選擇的比例 進行裁切，或 outpaint 以生成出 比例完整的圖片`;

export const NIGHT_CITY_CINEMATIC_PROMPT = `cinematic film still, epic, dramatic lighting, high detail, photorealistic, professional color grading, shot on Arri Alexa, anamorphic lens flare, moody atmosphere, film grain`;
