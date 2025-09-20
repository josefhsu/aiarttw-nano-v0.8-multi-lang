import type { Area } from 'react-easy-crop';
// Fix: Import ParsedLrcLine from types.ts
import type { CanvasElement, Point, ParsedLrcLine } from './types';
import html2canvas from 'html2canvas';

export const getElementCenter = (element: CanvasElement): Point => {
  return {
    x: element.position.x + element.width / 2,
    y: element.position.y + element.height / 2,
  };
};

export const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const radians = (Math.PI / 180) * angle;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  // This alternative rotation matrix is being applied to fix a persistent issue
  // where alignment operations were swapped (e.g., vertical align moves horizontally)
  // for rotated objects.
  const nx = (cos * dx) + (sin * dy) + center.x;
  const ny = (-sin * dx) + (cos * dy) + center.y;
  
  return { x: nx, y: ny };
};

export const getElementsBounds = (elements: CanvasElement[]): { minX: number; minY: number; maxX: number; maxY: number } => {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach(element => {
    const center = getElementCenter(element);
    const corners = [
      { x: element.position.x, y: element.position.y }, // tl
      { x: element.position.x + element.width, y: element.position.y }, // tr
      { x: element.position.x + element.width, y: element.position.y + element.height }, // br
      { x: element.position.x, y: element.position.y + element.height }, // bl
    ];

    corners.forEach(corner => {
      const rotatedCorner = element.rotation !== 0 ? rotatePoint(corner, center, element.rotation) : corner;
      minX = Math.min(minX, rotatedCorner.x);
      minY = Math.min(minY, rotatedCorner.y);
      maxX = Math.max(maxX, rotatedCorner.x);
      maxY = Math.max(maxY, rotatedCorner.y);
    });
  });

  return { minX, minY, maxX, maxY };
};

export const getPortPosition = (element: CanvasElement, side: 'left' | 'right' | 'top' | 'bottom' | 'center'): Point => {
    const bounds = getElementsBounds([element]);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centerX = bounds.minX + width / 2;
    const centerY = bounds.minY + height / 2;

    switch(side) {
        case 'left': return { x: bounds.minX, y: centerY };
        case 'right': return { x: bounds.maxX, y: centerY };
        case 'top': return { x: centerX, y: bounds.minY };
        case 'bottom': return { x: centerX, y: bounds.maxY };
        case 'center': return { x: centerX, y: centerY };
    }
};


export const getCroppedImg = (imageSrc: string, pixelCrop: Area): Promise<{url: string, width: number, height: number} | null> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous'; // Important for external images
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      
      resolve({
          url: canvas.toDataURL('image/png'),
          width: pixelCrop.width,
          height: pixelCrop.height
      });
    };
    image.onerror = () => {
      resolve(null);
    }
  });
};

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]); // Return only base64 part
        reader.onerror = error => reject(error);
    });
}

export function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob, base64: string }> {
    return new Promise((resolve, reject) => {
        const parts = dataUrl.split(',');
        const mimeTypePart = parts[0].match(/:(.*?);/);
        if (!mimeTypePart || mimeTypePart.length < 2) {
            return reject(new Error("Invalid data URL"));
        }
        const mimeType = mimeTypePart[1];
        const base64 = parts[1];
        
        try {
            const byteString = atob(base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeType });
            resolve({ blob, base64 });
        } catch (error) {
            reject(error);
        }
    });
}

export const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
};

export const gcd = (a: number, b: number): number => {
  if (!b) return a;
  return gcd(b, a % b);
};

export const createGrayImage = (aspectRatio: number): string => {
    const canvas = document.createElement('canvas');
    // Use a fixed width for consistency, height is derived from aspect ratio
    const width = 512;
    const height = width / aspectRatio;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, width, height);
    }
    return canvas.toDataURL('image/png');
};

export const correctImageAspectRatio = (imageSrc: string, targetAspectRatio: number): Promise<{url: string, width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = async () => {
      if (image.width === 0 || image.height === 0) {
        return reject(new Error("Image has zero dimensions."));
      }

      const currentAspectRatio = image.width / image.height;
      if (Math.abs(currentAspectRatio - targetAspectRatio) < 0.01) {
        // Aspect ratio is correct, return original
        resolve({ url: imageSrc, width: image.width, height: image.height });
        return;
      }

      // Aspect ratio needs correction, calculate crop from center
      let cropWidth, cropHeight, cropX, cropY;
      if (currentAspectRatio > targetAspectRatio) { // Image is wider than target
        cropHeight = image.height;
        cropWidth = cropHeight * targetAspectRatio;
        cropX = (image.width - cropWidth) / 2;
        cropY = 0;
      } else { // Image is taller than target
        cropWidth = image.width;
        cropHeight = cropWidth / targetAspectRatio;
        cropX = 0;
        cropY = (image.height - cropHeight) / 2;
      }
      
      try {
        const croppedImage = await getCroppedImg(imageSrc, { x: cropX, y: cropY, width: cropWidth, height: cropHeight });
        if (croppedImage) {
          resolve(croppedImage);
        } else {
          // Fallback to original if cropping fails
          console.warn("Cropping for aspect ratio failed, falling back to original image.");
          resolve({ url: imageSrc, width: image.width, height: image.height });
        }
      } catch (error) {
         console.error("Failed to crop image for aspect ratio correction:", error);
         // Fallback to original on error
         resolve({ url: imageSrc, width: image.width, height: image.height });
      }
    };

    image.onerror = () => {
      reject(new Error("Image could not be loaded for aspect ratio correction."));
    }
  });
};

const NOTE_PADDING = 16; // Corresponds to p-4
const MIN_NOTE_HEIGHT = 50;

let measurementDiv: HTMLDivElement | null = null;

export const calculateNoteHeight = (content: string, width: number, fontSize: number): number => {
    if (!measurementDiv) {
        measurementDiv = document.createElement('div');
        document.body.appendChild(measurementDiv);
        Object.assign(measurementDiv.style, {
            fontFamily: 'sans-serif',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            position: 'absolute',
            visibility: 'hidden',
            left: '-9999px',
            boxSizing: 'border-box',
        });
    }

    Object.assign(measurementDiv.style, {
        width: `${width - NOTE_PADDING * 2}px`,
        fontSize: `${fontSize}px`,
        padding: '0',
    });

    measurementDiv.innerText = content || ' '; // Use a space to measure height even if empty

    const height = measurementDiv.scrollHeight;
    
    return Math.max(MIN_NOTE_HEIGHT, height + NOTE_PADDING * 2);
};

// --- IndexedDB for Music ---
const DB_NAME = 'birdnest-ai-canvas-db';
const DB_VERSION = 2;
const TRACKS_STORE_NAME = 'musicTracks';
const PLAYLISTS_STORE_NAME = 'playlists';

let dbInstance: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject("IndexedDB error");
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TRACKS_STORE_NAME)) {
        db.createObjectStore(TRACKS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
       if (!db.objectStoreNames.contains(PLAYLISTS_STORE_NAME)) {
        db.createObjectStore(PLAYLISTS_STORE_NAME, { keyPath: 'name' });
      }
    };
  });
};

export const addTrackToDB = async (track: { name: string; file: File, lrc?: string }): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRACKS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TRACKS_STORE_NAME);
    const request = store.add(track);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getTrackFromDB = async (id: number): Promise<{ id: number; name: string; file: File; lrc?: string } | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(TRACKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(TRACKS_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllTracksFromDB = async (): Promise<{ id: number; name: string; file: File; lrc?: string }[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(TRACKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(TRACKS_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const updateTrackLrcInDB = async (id: number, lrc: string): Promise<void> => {
    const db = await initDB();
    return new Promise(async (resolve, reject) => {
        const track = await getTrackFromDB(id);
        if (!track) return reject(`Track with id ${id} not found.`);

        const updatedTrack = { ...track, lrc };
        const transaction = db.transaction(TRACKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(TRACKS_STORE_NAME);
        const request = store.put(updatedTrack);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


export const clearAllTracksFromDB = async (): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([TRACKS_STORE_NAME, PLAYLISTS_STORE_NAME], 'readwrite');
        const tracksStore = transaction.objectStore(TRACKS_STORE_NAME);
        const playlistsStore = transaction.objectStore(PLAYLISTS_STORE_NAME);
        const clearTracksReq = tracksStore.clear();
        const clearPlaylistsReq = playlistsStore.clear();

        let completed = 0;
        const checkCompletion = () => {
            completed++;
            if (completed === 2) {
                resolve();
            }
        };
        
        clearTracksReq.onsuccess = checkCompletion;
        clearPlaylistsReq.onsuccess = checkCompletion;
        
        transaction.onerror = () => reject(transaction.error);
    });
};

export const savePlaylistToDB = async (name: string, trackIds: number[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLISTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PLAYLISTS_STORE_NAME);
        const request = store.put({ name, trackIds });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getPlaylistsFromDB = async (): Promise<{ name: string; trackIds: number[] }[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLISTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PLAYLISTS_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteTrackFromDB = async (trackId: number): Promise<void> => {
    const db = await initDB();
    return new Promise(async (resolve, reject) => {
        const transaction = db.transaction([TRACKS_STORE_NAME, PLAYLISTS_STORE_NAME], 'readwrite');
        const tracksStore = transaction.objectStore(TRACKS_STORE_NAME);
        const playlistsStore = transaction.objectStore(PLAYLISTS_STORE_NAME);

        tracksStore.delete(trackId);

        const cursorRequest = playlistsStore.openCursor();
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
                const playlist = cursor.value;
                const updatedTrackIds = playlist.trackIds.filter((id: number) => id !== trackId);
                if (updatedTrackIds.length < playlist.trackIds.length) {
                    cursor.update({ ...playlist, trackIds: updatedTrackIds });
                }
                cursor.continue();
            }
        };
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const removeTrackFromPlaylistInDB = async (playlistName: string, trackId: number): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PLAYLISTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PLAYLISTS_STORE_NAME);
        const getRequest = store.get(playlistName);
        
        getRequest.onsuccess = () => {
            const playlist = getRequest.result;
            if (playlist) {
                const updatedTrackIds = playlist.trackIds.filter((id: number) => id !== trackId);
                store.put({ ...playlist, trackIds: updatedTrackIds });
            }
        };
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const parseLRC = (lrcContent: string): ParsedLrcLine[] => {
    const lines = lrcContent.split('\n');
    const parsedLines: ParsedLrcLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const matches = [...trimmedLine.matchAll(timeRegex)];
        if (matches.length > 0) {
            const text = trimmedLine.replace(timeRegex, '').trim();
            if (text) {
                for (const match of matches) {
                    const minutes = parseInt(match[1], 10);
                    const seconds = parseInt(match[2], 10);
                    const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
                    const time = minutes * 60 + seconds + milliseconds / 1000;
                    parsedLines.push({ time, text });
                }
            }
        }
    }
    return parsedLines.sort((a, b) => a.time - b.time);
};

export const downloadImage = async (imageSrc: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


const INSPIRATION_EXAMPLES = [
  {
    modificationSuggestions: [
      "將貓咪變成一隻穿著太空服的太空貓，背景換成月球表面。",
      "把場景變成一個舒適的圖書館，貓咪正蜷縮在一堆書上打盹。",
      "為貓咪加上一對巨大的翅膀，讓牠看起來像一隻神話生物。",
    ],
    textPrompts: [
      "一隻可愛的虎斑貓，戴著一副學者眼鏡，坐在壁爐前的扶手椅上，周圍是堆滿書的書架，風格溫暖舒適。",
      "一隻機械貓，有著發光的藍色眼睛和金屬外殼，潛行在一個霓虹燈閃爍的賽博龐克城市巷道中。",
    ],
  },
  {
    modificationSuggestions: [
      "增加更多感官細節，如『溫暖的橘色光芒灑在臉上，空氣中瀰漫著青草和濕潤泥土的味道』。",
      "引入一個人物視角，例如一個正在看日落的老人，回憶著他的一生。",
      "將場景設定在一個意想不到的地方，例如火星上的日落，描述藍色的夕陽。",
    ],
    textPrompts: [
      "一對情侶坐在懸崖邊，看著太陽沉入雲海，天空被染成一片壯麗的粉紅色和金色。",
      "一個孤獨的機器人，站在一座廢棄城市的屋頂上，看著巨大的太陽緩緩落下，電子眼中閃爍著一絲人性。",
    ],
  },
    {
    modificationSuggestions: [
      "將這輛跑車的背景從城市街道換成一條蜿蜒的沿海公路，時間設定在黃昏。",
      "把車子的顏色從紅色變成消光黑，並加上一些賽博龐克風格的霓虹燈條。",
      "在駕駛座上加入一位戴著墨鏡、表情冷酷的司機，增加故事感。",
    ],
    textPrompts: [
      "一輛復古肌肉車，在沙漠公路上奔馳，捲起漫天塵土，電影感十足的廣角鏡頭。",
      "一輛未來派的懸浮概念車，停在一個極簡主義風格的白色建築前，光影對比強烈。",
    ],
  },
];

export const getRandomInspirationExamples = (): string => {
  const example = INSPIRATION_EXAMPLES[Math.floor(Math.random() * INSPIRATION_EXAMPLES.length)];
  return JSON.stringify(example, null, 2);
};

export const intersects = (
    rect1: { minX: number; minY: number; maxX: number; maxY: number },
    rect2: { minX: number; minY: number; maxX: number; maxY: number }
) => {
    return rect1.minX < rect2.maxX && rect1.maxX > rect2.minX && rect1.minY < rect2.maxY && rect1.maxY > rect2.minY;
};

export const findUnoccupiedPosition = (
    preferredPosition: Point,
    newElement: { width: number; height: number; rotation: number },
    existingElements: CanvasElement[]
): Point => {
    let currentPosition = { ...preferredPosition };
    const step = 50;
    let angle = 0;
    let radius = step;
    let checks = 0;

    const PADDING = 20; // Add padding around elements

    while (checks < 200) { // Limit checks
        const newElementBounds = getElementsBounds([{
            id: 'test-bounds',
            type: 'placeholder',
            position: currentPosition,
            width: newElement.width,
            height: newElement.height,
            rotation: newElement.rotation,
            zIndex: 9999
        }]);

        const paddedNewBounds = {
            minX: newElementBounds.minX - PADDING,
            minY: newElementBounds.minY - PADDING,
            maxX: newElementBounds.maxX + PADDING,
            maxY: newElementBounds.maxY + PADDING,
        };

        const isOverlapping = existingElements.some(el => {
            const elBounds = getElementsBounds([el]);
            return intersects(paddedNewBounds, elBounds);
        });

        if (!isOverlapping) {
            return currentPosition;
        }

        // Spiral out
        currentPosition.x = preferredPosition.x + radius * Math.cos(angle);
        currentPosition.y = preferredPosition.y + radius * Math.sin(angle);
        
        angle += Math.PI / 4;
        if (angle >= 2 * Math.PI) {
            angle = 0;
            radius += step;
        }
        checks++;
    }

    return preferredPosition; // Fallback
};
