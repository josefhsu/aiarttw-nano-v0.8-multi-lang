import { ULTIMATE_EDITING_GUIDE_KEYS, locales, HOT_APPLICATIONS_DATA } from './constants-i18n';

export const COLORS = [
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Lime', hex: '#a3e635' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#facc15' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Purple', hex: '#9333ea' },
];

export const ART_STYLE_KEYS = [
  'none', 'impressionism', 'postImpressionism', 'expressionism', 'cubism', 'surrealism', 'abstractExpressionism', 'popArt', 'minimalism', 'futurism', 'dadaism',
  'constructivism', 'fauvism', 'artNouveau', 'artDeco', 'bauhaus', 'opArt', 'kineticArt', 'renaissance', 'baroque', 'rococo',
  'photorealism', 'oilPainting', 'watercolor', 'fantasy', 'cyberpunk', 'steampunk', 'pointillism', 'sketch', 'cartoon', 'pixelArt', 'threeDRender',
  'vintagePhoto', 'gothic', 'graffiti', 'ukiyoE', 'neoclassicism', 'romanticism', 'realism', 'symbolism', 'suprematism', 'colorField',
  'conceptualArt', 'hyperrealism', 'lowbrowArt', 'streetArt', 'digitalPainting', 'conceptArt', 'anime', 'manga', 'americanComic', 'vaporwave',
  'glitchArt', 'synthwave', 'psychedelic', 'tribal', 'celtic', 'aboriginalArt', 'africanArt', 'islamicArt', 'indianArt', 'chinesePainting',
  'inkWashPainting', 'mayanArt', 'aztecArt', 'egyptianArt', 'greekPottery', 'romanMosaic', 'byzantineArt', 'insularArt', 'vikingArt', 'carolingianArt',
  'ottonianArt', 'romanesque', 'tudorStyle', 'elizabethanStyle', 'jacobeanStyle', 'georgianStyle', 'victorianStyle', 'edwardianStyle', 'artsAndCrafts', 'missionStyle',
  'prairieSchool', 'streamlineModerne', 'midCenturyModern', 'postmodernism', 'deconstructivism', 'brutalism', 'metaphysicalPainting', 'orphism', 'rayonism', 'vorticism',
  'deStijl', 'tonalism', 'luminism', 'precisionism', 'socialRealism', 'magicRealism'
];

export const ASPECT_RATIO_OPTIONS = [
    { text: '16:9', value: 16/9 },
    { text: '3:2', value: 3/2 },
    { text: '1:1', value: 1/1 },
    { text: '2:3', value: 2/3 },
    { text: '9:16', value: 9/16 },
];

export const CYBERPUNK_COLORS = ['var(--cyber-cyan)', 'var(--cyber-pink)', 'var(--cyber-purple)'];

export const RANDOM_GRADIENTS = [
  'linear-gradient(135deg, #00f5d4, #9d00ff)',
  'linear-gradient(135deg, #ff00f7, #00f5d4)',
  'linear-gradient(135deg, #f7ff00, #9d00ff)',
  'linear-gradient(135deg, #00f5d4, #ff00f7, #f7ff00)',
  'linear-gradient(45deg, #00f5d4, #00a2ff, #9d00ff, #ff00f7)',
  'linear-gradient(135deg, #f97794, #623aa2)',
  'linear-gradient(135deg, #84fab0, #8fd3f4)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #ff9a9e, #fad0c4)',
  'linear-gradient(135deg, #f6d365, #fda085)',
  'linear-gradient(135deg, #5ee7df, #b490ca)',
  'linear-gradient(135deg, #d299c2, #fef9d7)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #ff7e5f, #feb47b)',
  'linear-gradient(135deg, #89f7fe, #66a6ff)',
  'linear-gradient(135deg, #ff9a9e, #fecfef)',
  'linear-gradient(135deg, #c471ed, #f64f59)',
];

// Re-export for compatibility with components that haven't been updated yet
export const ULTIMATE_EDITING_GUIDE = ULTIMATE_EDITING_GUIDE_KEYS;
export const HOT_APPLICATIONS: string[] = [];
export const PROMPT_MAP: Record<string, string> = {};

// Correctly populate HOT_APPLICATIONS and PROMPT_MAP from the default zh-TW locale data
// This mimics the original (broken) intent but uses a valid data structure.
const zhLocale = locales['zh-TW'];
HOT_APPLICATIONS_DATA.forEach(item => {
    // Helper to extract the final key part (e.g., '3dStickers' from 'hotApps.items.3dStickers')
    const getNameKey = (key: string) => key.split('.')[2] as keyof typeof zhLocale.hotApps.items;
    const getPromptKey = (key: string) => key.split('.')[2] as keyof typeof zhLocale.hotApps.prompts;

    const name = zhLocale.hotApps.items[getNameKey(item.nameKey)];
    const prompt = zhLocale.hotApps.prompts[getPromptKey(item.promptKey)];
    HOT_APPLICATIONS.push(name);
    PROMPT_MAP[name] = prompt;
});


export type { Language, Locale } from './constants-i18n';
export { locales }; // Re-export locales

export const ART_STYLES = ART_STYLE_KEYS;
