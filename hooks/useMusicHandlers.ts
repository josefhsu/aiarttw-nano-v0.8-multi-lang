// hooks/useMusicHandlers.ts
import { useState, useEffect, useCallback, useRef } from 'react';
// Fix: Correctly import music-related types from the centralized types.ts file
import type { CanvasElement, MusicTrack, Playlist, RepeatMode, BackupData, ExportedTrack, ExportedPlaylist, ImageElement, DrawingElement, ImageCompareElement, ParsedLrcLine } from '../types';
import {
    addTrackToDB,
    getAllTracksFromDB,
    getTrackFromDB,
    updateTrackLrcInDB,
    clearAllTracksFromDB,
    savePlaylistToDB,
    getPlaylistsFromDB,
    deleteTrackFromDB,
    parseLRC,
    downloadImage,
} from '../utils';

interface UseMusicHandlersProps {
    elements: CanvasElement[];
}

export const useMusicHandlers = ({ elements }: UseMusicHandlersProps) => {
    const [isMusicPlayerVisible, setIsMusicPlayerVisible] = useState(false);
    const [allDbTracks, setAllDbTracks] = useState<{ id: number; name: string; file: File; lrc?: string }[]>([]);
    const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [activePlaylistName, setActivePlaylistName] = useState('所有音樂');
    const [currentTracklist, setCurrentTracklist] = useState<MusicTrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
    const [isShuffle, setIsShuffle] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentLyric, setCurrentLyric] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const musicUploadRefForLink = useRef<HTMLInputElement>(null);
    const trackDbIdToRelink = useRef<number | null>(null);
    const lyricIntervalRef = useRef<number | null>(null);

    const loadTracksAndPlaylists = useCallback(async () => {
        try {
            const dbTracks = await getAllTracksFromDB();
            setAllDbTracks(dbTracks);
            const loadedPlaylists = await getPlaylistsFromDB();
            setPlaylists(loadedPlaylists);
        } catch (error) {
            console.error("Failed to load music library:", error);
            if (error instanceof DOMException && error.name === 'InvalidStateError') {
                alert("無法訪問音樂庫。如果您正在使用隱私或無痕模式，請停用它以使用音樂播放器功能。");
            }
        }
    }, []);

    useEffect(() => {
        loadTracksAndPlaylists();
    }, [loadTracksAndPlaylists]);
    
    useEffect(() => {
        const objectUrls: string[] = [];
        // Fix: Refactored to explicitly create MusicTrack objects to resolve type predicate error.
        const process = async () => {
            const playableTracks = (await Promise.all(
                allDbTracks.map(async (dbTrack): Promise<MusicTrack | null> => {
                    if (!(dbTrack.file instanceof Blob)) {
                        console.error("Invalid file object in DB for track:", dbTrack.name);
                        return null;
                    }
                    const url = URL.createObjectURL(dbTrack.file);
                    objectUrls.push(url);
                    const track: MusicTrack = {
                        name: dbTrack.name.replace(/\.[^/.]+$/, ""),
                        url: url,
                        dbId: dbTrack.id,
                    };
                    if (dbTrack.lrc) {
                        track.lrc = parseLRC(dbTrack.lrc);
                    }
                    return track;
                })
            )).filter((t): t is MusicTrack => t !== null);
            setAllTracks(playableTracks);
        };
        process();
        return () => { objectUrls.forEach(url => URL.revokeObjectURL(url)); };
    }, [allDbTracks]);

    useEffect(() => {
        if (activePlaylistName === '所有音樂') {
            setCurrentTracklist(allTracks);
        } else {
            const playlist = playlists.find(p => p.name === activePlaylistName);
            if (playlist) {
                const playlistTracks = playlist.trackIds
                    .map(id => allTracks.find(t => t.dbId === id))
                    .filter((t): t is MusicTrack => !!t);
                setCurrentTracklist(playlistTracks);
            } else {
                setCurrentTracklist([]);
            }
        }
        setCurrentTrackIndex(-1);
    }, [activePlaylistName, allTracks, playlists]);

    const playTrack = useCallback((index: number) => {
        if (index < 0 || index >= currentTracklist.length) return;
        const track = currentTracklist[index];
        const audio = audioRef.current;
        audio.src = track.url;
        audio.play().then(() => setIsPlaying(true)).catch(e => console.error("Error playing audio:", e));
        setCurrentTrackIndex(index);
    }, [currentTracklist]);

    const handleNextTrack = useCallback(() => {
        if (currentTracklist.length === 0) return;
        if (isShuffle) {
            const currentIndexInShuffle = shuffledIndices.indexOf(currentTrackIndex);
            const nextIndexInShuffle = (currentIndexInShuffle + 1) % shuffledIndices.length;
            playTrack(shuffledIndices[nextIndexInShuffle]);
        } else {
            const nextIndex = (currentTrackIndex + 1) % currentTracklist.length;
            playTrack(nextIndex);
        }
    }, [currentTracklist.length, currentTrackIndex, isShuffle, shuffledIndices, playTrack]);
    
    useEffect(() => {
        const audio = audioRef.current;
        const onEnded = () => {
            if (repeatMode === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else if (repeatMode === 'all' || isShuffle) {
                handleNextTrack();
            } else { // 'off'
                if (currentTrackIndex === currentTracklist.length - 1 && !isShuffle) {
                    setIsPlaying(false);
                } else {
                    handleNextTrack();
                }
            }
        };
        const onTimeUpdate = () => { setCurrentTime(audio.currentTime); setDuration(audio.duration || 0); };
        const onLoadedData = () => { setDuration(audio.duration || 0); };
        
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadeddata', onLoadedData);
        return () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadeddata', onLoadedData);
        };
    }, [repeatMode, handleNextTrack, isShuffle, currentTrackIndex, currentTracklist.length]);
    
    useEffect(() => {
        if (lyricIntervalRef.current) clearInterval(lyricIntervalRef.current);
        const track = currentTracklist[currentTrackIndex];
        if (isPlaying && track?.lrc) {
            lyricIntervalRef.current = window.setInterval(() => {
                const currentLine = track.lrc?.slice().reverse().find(line => audioRef.current.currentTime >= line.time);
                setCurrentLyric(currentLine ? currentLine.text : null);
            }, 100);
        } else {
            setCurrentLyric(null);
        }
        return () => { if (lyricIntervalRef.current) clearInterval(lyricIntervalRef.current); };
    }, [isPlaying, currentTrackIndex, currentTracklist]);

    const handlePlayPause = useCallback(() => {
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            if (audio.src) {
                audio.play().then(() => setIsPlaying(true));
            } else if (currentTracklist.length > 0) {
                playTrack(0);
            }
        }
    }, [isPlaying, currentTracklist, playTrack]);

    const handleStop = useCallback(() => {
        const audio = audioRef.current;
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
    }, []);

    const handlePrevTrack = useCallback(() => {
        if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
        } else {
            if (currentTracklist.length === 0) return;
            if (isShuffle) {
                const currentIndexInShuffle = shuffledIndices.indexOf(currentTrackIndex);
                const prevIndexInShuffle = (currentIndexInShuffle - 1 + shuffledIndices.length) % shuffledIndices.length;
                playTrack(shuffledIndices[prevIndexInShuffle]);
            } else {
                const prevIndex = (currentTrackIndex - 1 + currentTracklist.length) % currentTracklist.length;
                playTrack(prevIndex);
            }
        }
    }, [currentTracklist.length, currentTrackIndex, isShuffle, shuffledIndices, playTrack]);

    const handleSelectTrack = useCallback((index: number) => {
        playTrack(index);
    }, [playTrack]);
    
    const handleSeek = useCallback((time: number) => {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);
    
    const handleToggleShuffle = useCallback(() => {
        setIsShuffle(prev => {
            if (!prev) { // turning shuffle on
                const indices = Array.from(Array(currentTracklist.length).keys());
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }
                setShuffledIndices(indices);
            }
            return !prev;
        });
    }, [currentTracklist.length]);

    const handleCycleRepeatMode = useCallback(() => {
        setRepeatMode(prev => {
            if (prev === 'off') return 'all';
            if (prev === 'all') return 'one';
            return 'off';
        });
    }, []);

    const handleFolderUpload = useCallback(async (files: FileList | null) => {
        if (!files) return;
        const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
        const lrcFiles = Array.from(files).filter(f => f.name.endsWith('.lrc'));

        for (const audioFile of audioFiles) {
            const lrcFile = lrcFiles.find(lrc => lrc.name.slice(0, -4) === audioFile.name.slice(0, audioFile.name.lastIndexOf('.')));
            let lrcContent: string | undefined = undefined;
            if (lrcFile) {
                lrcContent = await lrcFile.text();
            }
            await addTrackToDB({ name: audioFile.name, file: audioFile, lrc: lrcContent });
        }
        await loadTracksAndPlaylists();
    }, [loadTracksAndPlaylists]);
    
    const handleMusicDrop = useCallback(async (items: DataTransferItemList) => {
        const entries = Array.from(items).map(item => item.webkitGetAsEntry());
        const files: File[] = [];
        
        const scanFiles = async (entry: any) => {
            if (entry.isFile) {
                await new Promise<void>(resolve => entry.file((file: File) => {
                    files.push(file);
                    resolve();
                }));
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                let dirEntries: any[] = [];
                let readEntries = async () => {
                    await new Promise<void>(resolve => reader.readEntries(async (batch: any) => {
                        if (batch.length > 0) {
                            dirEntries = dirEntries.concat(batch);
                            await readEntries();
                        }
                        resolve();
                    }));
                };
                await readEntries();
                for (let dirEntry of dirEntries) await scanFiles(dirEntry);
            }
        };

        for (let entry of entries) await scanFiles(entry);
        
        const fileList = {
          length: files.length,
          item: (index: number) => files[index],
          ...files
        };
        await handleFolderUpload(fileList as unknown as FileList);
    }, [handleFolderUpload]);

    const handleLrcUpload = useCallback(async (file: File | null) => {
        if (!file || !currentTracklist[currentTrackIndex]) return;
        const currentTrack = currentTracklist[currentTrackIndex];
        const lrcContent = await file.text();
        await updateTrackLrcInDB(currentTrack.dbId, lrcContent);
        await loadTracksAndPlaylists();
    }, [currentTracklist, currentTrackIndex, loadTracksAndPlaylists]);

    const handleClearMusic = useCallback(async () => {
        if (window.confirm("確定要清除所有音樂和播放清單嗎？此操作無法復原。")) {
            handleStop();
            await clearAllTracksFromDB();
            await loadTracksAndPlaylists();
        }
    }, [handleStop, loadTracksAndPlaylists]);

    const handleDeleteTrack = useCallback(async (trackDbId: number) => {
        const trackToDelete = allDbTracks.find(t => t.id === trackDbId);
        if (trackToDelete && window.confirm(`確定要刪除 "${trackToDelete.name}" 嗎？`)) {
            if (currentTracklist[currentTrackIndex]?.dbId === trackDbId) handleStop();
            await deleteTrackFromDB(trackDbId);
            await loadTracksAndPlaylists();
        }
    }, [allDbTracks, currentTracklist, currentTrackIndex, handleStop, loadTracksAndPlaylists]);
    
    const handleSwitchPlaylist = useCallback((name: string) => {
        setActivePlaylistName(name);
    }, []);

    const handleSaveCurrentTracksAsPlaylist = useCallback(async () => {
        const name = prompt("請輸入播放清單名稱：");
        if (name && currentTracklist.length > 0) {
            await savePlaylistToDB(name, currentTracklist.map(t => t.dbId));
            await loadTracksAndPlaylists();
            setActivePlaylistName(name);
        }
    }, [currentTracklist, loadTracksAndPlaylists]);

    const handleExportPlaylists = useCallback(async () => {
        const tracks: ExportedTrack[] = await Promise.all(allDbTracks.map(async (t) => {
            return { id: t.id, name: t.name, fileName: t.file.name, lrc: t.lrc };
        }));
        const data: BackupData = { version: 2, tracks, playlists };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'birdnest_music_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [allDbTracks, playlists]);

    const handleImportPlaylists = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data: BackupData = JSON.parse(text);

        if (data.version !== 2) {
            alert("備份檔案版本不相容。");
            return;
        }
        
        alert("匯入將會清除現有音樂庫，請先自行備份。\n請在下一步選擇包含所有音樂檔案的資料夾。");

        trackDbIdToRelink.current = -1; // Special flag to start import process
        (window as any).importedBackupData = data;
        musicUploadRefForLink.current?.click();
        event.target.value = ''; // Reset file input
    }, []);

    const handleReloadFromLocal = useCallback(async () => {
        if (allDbTracks.length === 0) {
            alert("音樂庫是空的，請先上傳音樂。");
            return;
        }
        const needsRelink = allDbTracks.some(t => !t.file);
        if (needsRelink || window.confirm("重新連結所有音樂檔案？請選擇包含所有音樂的資料夾。")) {
            trackDbIdToRelink.current = -1; // Special flag for all tracks
            musicUploadRefForLink.current?.click();
        }
    }, [allDbTracks]);

    const handleRelinkFolderSelect = useCallback(async (files: FileList | null) => {
        if (!files) return;
        const fileMap = new Map<string, File>();
        for (const file of Array.from(files)) {
            fileMap.set(file.name, file);
        }
        
        if (trackDbIdToRelink.current === -1 && (window as any).importedBackupData) {
            // Import process
            await clearAllTracksFromDB();
            const data: BackupData = (window as any).importedBackupData;
            for (const track of data.tracks) {
                const file = fileMap.get(track.fileName);
                if (file) {
                    await addTrackToDB({ name: track.name, file, lrc: track.lrc });
                }
            }
            for (const playlist of data.playlists) {
                await savePlaylistToDB(playlist.name, playlist.trackIds);
            }
            delete (window as any).importedBackupData;
        } else {
             // Relink process
            const tracksToUpdate = trackDbIdToRelink.current === -1 ? allDbTracks : allDbTracks.filter(t => t.id === trackDbIdToRelink.current);
            for (const dbTrack of tracksToUpdate) {
                const file = fileMap.get(dbTrack.file.name);
                if (file) {
                    await addTrackToDB({ ...dbTrack, file });
                }
            }
        }
        trackDbIdToRelink.current = null;
        await loadTracksAndPlaylists();
        alert("音樂庫已更新！");
    }, [allDbTracks, loadTracksAndPlaylists]);
    
    const downloadImageElement = useCallback(async (elementId: string) => {
        const element = elements.find(el => el.id === elementId);
        if (element && (element.type === 'image' || element.type === 'drawing' || element.type === 'imageCompare')) {
            const src = (element.type === 'imageCompare') ? (element as ImageCompareElement).srcAfter : (element as ImageElement | DrawingElement).src;
            if (src) {
                await downloadImage(src, `${element.type}-${element.id}.png`);
            }
        }
    }, [elements]);
    

    const currentTrack = currentTracklist[currentTrackIndex];

    return {
        isMusicPlayerVisible, setIsMusicPlayerVisible,
        isPlaying,
        currentTrackName: currentTrack?.name ?? '無音樂',
        isLibraryEmpty: allTracks.length === 0,
        musicTracks: currentTracklist,
        currentTrackIndex,
        repeatMode, isShuffle, playlists, activePlaylistName,
        currentTime, duration, currentLyric,
        handlePlayPause, handleStop, handleNextTrack, handlePrevTrack, handleSelectTrack,
        handleFolderUpload, handleMusicDrop, handleLrcUpload, handleClearMusic,
        handleReloadFromLocal, handleCycleRepeatMode, handleToggleShuffle,
        handleSwitchPlaylist, handleDeleteTrack, handleSaveCurrentTracksAsPlaylist,
        handleExportPlaylists, handleImportPlaylists, handleSeek,
        musicUploadRefForLink, handleRelinkFolderSelect,
        downloadImage, downloadImageElement
    };
};
