import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Point, ImageElement, DrawingElement, ImageCompareElement } from './types';

// START LIGHTBOX COMPONENT
interface LightboxProps {
    element: ImageElement | DrawingElement | ImageCompareElement;
    onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ element, onClose }) => {
    const isCompare = element.type === 'imageCompare';
    const [viewState, setViewState] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
        const clampedZoom = Math.max(1, Math.min(4, newZoom));

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - viewState.pan.x) / viewState.zoom;
        const worldY = (mouseY - viewState.pan.y) / viewState.zoom;

        const newPanX = mouseX - worldX * clampedZoom;
        const newPanY = mouseY - worldY * clampedZoom;

        setViewState({ pan: { x: newPanX, y: newPanY }, zoom: clampedZoom });
    };

    return (
        <div className="lightbox-backdrop" onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
            <div className="lightbox-header">
                <button onClick={onClose} className="p-2 text-white hover:bg-slate-700 rounded-full">
                    <X size={28} />
                </button>
            </div>
            <div className="lightbox-content" onMouseDown={(e) => e.stopPropagation()}>
                {isCompare ? (
                    <DualImageView element={element} viewState={viewState} setViewState={setViewState} onWheel={handleWheel} />
                ) : (
                    <SingleImageView src={element.src} viewState={viewState} setViewState={setViewState} onWheel={handleWheel} />
                )}
            </div>
        </div>
    );
};

interface ImageViewProps {
    viewState: { pan: Point; zoom: number };
    setViewState: React.Dispatch<React.SetStateAction<{ pan: Point; zoom: number }>>;
    onWheel: (e: React.WheelEvent) => void;
}

interface SingleImageViewProps extends ImageViewProps {
    src: string;
}

const SingleImageView: React.FC<SingleImageViewProps> = ({ src, viewState, setViewState, onWheel }) => {
    const viewRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const startPan = useRef<{ x: number; y: number } | null>(null);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    const clampPan = useCallback((pan: Point, zoom: number): Point => {
        if (!viewRef.current || !imageRef.current) return pan;
        const { clientWidth, clientHeight } = viewRef.current;
        const { naturalWidth, naturalHeight } = imageRef.current;
        if (naturalWidth === 0 || naturalHeight === 0) return { x: 0, y: 0 };
        
        const scaledWidth = naturalWidth * zoom;
        const scaledHeight = naturalHeight * zoom;

        const minPanX = clientWidth - scaledWidth;
        const minPanY = clientHeight - scaledHeight;
        
        let newX = pan.x;
        let newY = pan.y;

        if (scaledWidth <= clientWidth) newX = (clientWidth - scaledWidth) / 2;
        else newX = Math.max(minPanX, Math.min(0, newX));

        if (scaledHeight <= clientHeight) newY = (clientHeight - scaledHeight) / 2;
        else newY = Math.max(minPanY, Math.min(0, newY));

        return { x: newX, y: newY };
    }, []);

    useEffect(() => {
        if (isImageLoaded) {
            setViewState(prev => ({...prev, pan: clampPan(prev.pan, prev.zoom)}));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isImageLoaded, viewState.zoom, clampPan]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startPan.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!startPan.current) return;
            const dx = e.clientX - startPan.current.x;
            const dy = e.clientY - startPan.current.y;
            startPan.current = { x: e.clientX, y: e.clientY };
            setViewState(prev => ({ ...prev, pan: clampPan({ x: prev.pan.x + dx, y: prev.pan.y + dy }, prev.zoom) }));
        };
        const handleMouseUp = () => {
            startPan.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setViewState, clampPan]);

    return (
        <div ref={viewRef} className="lightbox-view" onWheel={onWheel} onMouseDown={handleMouseDown}>
            <img 
                ref={imageRef} 
                src={src} 
                className="lightbox-image" 
                style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})` }} 
                alt="Lightbox view" 
                draggable={false}
                onLoad={() => setIsImageLoaded(true)}
            />
            {isImageLoaded && imageRef.current && viewRef.current && (
                <MiniMap
                    imgRef={imageRef}
                    containerRef={viewRef}
                    viewState={viewState}
                    setViewState={setViewState}
                    clampPan={clampPan}
                />
            )}
        </div>
    );
};

interface DualImageViewProps extends ImageViewProps {
    element: ImageCompareElement;
}

const DualImageView: React.FC<DualImageViewProps> = ({ element, viewState, setViewState, onWheel }) => {
    const view1Ref = useRef<HTMLDivElement>(null);
    const view2Ref = useRef<HTMLDivElement>(null);
    const image1Ref = useRef<HTMLImageElement>(null);
    const image2Ref = useRef<HTMLImageElement>(null);
    const startPan = useRef<{ x: number; y: number } | null>(null);
    const [isImagesLoaded, setIsImagesLoaded] = useState({ img1: false, img2: false });

    const clampPan = useCallback((pan: Point, zoom: number): Point => {
        if (!view1Ref.current || !image1Ref.current) return pan;
        const { clientWidth, clientHeight } = view1Ref.current;
        const { naturalWidth, naturalHeight } = image1Ref.current;
        if (naturalWidth === 0 || naturalHeight === 0) return { x: 0, y: 0 };
        
        const scaledWidth = naturalWidth * zoom;
        const scaledHeight = naturalHeight * zoom;

        const minPanX = clientWidth - scaledWidth;
        const minPanY = clientHeight - scaledHeight;
        
        let newX = pan.x;
        let newY = pan.y;

        if (scaledWidth <= clientWidth) newX = (clientWidth - scaledWidth) / 2;
        else newX = Math.max(minPanX, Math.min(0, newX));

        if (scaledHeight <= clientHeight) newY = (clientHeight - scaledHeight) / 2;
        else newY = Math.max(minPanY, Math.min(0, newY));
        
        return { x: newX, y: newY };
    }, []);
    
    useEffect(() => {
        if (isImagesLoaded.img1 && isImagesLoaded.img2) {
            setViewState(prev => ({...prev, pan: clampPan(prev.pan, prev.zoom)}));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isImagesLoaded, viewState.zoom, clampPan]);


    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startPan.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!startPan.current) return;
            const dx = e.clientX - startPan.current.x;
            const dy = e.clientY - startPan.current.y;
            startPan.current = { x: e.clientX, y: e.clientY };
            setViewState(prev => ({ ...prev, pan: clampPan({ x: prev.pan.x + dx, y: prev.pan.y + dy }, prev.zoom) }));
        };
        const handleMouseUp = () => {
            startPan.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setViewState, clampPan]);

    return (
        <>
            <div ref={view1Ref} className="lightbox-view" onWheel={onWheel} onMouseDown={handleMouseDown}>
                <img 
                    ref={image1Ref} 
                    src={element.srcBefore} 
                    className="lightbox-image" 
                    style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})` }} 
                    alt="Original" 
                    draggable={false}
                    onLoad={() => setIsImagesLoaded(p => ({...p, img1: true}))}
                />
                 {isImagesLoaded.img1 && image1Ref.current && view1Ref.current && (
                    <MiniMap imgRef={image1Ref} containerRef={view1Ref} viewState={viewState} setViewState={setViewState} clampPan={clampPan} />
                )}
                <div className="lightbox-compare-label" style={{ right: 8 }}>原圖</div>
            </div>
            <div className="w-px bg-white/50 flex-shrink-0 relative">
                 <div className="lightbox-compare-label" style={{ top: 8, left: '50%', transform: 'translateX(-50%)', writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '8px 4px' }}>
                    同步縮放平移
                </div>
            </div>
            <div ref={view2Ref} className="lightbox-view" onWheel={onWheel} onMouseDown={handleMouseDown}>
                <img 
                    ref={image2Ref} 
                    src={element.srcAfter} 
                    className="lightbox-image" 
                    style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})` }} 
                    alt="Generated" 
                    draggable={false} 
                    onLoad={() => setIsImagesLoaded(p => ({...p, img2: true}))}
                />
                 {isImagesLoaded.img2 && image2Ref.current && view2Ref.current && (
                    <MiniMap imgRef={image2Ref} containerRef={view2Ref} viewState={viewState} setViewState={setViewState} clampPan={clampPan} />
                )}
                 <div className="lightbox-compare-label" style={{ left: 8 }}>生成圖</div>
            </div>
        </>
    );
};

interface MiniMapProps {
    imgRef: React.RefObject<HTMLImageElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    viewState: { pan: Point; zoom: number };
    setViewState: React.Dispatch<React.SetStateAction<{ pan: Point; zoom: number }>>;
    clampPan: (pan: Point, zoom: number) => Point;
}

const MiniMap: React.FC<MiniMapProps> = ({ imgRef, containerRef, viewState, setViewState, clampPan }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const startDrag = useRef<{ x: number; y: number; startPan: Point } | null>(null);

    const handleMapClick = (e: React.MouseEvent) => {
        if (!mapRef.current || !imgRef.current || !containerRef.current) return;
        const mapRect = mapRef.current.getBoundingClientRect();
        const { naturalWidth } = imgRef.current;
        const { clientWidth, clientHeight } = containerRef.current;

        const scale = mapRect.width / naturalWidth;

        const clickX = e.clientX - mapRect.left;
        const clickY = e.clientY - mapRect.top;

        const targetWorldX = clickX / scale;
        const targetWorldY = clickY / scale;
        
        const newPanX = -targetWorldX * viewState.zoom + clientWidth / 2;
        const newPanY = -targetWorldY * viewState.zoom + clientHeight / 2;

        setViewState(prev => ({ ...prev, pan: clampPan({ x: newPanX, y: newPanY }, prev.zoom)}));
    };

    const handleViewportMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag.current = { x: e.clientX, y: e.clientY, startPan: viewState.pan };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!startDrag.current || !mapRef.current || !imgRef.current) return;

            const mapRect = mapRef.current.getBoundingClientRect();
            const { naturalWidth } = imgRef.current;
            const scale = mapRect.width / naturalWidth;
            
            const dx = e.clientX - startDrag.current.x;
            const dy = e.clientY - startDrag.current.y;

            const panDx = -(dx / scale) * viewState.zoom;
            const panDy = -(dy / scale) * viewState.zoom;
            
            setViewState(prev => ({...prev, pan: clampPan({ x: startDrag.current!.startPan.x + panDx, y: startDrag.current!.startPan.y + panDy }, prev.zoom)}));
        };
        const handleMouseUp = () => {
            startDrag.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [viewState.zoom, setViewState, clampPan]);

    if (!imgRef.current || !containerRef.current) return null;

    const { naturalWidth, naturalHeight } = imgRef.current;
    const { clientWidth, clientHeight } = containerRef.current;
    
    const mapWidth = 150;
    const scale = mapWidth / naturalWidth;
    const mapHeight = naturalHeight * scale;

    const vpWidth = (clientWidth / viewState.zoom) * scale;
    const vpHeight = (clientHeight / viewState.zoom) * scale;
    const vpLeft = (-viewState.pan.x / viewState.zoom) * scale;
    const vpTop = (-viewState.pan.y / viewState.zoom) * scale;

    return (
        <div ref={mapRef} className="lightbox-minimap" style={{ width: mapWidth, height: mapHeight }} onClick={handleMapClick}>
            <img src={imgRef.current.src} className="lightbox-minimap-img" alt="Minimap" draggable={false} />
            <div
                ref={viewportRef}
                className="lightbox-minimap-viewport"
                style={{ width: vpWidth, height: vpHeight, top: vpTop, left: vpLeft }}
                onMouseDown={handleViewportMouseDown}
            />
        </div>
    );
};
// END LIGHTBOX COMPONENT

export const hasGrayBorders = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
    const checkAreaSize = 10; // Check a 10x10 area at each corner
    if (width < checkAreaSize * 2 || height < checkAreaSize * 2) return false; // Image is too small to check

    const colorThreshold = 15; // How close to #808080 (128)
    const matchThreshold = 0.9; // 90% of pixels in the corner must be gray

    const checkCorner = (x: number, y: number): boolean => {
        const imageData = ctx.getImageData(x, y, checkAreaSize, checkAreaSize).data;
        let grayPixelCount = 0;
        for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i];
            const g = imageData[i+1];
            const b = imageData[i+2];
            if (Math.abs(r - 128) < colorThreshold && Math.abs(g - 128) < colorThreshold && Math.abs(b - 128) < colorThreshold) {
                grayPixelCount++;
            }
        }
        return (grayPixelCount / (checkAreaSize * checkAreaSize)) >= matchThreshold;
    }

    // Check if any of the four corners are predominantly gray
    return checkCorner(0, 0) || 
           checkCorner(width - checkAreaSize, 0) || 
           checkCorner(0, height - checkAreaSize) || 
           checkCorner(width - checkAreaSize, height - checkAreaSize);
};
