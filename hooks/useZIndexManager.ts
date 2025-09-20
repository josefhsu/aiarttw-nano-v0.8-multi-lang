import { useCallback } from 'react';
import type { CanvasElement } from '../types';

export const useZIndexManager = (
    elements: CanvasElement[],
    setElements: (action: (prevState: CanvasElement[]) => CanvasElement[], options?: { addToHistory?: boolean }) => void
) => {
    const ensureArrowPriority = useCallback(() => {
        const nonArrows = elements.filter(el => el.type !== 'arrow');
        const arrows = elements.filter(el => el.type === 'arrow');

        // Check if any arrow has a lower zIndex than any non-arrow
        const maxNonArrowZ = nonArrows.length > 0 ? Math.max(...nonArrows.map(el => el.zIndex)) : -Infinity;
        const minArrowZ = arrows.length > 0 ? Math.min(...arrows.map(el => el.zIndex)) : Infinity;

        if (arrows.length > 0 && nonArrows.length > 0 && minArrowZ <= maxNonArrowZ) {
            setElements(prev => {
                const sortedElements = [...prev].sort((a, b) => {
                    if (a.type === 'arrow' && b.type !== 'arrow') return 1;
                    if (a.type !== 'arrow' && b.type === 'arrow') return -1;
                    return a.zIndex - b.zIndex;
                });

                return sortedElements.map((el, index) => ({
                    ...el,
                    zIndex: index + 1,
                }));
            }, { addToHistory: false });
        }
    }, [elements, setElements]);

    return { ensureArrowPriority };
};
