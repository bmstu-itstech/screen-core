'use client';

import { useEffect, useState, use, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Save, ArrowLeft, Clock, X, Film, Image as ImageIcon,
    Settings, VolumeX, Volume2, Upload,
    Loader2, GripVertical, Folder, Home, ChevronRight, CornerUpLeft, Plus, FileVideo, Network
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';

interface IFolder {
    _id: string;
    name: string;
    parentId: string;
}

interface IMaterial {
    _id: string;
    title: string;
    filename: string;
    type: 'image' | 'video';
    folderId: string;
}

interface IPlaylistItem extends IMaterial {
    duration: number;
    isMuted: boolean;
    materialId?: string;
}

interface IStructureConfig {
    name: string;
    isActive: boolean;
    currentMode: 'slideshow' | 'video';
    volume: number;
    startTime: string;
    endTime: string;
    playlist: IPlaylistItem[];
}

const secondsToTime = (totalSeconds: number): string => {
    if (totalSeconds >= 86400) return '23:59';
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const timeToSeconds = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
};

function useStructureData(id: string) {
    const [config, setConfig] = useState<IStructureConfig>({
        name: '',
        isActive: false,
        currentMode: 'slideshow',
        volume: 100,
        startTime: '00:00',
        endTime: '23:59',
        playlist: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [structureRes, mediaRes] = await Promise.all([
                    fetch(`/api/structure/${id}`),
                    fetch('/api/media')
                ]);

                if (!structureRes.ok) throw new Error('Unit not found');

                const unitData = await structureRes.json();
                const allMedia: IMaterial[] = await mediaRes.json();

                const populatedPlaylist = (unitData.playlist || []).map((item: { materialId: string; duration: number; isMuted?: boolean }) => {
                    const material = allMedia.find(m => m._id === item.materialId);
                    if (!material) return null;
                    return { ...material, duration: item.duration, isMuted: item.isMuted ?? false };
                }).filter((item: IPlaylistItem | null): item is IPlaylistItem => Boolean(item));

                setConfig({
                    name: unitData.name,
                    isActive: unitData.isActive ?? false,
                    currentMode: unitData.currentMode || 'slideshow',
                    volume: unitData.volume ?? 100,
                    startTime: unitData.timework?.[0] ? secondsToTime(unitData.timework[0]) : '00:00',
                    endTime: unitData.timework?.[1] ? secondsToTime(unitData.timework[1]) : '23:59',
                    playlist: populatedPlaylist
                });
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [id]);

    const saveConfig = async (newConfig: IStructureConfig) => {
        setIsSaving(true);
        try {
            const dbPlaylist = newConfig.playlist.map((item, idx) => ({
                materialId: item._id,
                duration: item.type === 'video' ? 0 : item.duration,
                order: idx,
                isMuted: item.isMuted
            }));

            let endSec = timeToSeconds(newConfig.endTime);
            if (endSec >= 86340) endSec = 86400;

            const res = await fetch(`/api/structure/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isActive: newConfig.isActive,
                    playlist: dbPlaylist,
                    currentMode: newConfig.currentMode,
                    volume: newConfig.volume,
                    timework: [timeToSeconds(newConfig.startTime), endSec]
                })
            });

            if (!res.ok) throw new Error('Save failed');
            alert("Настройки применены ко всей ветке!");
        } catch (e) {
            alert("Ошибка сохранения");
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return { config, setConfig, isLoading, isSaving, saveConfig };
}

function useLibrary() {
    const [files, setFiles] = useState<IMaterial[]>([]);
    const [folders, setFolders] = useState<IFolder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [history, setHistory] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            try {
                const [resFolders, resFiles] = await Promise.all([
                    fetch(`/api/folders?parentId=${currentFolderId}`),
                    fetch(`/api/media?folderId=${currentFolderId}`)
                ]);
                setFolders(await resFolders.json());
                setFiles(await resFiles.json());
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLibrary();
    }, [currentFolderId]);

    const navigateTo = (folder: IFolder) => {
        setHistory(prev => [...prev, { id: folder._id, name: folder.name }]);
        setCurrentFolderId(folder._id);
    };

    const navigateBack = () => {
        if (history.length === 0) return;
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        setCurrentFolderId(newHistory.length > 0 ? newHistory[newHistory.length - 1].id : 'root');
    };

    const navigateRoot = () => {
        setHistory([]);
        setCurrentFolderId('root');
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', currentFolderId);
        try {
            const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            const newFile = await res.json();
            setFiles(prev => [newFile, ...prev]);
        } catch (err) {
            alert("Ошибка загрузки");
        } finally {
            setIsUploading(false);
        }
    };

    return {
        files, folders, currentFolderId, history, isLoading, isUploading,
        navigateTo, navigateBack, navigateRoot, uploadFile
    };
}

function usePlaylist(initialPlaylist: IPlaylistItem[], currentMode: 'slideshow' | 'video', onChange: (p: IPlaylistItem[]) => void) {
    const dragItem = useRef<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const addItem = (material: IMaterial) => {
        if (currentMode === 'slideshow' && material.type === 'video') {
            if (!confirm("Вы добавляете видео в режим слайд-шоу. Оно не будет воспроизводиться. Продолжить?")) return;
        }
        if (currentMode === 'video' && material.type === 'image') {
            if (!confirm("Вы добавляете фото в режим видео. Оно будет пропущено. Продолжить?")) return;
        }
        onChange([...initialPlaylist, { ...material, duration: 10, isMuted: false }]);
    };

    const removeItem = (index: number) => {
        const newPl = [...initialPlaylist];
        newPl.splice(index, 1);
        onChange(newPl);
    };

    const updateItem = (index: number, key: keyof IPlaylistItem, value: unknown) => {
        const newPl = [...initialPlaylist];
        newPl[index] = { ...newPl[index], [key]: value };
        onChange(newPl);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        dragItem.current = index;
        setTimeout(() => setIsDragging(true), 0);
    };

    const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
        if (dragItem.current !== null && dragItem.current !== targetIndex) {
            const newList = [...initialPlaylist];
            const item = newList.splice(dragItem.current, 1)[0];
            newList.splice(targetIndex, 0, item);
            dragItem.current = targetIndex;
            onChange(newList);
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        dragItem.current = null;
    };

    return { addItem, removeItem, updateItem, handleDragStart, handleDragEnter, handleDragEnd, isDragging, dragIndex: dragItem.current };
}

const Header = ({
                    title, isActive, isSaving, onBack, onToggleActive, onSave
                }: {
    title: string; isActive: boolean; isSaving: boolean;
    onBack: () => void; onToggleActive: () => void; onSave: () => void;
}) => (
    <div className="flex justify-between items-center bg-[#0A0A0A] p-4 rounded-xl border border-gray-800">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition">
                <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <Network className="text-blue-500" size={24} />
                    <h1 className="text-xl font-bold text-white">{title}</h1>
                </div>
                <p className="text-sm text-gray-500 font-mono text-xs mt-0.5">Конфигурация узла</p>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-purple-900/20 p-2 px-4 rounded-lg border border-purple-500/30">
                <div className="flex flex-col items-end mr-2">
                    <span className={`text-xs font-bold uppercase ${isActive ? 'text-purple-400' : 'text-gray-500'}`}>
                        {isActive ? 'ШИРОКОВЕЩАТЕЛЬНЫЙ' : 'ЛОКАЛЬНЫЙ'}
                    </span>
                    <span className="text-[10px] text-gray-500">Высший приоритет</span>
                </div>
                <button
                    onClick={onToggleActive}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-purple-600' : 'bg-gray-700'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
            <Button variant="primary" onClick={onSave} disabled={isSaving}>
                <Save size={18} className="mr-2" />
                {isSaving ? 'Применить ко всем' : 'Сохранить'}
            </Button>
        </div>
    </div>
);

const SettingsBar = ({
                         config, onChange
                     }: {
    config: IStructureConfig; onChange: (key: keyof IStructureConfig, value: unknown) => void;
}) => (
    <div className="bg-[#0A0A0A] p-4 rounded-xl border border-gray-800 flex flex-wrap gap-6 items-center">
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Settings size={12}/> Режим</label>
            <div className="flex bg-black rounded-lg p-1 border border-gray-800">
                {['slideshow', 'video'].map((mode) => (
                    <button
                        key={mode}
                        onClick={() => onChange('currentMode', mode)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${config.currentMode === mode ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        {mode === 'slideshow' ? 'Слайд-шоу' : 'Видео'}
                    </button>
                ))}
            </div>
        </div>
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Clock size={12}/> Расписание</label>
            <div className="flex items-center gap-2">
                <input type="time" value={config.startTime} onChange={e => onChange('startTime', e.target.value)} className="bg-black border border-gray-800 text-white rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-mono"/>
                <span className="text-gray-500">-</span>
                <input type="time" value={config.endTime} onChange={e => onChange('endTime', e.target.value)} className="bg-black border border-gray-800 text-white rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-mono"/>
            </div>
        </div>
        <div className="flex flex-col gap-1.5 w-48">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">{config.volume === 0 ? <VolumeX size={12}/> : <Volume2 size={12}/>} Громкость: {config.volume}%</label>
            <input type="range" min="0" max="100" value={config.volume} onChange={(e) => onChange('volume', Number(e.target.value))} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
        </div>
    </div>
);

export default function StructureConfigPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { config, setConfig, isLoading, isSaving, saveConfig } = useStructureData(id);
    const { files, folders, currentFolderId, history, isLoading: isLibLoading, isUploading, navigateTo, navigateBack, navigateRoot, uploadFile } = useLibrary();

    const updatePlaylist = useCallback((newPlaylist: IPlaylistItem[]) => {
        setConfig(prev => ({ ...prev, playlist: newPlaylist }));
    }, [setConfig]);

    const { addItem, removeItem, updateItem, handleDragStart, handleDragEnter, handleDragEnd, isDragging, dragIndex } = usePlaylist(config.playlist, config.currentMode, updatePlaylist);

    const filteredFiles = useMemo(() => {
        return files.filter(m => config.currentMode === 'slideshow' ? m.type === 'image' : config.currentMode === 'video' ? m.type === 'video' : true);
    }, [files, config.currentMode]);

    if (isLoading) return <div className="fixed inset-0 bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Загрузка настроек узла...</div>;

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 animate-in fade-in">
            <Header
                title={config.name}
                isActive={config.isActive}
                isSaving={isSaving}
                onBack={() => router.back()}
                onToggleActive={() => setConfig(p => ({ ...p, isActive: !p.isActive }))}
                onSave={() => saveConfig(config)}
            />

            <SettingsBar config={config} onChange={(k, v) => setConfig(p => ({ ...p, [k]: v }))} />

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
                <div className="w-1/2 flex flex-col bg-[#0A0A0A] rounded-xl border border-gray-800 p-4 min-w-0">
                    <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                        <span>Общий плейлист</span>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">{config.playlist.length} items</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {config.playlist.map((item, idx) => (
                            <div
                                key={idx}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragEnter={(e) => handleDragEnter(e, idx)}
                                onDragEnd={handleDragEnd}
                                onDragOver={e => e.preventDefault()}
                                className={`flex items-center gap-3 p-2 pr-3 rounded border transition-all duration-200 group cursor-move 
                                    ${isDragging && dragIndex === idx ? "opacity-50 border-blue-500 border-dashed bg-blue-900/10" : "bg-black/50 border-gray-800 hover:border-gray-600"}`}
                            >
                                <div className="text-gray-600 group-hover:text-gray-400 cursor-move shrink-0"><GripVertical size={16} /></div>
                                <div className="text-gray-600 w-6 text-center font-mono text-xs shrink-0">{idx + 1}</div>
                                <div className="w-16 h-10 bg-gray-900 rounded overflow-hidden border border-gray-800 shrink-0 relative pointer-events-none">
                                    {item.type === 'video'
                                        ? <video src={`/static/${item.filename}#t=0.5`} className="w-full h-full object-cover" muted />
                                        : <img src={`/static/${item.filename}`} className="w-full h-full object-cover" alt="" />}
                                </div>
                                <div className="flex-1 min-w-0 pointer-events-none">
                                    <div className="truncate text-sm font-medium text-gray-200" title={item.title}>{item.title}</div>
                                    <div className="text-xs text-gray-500">{item.type}</div>
                                </div>
                                {item.type === 'video' && (
                                    <button
                                        onClick={() => updateItem(idx, 'isMuted', !item.isMuted)}
                                        className={`shrink-0 p-1.5 rounded transition ${item.isMuted ? 'text-red-500 bg-red-900/20' : 'text-gray-400 hover:text-white bg-gray-900'}`}
                                    >
                                        {item.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                    </button>
                                )}
                                <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded border border-gray-800 shrink-0">
                                    {item.type === 'video'
                                        ? <span className="text-xs text-blue-400 font-mono font-bold w-12 text-center">AUTO</span>
                                        : (
                                            <>
                                                <input
                                                    type="number"
                                                    value={item.duration}
                                                    onChange={(e) => updateItem(idx, 'duration', parseInt(e.target.value) || 5)}
                                                    className="w-8 bg-transparent text-white text-sm focus:outline-none text-center font-mono"
                                                    min={1}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                                <span className="text-xs text-gray-500">s</span>
                                            </>
                                        )
                                    }
                                </div>
                                <button onClick={() => removeItem(idx)} className="text-gray-600 hover:text-red-500 p-1.5 shrink-0"><X size={16} /></button>
                            </div>
                        ))}
                        {config.playlist.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm">Плейлист пуст</div>}
                    </div>
                </div>

                <div className="w-1/2 flex flex-col bg-[#0A0A0A] rounded-xl border border-gray-800 p-4 min-w-0">
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                {config.currentMode === 'slideshow' ? <ImageIcon size={16} className="text-blue-500"/> : <Film size={16} className="text-purple-500"/>}
                                Библиотека
                            </h3>
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                                    accept={config.currentMode === 'slideshow' ? "image/*" : "video/*"}
                                />
                                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                    {isUploading ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} className="mr-2"/>}
                                    {isUploading ? '...' : 'Загрузить'}
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs bg-black/40 p-2 rounded-lg border border-gray-800 overflow-x-auto">
                            <button onClick={navigateRoot} className={`flex items-center gap-1 hover:text-white transition whitespace-nowrap ${currentFolderId === 'root' ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                                <Home size={12} /> Root
                            </button>
                            {history.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                                    <ChevronRight size={10} />
                                    <span className={idx === history.length - 1 ? 'text-white font-bold' : 'text-gray-400'}>{item.name}</span>
                                </div>
                            ))}
                            {currentFolderId !== 'root' && (
                                <button onClick={navigateBack} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-white px-2 border-l border-gray-700">
                                    <CornerUpLeft size={10}/> Back
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col gap-1">
                            {folders.map(folder => (
                                <div key={folder._id} onClick={() => navigateTo(folder)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition group border border-transparent hover:border-white/5 w-full overflow-hidden">
                                    <Folder size={20} className="text-blue-500 fill-blue-500/20 shrink-0" />
                                    <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1 min-w-0">{folder.name}</span>
                                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                                </div>
                            ))}
                            {filteredFiles.map(mat => (
                                <div key={mat._id} onClick={() => addItem(mat)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition group border border-transparent hover:border-white/5 w-full overflow-hidden">
                                    <div className="w-10 h-8 bg-black rounded border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                                        {mat.type === 'video'
                                            ? <div className="relative w-full h-full"><video src={`/static/${mat.filename}#t=0.5`} className="w-full h-full object-cover opacity-60" /><div className="absolute inset-0 flex items-center justify-center"><FileVideo size={12} className="text-white"/></div></div>
                                            : <img src={`/static/${mat.filename}`} className="w-full h-full object-cover opacity-80" alt="" />}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center"><span className="text-sm text-gray-300 group-hover:text-white truncate w-full block" title={mat.title}>{mat.title}</span></div>
                                    <span className="shrink-0 text-[10px] uppercase text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">{mat.type}</span>
                                    <Plus size={16} className="shrink-0 text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            ))}
                        </div>
                        {!isLibLoading && folders.length === 0 && filteredFiles.length === 0 && (<div className="text-center text-gray-600 text-xs py-10">Папка пуста</div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}
