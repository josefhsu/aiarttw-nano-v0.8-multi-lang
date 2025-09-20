import { useState } from 'react';
import type { CanvasElement, Viewport } from '../types';
import { useHistoryState } from '../useHistoryState';
import { getInitialElements } from '../AppTypes';

export const useCanvasState = () => {
    const { state: elements, setState: setElements, undo, redo, canUndo, canRedo } = useHistoryState<CanvasElement[]>(getInitialElements());
    const [viewport, setViewport] = useState<Viewport>({ pan: { x: 0, y: 0 }, zoom: 1 });
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [lockedGroupIds, setLockedGroupIds] = useState<Set<string>>(new Set());
    const [singlySelectedIdInGroup, setSinglySelectedIdInGroup] = useState<string | null>(null);

    return {
        elements,
        setElements,
        undo,
        redo,
        canUndo,
        canRedo,
        viewport,
        setViewport,
        selectedElementIds,
        setSelectedElementIds,
        lockedGroupIds,
        setLockedGroupIds,
        singlySelectedIdInGroup,
        setSinglySelectedIdInGroup,
    };
};
