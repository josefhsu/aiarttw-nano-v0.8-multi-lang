import React, { useState } from 'react';
import type { CanvasElement, NoteElement, Point } from '../types';
import { ChevronDown, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { HOT_APPLICATIONS, PROMPT_MAP, ULTIMATE_EDITING_GUIDE, RANDOM_GRADIENTS } from '../constants';
import { UNIFIED_DIRECTOR_STYLES } from '../constants2';
import {
    NCL_OPTIONS,
    NIGHT_CITY_WEAPONS,
    NIGHT_CITY_VEHICLES,
    NIGHT_CITY_COMPANIONS,
    NIGHT_CITY_COMPANION_PROMPTS,
    NIGHT_CITY_MISSIONS,
    NIGHT_CITY_LEGENDS,
    generateRandomNCLFullPrompt,
    generateRandomCharacterDescription,
} from '../constants1';
import { calculateNoteHeight } from '../utils';

type AddNoteFn = (element: Omit<NoteElement, 'id' | 'zIndex'>) => void;

interface InspirationPanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    selectedElements: CanvasElement[];
    lockedGroupIds: Set<string>;
    prompts: Record<string, string>;
    onPromptsChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    addElement: (element: Omit<CanvasElement, 'id' | 'zIndex'>, sourcePrompt?: string) => CanvasElement;
    screenToCanvas: (p: Point) => Point;
    canvasSize: { width: number; height: number };
    elements: CanvasElement[];
    updateElements: (updates: { id: string; data: Partial<CanvasElement> }[]) => void;
    onTriggerContextualAction: (directive: string) => void;
}


interface PromptChoiceModalProps {
  title: string;
  options: string[];
  onConfirm: (choice: string) => void;
  onClose: () => void;
}

const PromptChoiceModal: React.FC<PromptChoiceModalProps> = ({ title, options, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm" onMouseDown={onClose}>
            <div
                className="bg-[var(--cyber-bg)] border border-[var(--cyber-border)] p-6 rounded-xl shadow-2xl flex flex-col gap-4 w-full max-w-2xl"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-[var(--cyber-cyan)]">{title}</h2>
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => onConfirm(option)}
                            className="w-full text-left p-3 bg-slate-800/50 rounded-md text-gray-300 hover:bg-slate-700/80 border border-transparent hover:border-cyan-500 transition-all"
                        >
                            <p className="text-sm whitespace-pre-wrap">{option}</p>
                        </button>
                    ))}
                </div>
                <div className="flex justify-end mt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-500">取消</button>
                </div>
            </div>
        </div>
    );
};

const NCL_NOTE_TITLES: Record<NCLCategory, string> = {
    character: '角色設定',
    weapons: '武器庫 & 載具',
    partners: '任務夥伴',
    settings: '幻夢設定',
    scenes: '任務場景'
};

// --- REUSABLE COMPONENTS ---

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    headerClassName?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = true, headerClassName = "" }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const isGuideCategory = /^[IVX]+\./.test(title);

    return (
        <div className="inspiration-section">
            <header
                className={`inspiration-section-header ${headerClassName}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <h3 style={isGuideCategory ? { color: 'var(--cyber-pink)', textShadow: '0 0 4px var(--cyber-glow-pink)' } : {}}>{title}</h3>
                <ChevronDown size={20} className={`${isOpen ? 'rotate-180' : ''}`} />
            </header>
            {isOpen && children}
        </div>
    );
};

interface ExpandableListProps {
    items: string[];
    onItemClick: (item: string) => void;
    initialCount?: number;
}

const ExpandableList: React.FC<ExpandableListProps> = ({ items, onItemClick, initialCount = 20 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayedItems = isExpanded ? items : items.slice(0, initialCount);

    return (
        <div className="inspiration-section-body">
            {displayedItems.map(item => (
                <button key={item} className="inspiration-btn" onClick={() => onItemClick(item)}>
                    {item}
                </button>
            ))}
            {items.length > initialCount && (
                <button
                    className="inspiration-btn text-[var(--cyber-cyan)] w-full"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? '顯示較少' : `顯示更多 (${items.length - initialCount})`}
                </button>
            )}
        </div>
    );
};

interface ExpandablePromptListProps {
    items: { name: string; prompt: string }[];
    onItemClick: (prompt: string, replace?: boolean) => void;
    initialCount?: number;
    buttonClassName?: string;
    expandButtonText?: string;
    replacePrompt?: boolean;
}

const ExpandablePromptList: React.FC<ExpandablePromptListProps> = ({ 
    items, 
    onItemClick, 
    initialCount = 15, 
    buttonClassName = "inspiration-btn",
    expandButtonText,
    replacePrompt = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayedItems = isExpanded ? items : items.slice(0, initialCount);

    return (
        <div className="inspiration-section-body">
            {displayedItems.map(item => (
                <button key={item.name} className={buttonClassName} title={item.prompt} onClick={() => onItemClick(item.prompt, replacePrompt)}>
                    {item.name}
                </button>
            ))}
            {items.length > initialCount && (
                <button
                    className="inspiration-expand-btn"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <span>{isExpanded ? '顯示較少' : (expandButtonText || `顯示更多 (${items.length - initialCount})`)}</span>
                    <ChevronDown size={16} className={`${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            )}
        </div>
    );
};


// --- MAIN PANEL COMPONENT ---

type NCLCategory = 'character' | 'weapons' | 'partners' | 'settings' | 'scenes';

export const InspirationPanel: React.FC<InspirationPanelProps> = ({
    isOpen,
    setIsOpen,
    selectedElements, lockedGroupIds, prompts, onPromptsChange,
    addElement, screenToCanvas, canvasSize, elements, updateElements,
    onTriggerContextualAction
}) => {
    const [activeMainTab, setActiveMainTab] = useState<'tools' | 'legends'>('tools');
    const [promptChoices, setPromptChoices] = useState<{ title: string; options: string[]; onConfirm: (choice: string) => void } | null>(null);
    const [isHotAppsExpanded, setIsHotAppsExpanded] = useState(false);
    
    const allCharOptions = NCL_OPTIONS;

    const [charSettings, setCharSettings] = useState(() => {
        const initialState: Record<string, string> = {};
        Object.keys(allCharOptions).forEach(key => {
            const optionsKey = key as keyof typeof allCharOptions;
            const optionConfig = allCharOptions[optionsKey];
            if (optionConfig && optionConfig.options) {
               initialState[key] = optionConfig.options[0];
            }
        });
        return initialState;
    });

    const handleNCLPrompt = (promptText: string, category: NCLCategory, replace = false) => {
        const noteWidth = 250;
        const noteHeight = calculateNoteHeight(promptText, noteWidth, 16);
        const center = screenToCanvas( {x: canvasSize.width / 2, y: canvasSize.height / 2 });
        
        const newNote: Omit<NoteElement, 'id'|'zIndex'> = {
            type: 'note',
            content: promptText,
            color: RANDOM_GRADIENTS[Math.floor(Math.random() * RANDOM_GRADIENTS.length)],
            fontSize: 16,
            position: { x: center.x - (noteWidth/2), y: center.y - (noteHeight/2)},
            width: noteWidth,
            height: noteHeight,
            rotation: 0,
            meta: { nclCategory: category },
        };
        addElement(newNote, promptText);
    };

    const handleButtonClick = (promptText: string) => {
        onTriggerContextualAction(promptText);
    };
    
    const handleCharSettingChange = (field: keyof typeof charSettings, value: string) => {
        setCharSettings(prev => ({ ...prev, [field]: value }));
    };

    const generateCharacterPrompt = () => {
        const selectedOptions: Record<string, string> = {};
        Object.entries(allCharOptions).forEach(([key, value]) => {
            const selectedValue = charSettings[key as keyof typeof charSettings];
            if (selectedValue && selectedValue !== value.options[0] && selectedValue !== value.label) {
                selectedOptions[key] = selectedValue;
            }
        });

        if (Object.keys(selectedOptions).length === 0) {
            handleNCLPrompt("A cyberpunk character.", 'character', true);
            return;
        }
        
        let parts = ['A cyberpunk character,'];
        if (selectedOptions.gender) parts.push(selectedOptions.gender);
        if (selectedOptions.lifePath) parts.push(`a ${selectedOptions.lifePath},`);
        if (selectedOptions.expression) parts.push(`with a ${selectedOptions.expression} expression,`);
        
        if (selectedOptions.hairStyle) {
            parts.push(`featuring ${selectedOptions.hairStyle} hair`);
            if (selectedOptions.hairColor) {
                parts.push(`in a ${selectedOptions.hairColor} color.`);
            } else {
                parts.push('.');
            }
        } else if (selectedOptions.hairColor) {
            parts.push(`with ${selectedOptions.hairColor} hair.`);
        }

        if (selectedOptions.headwear) parts.push(`Wearing ${selectedOptions.headwear} on their head.`);
        if (selectedOptions.outerwear) parts.push(`Their outerwear is a ${selectedOptions.outerwear}.`);
        if (selectedOptions.innerwear) parts.push(`Underneath, they have a ${selectedOptions.innerwear}.`);
        if (selectedOptions.legwear) parts.push(`They wear ${selectedOptions.legwear}.`);
        if (selectedOptions.footwear) parts.push(`On their feet are ${selectedOptions.footwear}.`);
        if (selectedOptions.faceCyberware) parts.push(`Facial cyberware includes ${selectedOptions.faceCyberware}.`);
        if (selectedOptions.bodyCyberware) parts.push(`Body modifications consist of ${selectedOptions.bodyCyberware}.`);

        const finalPrompt = parts.join(' ').replace(/\s,/g, ',').replace(/\s\./g, '.').replace(/,$/g, '.').trim();
        handleNCLPrompt(finalPrompt, 'character', true);
    };

    const handleDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>, category: NCLCategory) => {
        if (e.target.value) {
            handleNCLPrompt(e.target.value, category);
            e.target.selectedIndex = 0;
        }
    };
    
    const handleCompanionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companionName = e.target.value;
        if (companionName && NIGHT_CITY_COMPANION_PROMPTS[companionName]) {
            handleNCLPrompt(NIGHT_CITY_COMPANION_PROMPTS[companionName], 'partners');
        }
        e.target.selectedIndex = 0;
    };
    
    const createNoteWithPrompt = (content: string) => {
        handleNCLPrompt(content, 'scenes');
        setPromptChoices(null);
    };

    const handleRandomNCLClick = () => {
        if (selectedElements.length > 0) {
            onTriggerContextualAction("Generate a contextual Night City Legends prompt.");
        } else {
            setPromptChoices({
                title: '選擇一組夜城傳奇劇本',
                options: [generateRandomNCLFullPrompt(), generateRandomNCLFullPrompt(), generateRandomNCLFullPrompt()],
                onConfirm: createNoteWithPrompt
            });
        }
    };

    const handleRandomCharacterClick = () => {
        setPromptChoices({
            title: '選擇一位隨機角色',
            options: [generateRandomCharacterDescription(), generateRandomCharacterDescription(), generateRandomCharacterDescription()],
            onConfirm: (choice) => createNoteWithPrompt(choice)
        });
    };
    
    const displayedHotApps = isHotAppsExpanded ? HOT_APPLICATIONS : HOT_APPLICATIONS.slice(0, 20);

    return (
        <div 
            className={`absolute flex items-start transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-3rem)]'}`}
        >
            <div className="inspiration-panel ml-4">
                <div className="inspiration-panel-header">
                    鳥巢AI創意畫布v0.6
                </div>
                
                <div className="inspiration-main-tabs">
                    <button
                        className={`inspiration-main-tab-btn ${activeMainTab === 'tools' ? 'active' : ''}`}
                        onClick={() => setActiveMainTab('tools')}
                    >
                        靈感工具
                    </button>
                    <button
                        className={`inspiration-main-tab-btn legends-tab ${activeMainTab === 'legends' ? 'active' : ''}`}
                        onClick={() => setActiveMainTab('legends')}
                    >
                        夜城傳奇
                    </button>
                </div>

                <div className="inspiration-panel-content">
                    {activeMainTab === 'tools' && (
                        <>
                            <div className="inspiration-section">
                                <header className="inspiration-section-header !cursor-default">
                                    <h3>-火熱應用</h3>
                                </header>
                                <div className="inspiration-section-body">
                                     {displayedHotApps.map(app => (
                                        <button
                                            key={app}
                                            className="inspiration-btn"
                                            title={PROMPT_MAP[app] || app}
                                            onClick={() => handleButtonClick(PROMPT_MAP[app] || app)}
                                        >
                                            {app}
                                        </button>
                                    ))}
                                    {HOT_APPLICATIONS.length > 20 && (
                                        <button
                                            className="inspiration-btn text-[var(--cyber-cyan)] w-full"
                                            onClick={() => setIsHotAppsExpanded(!isHotAppsExpanded)}
                                        >
                                            {isHotAppsExpanded ? '顯示較少' : `顯示更多 (${HOT_APPLICATIONS.length - 20})`}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <CollapsibleSection title="終極改圖指南" defaultOpen={true}>
                                <div className="w-full space-y-2 p-3">
                                {ULTIMATE_EDITING_GUIDE.map(guide => (
                                    <CollapsibleSection key={guide.category} title={guide.category} defaultOpen={false}>
                                        <div className="inspiration-section-body flex-col !items-stretch">
                                            {guide.items.map(item => (
                                                 <button
                                                    key={item.name}
                                                    className="inspiration-btn !text-left !w-full"
                                                    title={item.prompt}
                                                    onClick={() => handleButtonClick(item.prompt)}
                                                >
                                                    {item.name}
                                                </button>
                                            ))}
                                         </div>
                                    </CollapsibleSection>
                                ))}
                                </div>
                            </CollapsibleSection>
                        </>
                    )}

                    {activeMainTab === 'legends' && (
                        <>
                            <div className="p-2 space-y-2">
                                <button onClick={handleRandomNCLClick} className="inspiration-btn-cyberpunk w-full mb-2">夜城傳奇隨機提示</button>
                                <CollapsibleSection title="角色設定" defaultOpen={false} headerClassName="!py-2">
                                    <div className="inspiration-section-body !p-2 flex-col gap-2">
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                            {Object.entries(allCharOptions).map(([key, value]) => (
                                                <div key={key} className="flex flex-col gap-1">
                                                    <select value={charSettings[key]} onChange={(e) => handleCharSettingChange(key as keyof typeof charSettings, e.target.value)} className="inspiration-btn w-full !text-xs !py-1.5">
                                                        {value.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={generateCharacterPrompt} className="inspiration-btn-cyberpunk w-full">送出角色提示</button>
                                            <button onClick={handleRandomCharacterClick} className="inspiration-btn-cyberpunk w-full">隨機角色提示</button>
                                        </div>
                                    </div>
                                </CollapsibleSection>
                                <CollapsibleSection title="武器庫 & 載具" defaultOpen={false} headerClassName="!py-2">
                                    <div className="inspiration-section-body !p-2 flex-col gap-2">
                                        <select onChange={(e) => handleDropdownSelect(e, 'weapons')} className="inspiration-btn w-full !text-xs !py-1.5">
                                            <option value="">選擇武器...</option>
                                            {Object.entries(NIGHT_CITY_WEAPONS).map(([cat, items]) => <optgroup key={cat} label={cat}>{items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>)}
                                        </select>
                                        <select onChange={(e) => handleDropdownSelect(e, 'weapons')} className="inspiration-btn w-full !text-xs !py-1.5">
                                            <option value="">選擇載具...</option>
                                            {Object.entries(NIGHT_CITY_VEHICLES).map(([cat, items]) => <optgroup key={cat} label={cat}>{items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>)}
                                        </select>
                                    </div>
                                </CollapsibleSection>
                                <CollapsibleSection title="任務夥伴" defaultOpen={false} headerClassName="!py-2">
                                     <div className="inspiration-section-body !p-2 flex-col">
                                         <select onChange={handleCompanionSelect} className="inspiration-btn w-full !text-xs !py-1.5">
                                            <option value="">選擇夥伴...</option>
                                            {Object.entries(NIGHT_CITY_COMPANIONS).map(([cat, items]) => <optgroup key={cat} label={cat}>{items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>)}
                                        </select>
                                     </div>
                                </CollapsibleSection>
                                <CollapsibleSection title="幻夢設定" defaultOpen={false} headerClassName="!py-2">
                                    <div className="inspiration-section-body !p-2 flex-col gap-2">
                                         <select onChange={(e) => handleDropdownSelect(e, 'settings')} className="inspiration-btn w-full !text-xs !py-1.5">
                                            <option value="">選擇任務類型...</option>
                                            {NIGHT_CITY_MISSIONS.map(mission => <optgroup key={mission.label} label={mission.label}>{mission.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</optgroup>)}
                                        </select>
                                        <select onChange={(e) => handleDropdownSelect(e, 'settings')} className="inspiration-btn w-full !text-xs !py-1.5">
                                             {UNIFIED_DIRECTOR_STYLES.map(style => <option key={style.name} value={style.prompt}>{style.name}</option>)}
                                        </select>
                                    </div>
                                </CollapsibleSection>
                            </div>
                            {Object.entries(NIGHT_CITY_LEGENDS).map(([category, subcategories]) => (
                                <div key={category} className="inspiration-section cyberpunk-section">
                                    <h3 className="cyberpunk-section-header">{category}</h3>
                                    
                                    <ExpandablePromptList
                                        items={(Object.values(subcategories as any) as { name: string; prompt: string }[][]).flat()}
                                        onItemClick={(prompt, replace) => handleButtonClick(prompt)}
                                        initialCount={15}
                                        buttonClassName="inspiration-btn-cyberpunk"
                                        expandButtonText={`更多${category}場景`}
                                        replacePrompt={true}
                                    />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
             <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-12 h-24 bg-slate-900/80 backdrop-blur-md rounded-r-lg border-y border-r border-[var(--cyber-border)] flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
                title="靈感工具"
            >
                <Lightbulb size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`} />
                <span className={`mt-2 text-xs writing-mode-vertical-rl transition-transform duration-300 ${isOpen ? '-rotate-12' : ''}`}>靈感</span>
                {isOpen ? <ChevronLeft size={16} className="mt-2" /> : <ChevronRight size={16} className="mt-2" />}
            </button>
            {promptChoices && <PromptChoiceModal {...promptChoices} onClose={() => setPromptChoices(null)} />}
        </div>
    );
};