
// constants5.ts
export const FILM_EMULATION_STYLES = [
  {
    category: 'A. 柯達 (Kodak) - 好萊塢的溫暖與故事感',
    films: [
      { name: 'Kodak Vision3 500T (5219)', prompt: '好萊塢之王。鎢絲燈光平衡(Tungsten)，顆粒細膩，寬容度極高。暗部細節豐富，膚色溫潤，是現代電影的絕對主力。風格：現代電影感、高寬容度、故事性膚色。' },
      { name: 'Kodak Vision3 250D (5207)', prompt: '日光平衡(Daylight)，色彩飽滿，顆粒極細。戶外場景的理想選擇，陽光下色彩鮮活真實。風格：陽光感、色彩真實、細膩純淨。' },
      { name: 'Kodak Vision3 50D (5203)', prompt: '柯達最細膩的底片。日光平衡，幾乎無顆粒，色彩還原精準。適用於光線充足的史詩級畫面。風格：極致純淨、史詩感、色彩精準。' },
      { name: 'Kodak Eastman Double-X 5222', prompt: '黑白電影的傳奇。中速黑白負片，對比度優美，顆粒經典，灰階過渡豐富。風格：經典黑白電影、高光柔和、暗部深邃。' },
      { name: 'Kodak Portra 400', prompt: '人像之王。極佳的膚色表現，色彩柔和，飽和度適中，顆粒細膩，寬容度極高。風格：溫暖膚色、柔和光線、空氣感。' },
      { name: 'Kodak Portra 160', prompt: '比 Portra 400 更細膩，色彩更清淡，適合棚拍和充足光線。風格：精緻人像、淡雅色彩、專業影棚感。' },
      { name: 'Kodak Ektar 100', prompt: '號稱「世界上最細膩的彩色負片」。色彩鮮豔飽和，對比度高，顆粒極細。適合風光攝影。風格：超高飽和度、銳利、風光大片感。' },
      { name: 'Kodak Gold 200', prompt: '消費級底片的經典。標誌性的暖黃調，顆粒感明顯，充滿懷舊氣息。風格：復古暖黃、生活感、90年代回憶。' },
      { name: 'Kodak ColorPlus 200', prompt: '比 Gold 更具復古感，紅色表現突出，性價比之選。風格：強烈復古感、電影紅、市井生活氣息。' },
      { name: 'Kodak Ektachrome E100', prompt: '傳奇反轉片。色彩鮮豔、乾淨、通透，藍色調尤其迷人，對比度高。風格：高飽和通透、時尚感、銳利乾淨。' },
      { name: 'Kodak Kodachrome (已停產)', prompt: '色彩的黃金標準。獨特的沖洗工藝帶來無與倫比的色彩深度和檔案穩定性。色彩真實又富有詩意。風格：紀實詩意、色彩沉澱、無可複製的傳奇。' },
      { name: 'Kodak Tri-X 400', prompt: '新聞攝影的靈魂。高對比度，顆粒粗獷有力，充滿張力。風格：高對比、粗顆粒、紀實力量感。' },
    ]
  },
  {
    category: 'B. 富士 (Fujifilm) - 日系的通透與寧靜',
    films: [
      { name: 'Fujifilm Eterna 500T', prompt: 'Kodak Vision 系列的對手。整體偏冷，暗部帶青藍色調，膚色表現更白皙。風格：日系電影感、暗部偏青、冷靜內斂。' },
      { name: 'Fujifilm Eterna Vivid 160T', prompt: '飽和度更高版本的 Eterna，色彩更鮮明，同時保持了富士的通透感。風格：飽和通透、色彩鮮明、現代感。' },
      { name: 'Fuji Provia 100F', prompt: '標準反轉片。色彩還原極其準確，無明顯偏色。風格：標準色彩、全能、專業精準。' },
      { name: 'Fuji Velvia 50', prompt: '風光攝影聖經。極高的色彩飽和度，尤其是對綠色和紅色的表現，對比度強烈。風格：極致艷麗、高飽和風光、超現實色彩。' },
      { name: 'Fuji Astia 100F', prompt: '人像反轉片。色彩柔和，飽和度低，膚色還原真實自然，影調過渡平滑。風格：柔和膚色、低飽和、優雅人像。' },
      { name: 'Fuji Pro 400H (已停產)', prompt: '富士的人像負片之王。色調偏青綠，畫面通透，被稱為「空氣感」底片。風格：日系清新、空氣感、膚色白皙通透。' },
      { name: 'Fuji Superia X-TRA 400', prompt: '消費級底片的代表。標誌性的富士綠，在陰天和螢光燈下表現出色。風格：富士綠、清冷街道、日常生活感。' },
      { name: 'Fuji C200', prompt: '富士入門級底片，色調清新淡雅，略帶綠調。風格：清新淡雅、日系小品、初學者友好。' },
      { name: 'Fuji Natura 1600 (已停產)', prompt: '夜之精靈。高感光度，弱光下仍能保持色彩和較細的顆粒，營造獨特的夜景氛圍。風格：弱光氛圍、城市夜景、獨特顆粒感。' },
      { name: 'Fuji Neopan Acros 100 II', prompt: '富士的專業黑白底片。顆粒極其細膩，灰階豐富，對比度適中。風格：極致細膩、豐富灰階、銳利現代黑白。' },
    ]
  },
  {
    category: 'C. 其他經典品牌與風格',
    films: [
      { name: 'Agfa Vista 200/400 (已停產)', prompt: '以其濃郁飽和的色彩聞名，特別是其溫暖而獨特的紅色和綠色。風格：德系濃郁、飽和暖色、童話感。' },
      { name: 'Agfa CT Precisa 100', prompt: 'Agfa 的反轉片，色彩鮮豔，略帶暖調，有「小 Velvia」之稱。風格：暖調艷麗、高飽和、復古歐式風情。' },
      { name: 'Ilford HP5 Plus 400', prompt: '英倫黑白之魂。與 Kodak Tri-X 齊名，但對比度稍低，顆粒感更柔和，寬容度極佳。風格：英倫紀實、柔和顆粒、寬容度高。' },
      { name: 'Ilford Delta 3200', prompt: '超高感光度黑白底片，顆粒粗獷，專為極端弱光環境設計。風格：極致顆粒、弱光拍攝、抽象藝術感。' },
      { name: 'CineStill 800T', prompt: '霓虹燈下的浪漫。由柯達電影底片製成，高光部分會產生獨特的紅色光暈(Halation)。風格：霓虹光暈、電影夜景、賽博龐克感。' },
      { name: 'Lomography Color Negative 400/800', prompt: '以其高飽和、高對比和不可預測的偏色聞名，追求 LOMO 隨性、充滿驚喜的藝術風格。風格：高飽和、隨機偏色、LOMO藝術。' },
    ]
  },
  {
    category: 'D. 歷史與工藝創造的風格',
    films: [
      { name: '特藝七彩技術 (Technicolor Process)', prompt: '不是底片，是拍攝和印染工藝。色彩極度飽和、純淨，質感如油畫。風格：油畫質感、超飽和三原色、好萊塢黃金時代。' },
      { name: '漂白效果 (Bleach Bypass)', prompt: '跳過漂白步驟的沖印工藝。畫面飽和度降低、對比度增強、顆粒變粗。風格：高對比、低飽和、粗糲寫實。' },
    ]
  },
  {
    category: '完整 Top 50 列表 (簡述擴充)',
    films: [
        { name: 'Kodak Aerochrome', prompt: '紅外線底片，將綠色變為洋紅，創造超現實景觀' },
        { name: 'Kodak Vision2', prompt: 'Vision3 的前代，顆粒稍粗，復古電影感更強' },
        { name: 'Kodak T-MAX 400', prompt: '現代 T 型顆粒黑白片，顆粒細，銳度高' },
        { name: 'Kodak Pro Image 100', prompt: '專業級消費片，膚色自然，適合活動記錄' },
        { name: 'Kodak Ultramax 400', prompt: '消費級高速片，色彩鮮豔，顆粒明顯' },
        { name: 'Kodak Vision3 200T', prompt: '中速鎢絲燈片，平衡 500T 和 50D' },
        { name: 'Kodak Vericolor', prompt: 'Portra 的前身，80年代婚紗照風格' },
        { name: 'Kodak Panatomic-X', prompt: '傳奇慢速黑白片，幾乎無顆粒' },
        { name: 'Fujifilm Reala', prompt: '號稱第四感光層，膚色還原極度真實' },
        { name: 'Fujifilm Velvia 100', prompt: 'Velvia 50 的現代版，顆粒更細，飽和度略低' },
        { name: 'Fujifilm Pro 160NS', prompt: 'Pro 400H 的低速版，色彩更柔和' },
        { name: 'Agfa Portra', prompt: 'Agfa 的 Portra，德式膚色' },
        { name: 'Agfa Scala 200X', prompt: '傳奇黑白反轉片，對比極高' },
        { name: 'Ilford FP4 Plus 125', prompt: '經典中速黑白，細膩銳利' },
        { name: 'Ilford SFX 200', prompt: '紅外黑白片，天空變黑，綠植變白' },
        { name: 'ORWO', prompt: '東德電影底片，色彩獨特，帶有冷戰時期的復古感' },
        { name: 'Foma Fomapan', prompt: '捷克黑白底片，顆粒粗獷，充滿藝術氣息' },
        { name: 'Autochrome Lumière', prompt: '最早的商業彩色攝影技術，點彩派畫風，顆粒粗大，夢幻朦朧' },
    ]
  }
];
