import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface ShortcutActions {
  [key: string]: () => void;
}

interface ShortcutHintsProps {
  actions: ShortcutActions;
  isLightboxOpen?: boolean;
}

interface Shortcut {
  keys: string;
  descKey: string;
  actionKey?: string;
  highlight?: boolean;
}

export const ShortcutHints: React.FC<ShortcutHintsProps> = ({ actions, isLightboxOpen }) => {
  const { t } = useI18n();
  const shortcuts: Shortcut[] = [
      { keys: 'Tab', descKey: 'shortcutHints.togglePanels' },
      { keys: 'N', descKey: 'shortcutHints.addNote', actionKey: 'addNote' },
      { keys: 'A', descKey: 'shortcutHints.addArrow', actionKey: 'addArrow' },
      { keys: 'U', descKey: 'shortcutHints.addImage', actionKey: 'addImage' },
      { keys: 'I', descKey: 'shortcutHints.addInpaint', actionKey: 'addInpaintPlaceholder' },
      { keys: 'O', descKey: 'shortcutHints.addOutpaint', actionKey: 'addOutpaintPlaceholder' },
      { keys: 'P', descKey: 'shortcutHints.addPlaceholder', actionKey: 'addPlaceholder' },
      { keys: 'D', descKey: 'shortcutHints.draw', actionKey: 'draw' },
      { keys: 'C', descKey: 'shortcutHints.camera', actionKey: 'camera' },
      { keys: 'X', descKey: 'shortcutHints.addCompare', actionKey: 'addCompare', highlight: true },
      { keys: 'Alt + I', descKey: 'shortcutHints.inspiration', actionKey: 'inspiration' },
      { keys: 'Alt + P', descKey: 'shortcutHints.optimize', actionKey: 'optimize' },
  ];

  return (
    <div className={`absolute top-1/2 right-4 -translate-y-1/2 z-30 p-4 text-gray-300 text-sm font-mono pointer-events-auto w-52 transition-opacity duration-500 ${isLightboxOpen ? 'opacity-0' : 'shortcut-panel-breathing'}`}>
      <h3 className="text-base font-bold text-[var(--cyber-cyan)] mb-3 text-center" style={{ textShadow: '0 0 8px var(--cyber-glow-cyan)' }}>{t('shortcutHints.title')}</h3>
      <ul className="flex flex-col bg-slate-800/30 rounded-md border border-slate-700/50 overflow-hidden">
        {shortcuts.map(({ keys, descKey, actionKey, highlight }, index) => (
          <li
            key={descKey}
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
              {t(descKey)}
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
