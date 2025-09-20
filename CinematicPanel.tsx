

import React, { useState } from 'react';
import type { CanvasElement, NoteElement, Point, PlaceholderElement } from '../types';
import { ChevronDown, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { CINEMATIC_STYLES } from '../constants4';
import { FILM_EMULATION_STYLES } from '../constants5';
import { RANDOM_GRADIENTS } from '../constants';
import { calculateNoteHeight } from '../utils';
import { v4 as uuidv4 } from 'uuid';

type AddElementsFn = (elements: Omit<CanvasElement, 'id' | 'zIndex'>[]) => void;

interface CinematicPanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    selectedElements: CanvasElement[];
    onTriggerContextualAction: (directive: string) => void;
    addElement: (element: Omit<CanvasElement, 'id' | 'zIndex'>, sourcePrompt?: string) => CanvasElement;
    screenToCanvas: (p: Point) => Point;
    canvasSize: { width: number; height: number };
}

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const isMainCategory = /^[A-G]\./.test(title);

    return (
        <div className="inspiration-section">
            <header
                className="inspiration-section-header"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <h3 style={isMainCategory ? { color: 'var(--cyber-pink)', textShadow: '0 0 4px var(--cyber-glow-pink)' } : {}}>{title}</h3>
                <ChevronDown size={20} className={`${isOpen ? 'rotate-180' : ''}`} />
            </header>
            {isOpen && <div className="inspiration-section-body flex-col !items-stretch">{children}</div>}
        </div>
    );
};

export const CinematicPanel: React.FC<CinematicPanelProps> = ({
    isOpen,
    setIsOpen,
    selectedElements,
    onTriggerContextualAction,
    addElement,
    screenToCanvas,
    canvasSize
}) => {
    
    const handleButtonClick = (promptText: string) => {
        onTriggerContextualAction(promptText);
    };

    return (
        <div 
            className={`absolute mt-[6.5rem] flex items-start transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-3rem)]'}`}
        >
            <div className="inspiration-panel ml-4" style={{ maxHeight: 'calc(100vh - 9rem)' }}>
                <div className="inspiration-panel-header">
                    電影感
                </div>
                
                <div className="inspiration-panel-content">
                    <CollapsibleSection title="電影調色" defaultOpen={true}>
                        <div className="w-full space-y-2 p-3">
                            {CINEMATIC_STYLES.map(styleCat => (
                                <CollapsibleSection key={styleCat.category} title={styleCat.category}>
                                    {styleCat.movies.map(movie => (
                                        <button
                                            key={movie.name}
                                            className="inspiration-btn w-full text-left !justify-start my-1"
                                            title={movie.prompt}
                                            onClick={() => handleButtonClick(movie.prompt)}
                                        >
                                            {movie.name}
                                        </button>
                                    ))}
                                </CollapsibleSection>
                            ))}
                        </div>
                    </CollapsibleSection>
                    <CollapsibleSection title="底片調色" defaultOpen={true}>
                        <div className="w-full space-y-2 p-3">
                            {FILM_EMULATION_STYLES.map(styleCat => (
                                <CollapsibleSection key={styleCat.category} title={styleCat.category}>
                                    {styleCat.films.map(film => (
                                        <button
                                            key={film.name}
                                            className="inspiration-btn w-full text-left !justify-start my-1"
                                            title={film.prompt}
                                            onClick={() => handleButtonClick(film.prompt)}
                                        >
                                            {film.name}
                                        </button>
                                    ))}
                                </CollapsibleSection>
                            ))}
                        </div>
                    </CollapsibleSection>
                </div>
            </div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-12 h-24 bg-slate-900/80 backdrop-blur-md rounded-r-lg border-y border-r border-[var(--cyber-border)] flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
                title="電影感"
            >
                <Film size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`} />
                <span className={`mt-2 text-xs writing-mode-vertical-rl transition-transform duration-300 ${isOpen ? '-rotate-12' : ''}`}>電影感</span>
                {isOpen ? <ChevronLeft size={16} className="mt-2" /> : <ChevronRight size={16} className="mt-2" />}
            </button>
        </div>
    );
};