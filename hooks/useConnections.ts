import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, Connection, Point } from '../types';
import { getElementsBounds, getPortPosition } from '../utils';

interface UseConnectionsProps {
    elements: CanvasElement[];
    setElements: (updater: (prev: CanvasElement[]) => CanvasElement[], options?: { addToHistory?: boolean }) => void;
    lockedGroupIds: Set<string>;
    setLockedGroupIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    screenToCanvasCoords: (p: Point) => Point;
}

export const useConnections = ({
    elements,
    setElements,
    lockedGroupIds,
    setLockedGroupIds,
    screenToCanvasCoords,
}: UseConnectionsProps) => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [newConnection, setNewConnection] = useState<{ sourceId: string; sourceSide: 'left' | 'right'; startPoint: Point, endPoint: Point } | null>(null);

    const updateConnection = useCallback((id: string, data: Partial<Connection>) => {
        setConnections(conns => conns.map(c => c.id === id ? { ...c, ...data } : c));
    }, []);

    const handleStartConnection = (sourceId: string, sourceSide: 'left' | 'right') => {
        const sourceEl = elements.find(el => el.id === sourceId);
        if (!sourceEl) return;
        const startPoint = getPortPosition(sourceEl, sourceSide);
        setNewConnection({ sourceId, sourceSide, startPoint, endPoint: startPoint });
    };

    const handleClearConnections = (elementId: string) => {
        setConnections(prev => prev.filter(c => c.sourceId !== elementId && c.targetId !== elementId));
    };

    const handleAutoLayoutAndGrouping = useCallback((newConnection: Connection) => {
        const sourceEl = elements.find(el => el.id === newConnection.sourceId);
        if (!sourceEl) return;
    
        const currentConnections = [...connections, newConnection];
    
        const updates: { id: string; data: Partial<CanvasElement> }[] = [];
        const SPACING = 100;
        const sourceBounds = getElementsBounds([sourceEl]);
        const sourceVCenter = sourceBounds.minY + (sourceBounds.maxY - sourceBounds.minY) / 2;
        
        const isTargetImageLike = (el: CanvasElement) => 
            el.type === 'image' || el.type === 'drawing' || el.type === 'imageCompare' || el.type === 'placeholder' || el.type === 'note' || el.type === 'inpaintPlaceholder' || el.type === 'outpaintPlaceholder';

        const processSide = (side: 'left' | 'right') => {
            const targets = currentConnections
                .filter(c => c.sourceId === sourceEl.id && c.sourceSide === side)
                .map(c => elements.find(el => el.id === c.targetId))
                .filter((el): el is CanvasElement => !!el && isTargetImageLike(el));
            
            const uniqueTargets = Array.from(new Map(targets.map(el => [el.id, el])).values());
            if (uniqueTargets.length === 0) return;

            if (uniqueTargets.length === 1) {
                // SINGLE TARGET: Horizontal Layout
                const targetEl = uniqueTargets[0];
                const targetBounds = getElementsBounds([targetEl]);
                const targetWidth = targetBounds.maxX - targetBounds.minX;
                const targetHeight = targetBounds.maxY - targetBounds.minY;

                const newTargetMinX = side === 'left' 
                    ? sourceBounds.minX - SPACING - targetWidth
                    : sourceBounds.maxX + SPACING;
                const newTargetMinY = sourceVCenter - targetHeight / 2;
                
                const dx = newTargetMinX - targetBounds.minX;
                const dy = newTargetMinY - targetBounds.minY;
    
                updates.push({
                    id: targetEl.id,
                    data: { position: { x: targetEl.position.x + dx, y: targetEl.position.y + dy } }
                });
            } else {
                // MULTIPLE TARGETS: Vertical Layout
                uniqueTargets.sort((a, b) => a.position.y - b.position.y);
                const targetBoundsArray = uniqueTargets.map(el => getElementsBounds([el]));
                const totalHeight = targetBoundsArray.reduce((sum, bounds) => sum + (bounds.maxY - bounds.minY), 0) + (uniqueTargets.length - 1) * SPACING;
                let currentY = sourceVCenter - totalHeight / 2;

                for (let i = 0; i < uniqueTargets.length; i++) {
                    const targetEl = uniqueTargets[i];
                    const targetBounds = targetBoundsArray[i];
                    const targetWidth = targetBounds.maxX - targetBounds.minX;
                    const targetHeight = targetBounds.maxY - targetBounds.minY;

                    const newTargetMinX = side === 'left'
                        ? sourceBounds.minX - SPACING - targetWidth
                        : sourceBounds.maxX + SPACING;
                    const newTargetMinY = currentY;

                    const dx = newTargetMinX - targetBounds.minX;
                    const dy = newTargetMinY - targetBounds.minY;

                    updates.push({
                        id: targetEl.id,
                        data: { position: { x: targetEl.position.x + dx, y: targetEl.position.y + dy } }
                    });
                    
                    currentY += targetHeight + SPACING;
                }
            }
        };

        processSide('left');
        processSide('right');
    
        // --- Grouping Logic ---
        const allTargets = currentConnections
            .filter(c => c.sourceId === sourceEl.id)
            .map(c => elements.find(el => el.id === c.targetId))
            .filter((el): el is CanvasElement => !!el && isTargetImageLike(el));

        if (allTargets.length > 0) {
            let groupId = sourceEl.groupId && lockedGroupIds.has(sourceEl.groupId) ? sourceEl.groupId : uuidv4();
            
            if (!sourceEl.groupId || !lockedGroupIds.has(sourceEl.groupId)) {
                 updates.push({ id: sourceEl.id, data: { groupId } });
            }
           
            allTargets.forEach(targetEl => {
                if (targetEl.groupId !== groupId) {
                    const existingUpdate = updates.find(u => u.id === targetEl.id);
                    if (existingUpdate) {
                        existingUpdate.data.groupId = groupId;
                    } else {
                        updates.push({ id: targetEl.id, data: { groupId } });
                    }
                }
            });
            
            setElements(prev => {
                const updatedElements = [...prev];
                updates.forEach(update => {
                    const elIndex = updatedElements.findIndex(el => el.id === update.id);
                    if (elIndex !== -1) {
                        updatedElements[elIndex] = { ...updatedElements[elIndex], ...update.data } as CanvasElement;
                    }
                });
                return updatedElements;
            }, { addToHistory: true });
    
            setLockedGroupIds(prev => new Set(prev).add(groupId));
        }
    }, [elements, connections, lockedGroupIds, setElements, setLockedGroupIds]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (newConnection) {
                setNewConnection(conn => conn ? { ...conn, endPoint: screenToCanvasCoords({ x: e.clientX, y: e.clientY }) } : null);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (newConnection) {
                const targetElementDiv = (e.target as HTMLElement).closest('[data-element-id]');
                const targetId = targetElementDiv?.getAttribute('data-element-id');
                const targetElement = elements.find(el => el.id === targetId);

                if (targetElement && targetElement.id !== newConnection.sourceId) {
                    
                    // New "wrap around" logic for the arrow's target side
                    const finalTargetSide = newConnection.sourceSide === 'left' ? 'right' : 'left';

                    const newConn: Connection = {
                        id: uuidv4(),
                        sourceId: newConnection.sourceId,
                        targetId: targetElement.id,
                        sourceSide: newConnection.sourceSide,
                        targetSide: finalTargetSide,
                    };
                    
                    setConnections(prev => [...prev, newConn]);
                    handleAutoLayoutAndGrouping(newConn);
                }
                setNewConnection(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [newConnection, elements, screenToCanvasCoords, handleAutoLayoutAndGrouping, connections]);

    return {
        connections,
        newConnection,
        handleStartConnection,
        handleClearConnections,
        updateConnection,
    };
};