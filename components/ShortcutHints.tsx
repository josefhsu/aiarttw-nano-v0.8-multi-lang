import React from 'react';

interface ShortcutActions {
  [key: string]: () => void;
}

interface ShortcutHintsProps {
  actions: ShortcutActions;
  isLightboxOpen?: boolean;
}

interface Shortcut {
  keys: string;
  desc: string;
  actionKey?: string;
  highlight?: boolean;
}

export const ShortcutHints: React.FC<ShortcutHintsProps> = ({ actions, isLightboxOpen }) => {
  const shortcuts: Shortcut[] = [
      { keys: 'Tab', desc: '開/關所有面板' },
      { keys: 'N', desc: '新增便籤', actionKey: 'addNote' },
      { keys: 'A', desc: '新增箭頭', actionKey: 'addArrow' },
      { keys: 'U', desc: '新增圖片', actionKey: 'addImage' },
      { keys: 'I', desc: '新增Inpaint', actionKey: 'addInpaintPlaceholder' },
      { keys: 'O', desc: '新增Outpaint', actionKey: 'addOutpaintPlaceholder' },
      { keys: 'P', desc: '新增空圖層', actionKey: 'addPlaceholder' },
      { keys: 'D', desc: '繪圖', actionKey: 'draw' },
      { keys: 'C', desc: '攝像頭', actionKey: 'camera' },
      { keys: 'X', desc: '比較物件', actionKey: 'addCompare', highlight: true },
      { keys: 'Alt + I', desc: '靈感提示', actionKey: 'inspiration' },
      { keys: 'Alt + P', desc: '自動優化', actionKey: 'optimize' },
  ];

  return (
    <div className={`absolute top-1/2 right-4 -translate-y-1/2 z-30 p-4 text-gray-300 text-sm font-mono pointer-events-auto w-52 transition-opacity duration-500 ${isLightboxOpen ? 'opacity-0' : 'shortcut-panel-breathing'}`}>
      <h3 className="text-base font-bold text-[var(--cyber-cyan)] mb-3 text-center" style={{ textShadow: '0 0 8px var(--cyber-glow-cyan)' }}>快捷鍵</h3>
      <ul className="flex flex-col bg-slate-800/30 rounded-md border border-slate-700/50 overflow-hidden">
        {shortcuts.map(({ keys, desc, actionKey, highlight }, index) => (
          <li
            key={desc}
            onClick={() => actionKey && actions[actionKey] ? actions[actionKey]() : undefined}
            role="button"
            tabIndex={actionKey ? 0 : -1}
            aria-disabled={!actionKey}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && actionKey && actions[actionKey]) {
                    e.preventDefault();
                    actions[actionKey]();
                }
            }}
            className={`flex justify-between items-center gap-4 whitespace-nowrap w-full p-2 text-left transition-colors 
                        ${actionKey ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'}
                        ${index < shortcuts.length - 1 ? 'border-b border-slate-700/50' : ''}
                        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500`}
          >
            <span 
              className={`text-gray-400 ${highlight ? 'shortcut-highlight-pink font-bold' : ''}`} 
              style={{textShadow: '1px 1px 2px #000'}}
            >
              {desc}
            </span>
            <kbd className="px-2 py-1 text-sm font-semibold text-gray-200 bg-slate-900/50 border border-slate-700 rounded-md">
                {keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
};
