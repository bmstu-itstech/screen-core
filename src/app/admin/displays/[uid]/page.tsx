'use client';

import { useEffect, useState, use, useRef, useMemo, ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    Save, ArrowLeft, Clock, X, Film, Image as ImageIcon,
    Settings, VolumeX, Volume2, Upload,
    Loader2, GripVertical, Folder, Home, ChevronRight,
    CornerUpLeft, Plus, FileVideo, Network, ChevronDown, Search, Check
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
    duration?: number;
    isMuted?: boolean;
}

interface IOrgUnit {
    _id: string;
    name: string;
    type: string;
    parentId: string | null;
}

interface IPlaylistItem extends IMaterial {
    order?: number;
}

interface IDeviceData {
    name: string;
    isActive: boolean;
    currentMode: 'slideshow' | 'video';
    volume: number;
    orgUnitId: string;
    playlist: IPlaylistItem[];
    timework: number[];
}

interface IFolderHistoryItem {
    id: string;
    name: string;
}

interface ISettingsBarProps {
    mode: 'slideshow' | 'video';
    setMode: (mode: 'slideshow' | 'video') => void;
    startTime: string;
    setStartTime: (time: string) => void;
    endTime: string;
    setEndTime: (time: string) => void;
    volume: number;
    setVolume: (vol: number) => void;
    orgUnits: IOrgUnit[];
    selectedOrgId: string;
    setSelectedOrgId: (id: string) => void;
}

interface IPlaylistProps {
    items: IPlaylistItem[];
    mode: 'slideshow' | 'video';
    onRemove: (index: number) => void;
    onUpdateDuration: (index: number, val: string) => void;
    onToggleMute: (index: number) => void;
    onDragReorder: (dragIndex: number, hoverIndex: number) => void;
}

interface ILibraryProps {
    folders: IFolder[];
    files: IMaterial[];
    currentMode: 'slideshow' | 'video';
    path: string;
    history: IFolderHistoryItem[];
    onNavigate: (folder: IFolder) => void;
    onBack: () => void;
    onRoot: () => void;
    onAdd: (item: IMaterial) => void;
    onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
}

const secondsToTime = (totalSeconds: number): string => {
    if (totalSeconds >= 86400) return '23:59';
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const timeToSeconds = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
};

const Header = ({
                    name, setName, uid, isActive, setIsActive, onSave, isSaving
                }: {
    name: string; setName: (v: string) => void; uid: string; isActive: boolean; setIsActive: (v: boolean) => void; onSave: () => void; isSaving: boolean;
}) => {
    const router = useRouter();
    return (
        <div className="flex justify-between items-center bg-[#0A0A0A] p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-transparent text-xl font-bold text-white focus:outline-none focus:bg-gray-900 rounded px-1 -ml-1 border border-transparent focus:border-gray-700 transition-colors"
                    />
                    <p className="text-gray-500 font-mono text-xs mt-0.5">UID: {uid}</p>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                    <span className={`text-xs font-bold uppercase ${isActive ? 'text-green-500' : 'text-gray-500'}`}>
                        {isActive ? 'Online' : 'Offline'}
                    </span>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-green-600' : 'bg-gray-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <Button variant="primary" onClick={onSave} disabled={isSaving}>
                    <Save size={18} className="mr-2" /> {isSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
            </div>
        </div>
    );
};

const OrgUnitSelector = ({
                             units, selectedId, onSelect
                         }: {
    units: IOrgUnit[]; selectedId: string; onSelect: (id: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const tree = useMemo(() => {
        if (search.trim()) {
            return units
                .filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
                .map(u => ({ ...u, depth: 0 }));
        }

        const result: (IOrgUnit & { depth: number })[] = [];
        const childrenMap = new Map<string, IOrgUnit[]>();
        const allIds = new Set(units.map(u => u._id));

        units.forEach(u => {
            const pid = u.parentId || 'root';
            const list = childrenMap.get(pid) || [];
            list.push(u);
            childrenMap.set(pid, list);
        });

        const traverse = (parentId: string, depth: number) => {
            const children = childrenMap.get(parentId);
            if (!children) return;
            children.forEach(child => {
                result.push({ ...child, depth });
                traverse(child._id, depth + 1);
            });
        };

        units
            .filter(u => !u.parentId || !allIds.has(u.parentId))
            .forEach(root => {
                result.push({ ...root, depth: 0 });
                traverse(root._id, 1);
            });

        return result;
    }, [units, search]);

    const selectedName = units.find(u => u._id === selectedId)?.name || 'Не привязано';

    return (
        <div className="flex flex-col gap-1.5 w-72 ml-auto relative" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <Network size={12}/> Расположение
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-black border text-white rounded px-3 py-2 text-sm transition-all ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-gray-800 hover:border-gray-600'}`}
            >
                <span className="truncate">{selectedName}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-gray-800 rounded-lg shadow-2xl overflow-hidden z-50 flex flex-col max-h-80 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-gray-800 bg-[#111] sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 text-gray-500" size={14} />
                            <input
                                type="text"
                                className="w-full bg-black border border-gray-800 rounded pl-8 pr-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                                placeholder="Найти отдел..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                        <button
                            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-white/5 rounded transition-colors"
                            onClick={() => { onSelect(''); setIsOpen(false); }}
                        >
                            -- Не привязано --
                        </button>
                        {tree.map(unit => (
                            <button
                                key={unit._id}
                                onClick={() => { onSelect(unit._id); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between group transition-colors ${selectedId === unit._id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                style={{ paddingLeft: `${(unit.depth * 16) + 12}px` }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    {unit.type === 'root' ? <Network size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-gray-400" />}
                                    <span className="truncate">{unit.name}</span>
                                </div>
                                {selectedId === unit._id && <Check size={14} />}
                            </button>
                        ))}
                        {tree.length === 0 && <div className="p-4 text-center text-xs text-gray-500">Ничего не найдено</div>}
                    </div>
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
        </div>
    );
};

const SettingsBar = ({
                         mode, setMode, startTime, setStartTime, endTime, setEndTime, volume, setVolume, orgUnits, selectedOrgId, setSelectedOrgId
                     }: ISettingsBarProps) => {
    return (
        <div className="bg-[#0A0A0A] p-4 rounded-xl border border-gray-800 flex flex-wrap gap-6 items-center relative z-10">
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Settings size={12}/> Режим</label>
                <div className="flex bg-black rounded-lg p-1 border border-gray-800">
                    <button onClick={() => setMode('slideshow')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'slideshow' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Слайд-шоу</button>
                    <button onClick={() => setMode('video')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'video' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Видео</button>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Clock size={12}/> Расписание</label>
                <div className="flex items-center gap-2">
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-black border border-gray-800 text-white rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-mono"/>
                    <span className="text-gray-500">-</span>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-black border border-gray-800 text-white rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none font-mono"/>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 w-32">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">{volume === 0 ? <VolumeX size={12}/> : <Volume2 size={12}/>} Громкость</label>
                <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
            </div>

            <OrgUnitSelector units={orgUnits} selectedId={selectedOrgId} onSelect={setSelectedOrgId} />
        </div>
    );
};

const Playlist = ({
                      items, mode, onRemove, onUpdateDuration, onToggleMute, onDragReorder
                  }: IPlaylistProps) => {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    const handleDragStart = (e: DragEvent, index: number) => {
        setDraggingIndex(index);
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragEnter = (e: DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggingIndex !== null && draggingIndex !== targetIndex) {
            onDragReorder(draggingIndex, targetIndex);
            setDraggingIndex(targetIndex);
        }
    };

    const handleDragEnd = () => {
        setDraggingIndex(null);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="w-1/2 flex flex-col bg-[#0A0A0A] rounded-xl border border-gray-800 p-4 min-w-0">
            <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                <span>Плейлист</span>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">{items.length} items</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {items.map((item, idx) => {
                    const isInvalid = (mode === 'slideshow' && item.type === 'video') || (mode === 'video' && item.type === 'image');
                    const isDraggingThis = draggingIndex === idx;

                    return (
                        <div
                            key={`${item._id}_${idx}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragEnter={(e) => handleDragEnter(e, idx)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 p-2 pr-3 rounded border transition-all duration-200 group cursor-move
                                ${isInvalid ? 'bg-red-900/10 border-red-900/50' : 'bg-black/50 border-gray-800 hover:border-gray-600'}
                                ${isDraggingThis ? "opacity-50 border-blue-500 border-dashed" : ""}
                            `}
                        >
                            <div className="text-gray-600 group-hover:text-gray-400 cursor-move shrink-0"><GripVertical size={16} /></div>
                            <div className="text-gray-600 w-6 text-center font-mono text-xs shrink-0">{idx + 1}</div>
                            <div className="w-16 h-10 bg-gray-900 rounded overflow-hidden border border-gray-800 shrink-0 relative pointer-events-none">
                                {item.type === 'video' ?
                                    <div className="w-full h-full bg-black flex items-center justify-center">
                                        <video src={`/static/${item.filename}#t=0.5`} className="w-full h-full object-cover" muted />
                                    </div> :
                                    <img src={`/static/${item.filename}`} className="w-full h-full object-cover" alt="" />
                                }
                            </div>
                            <div className="flex-1 min-w-0 pointer-events-none">
                                <div className={`truncate text-sm font-medium ${isInvalid ? 'text-red-400' : 'text-gray-200'}`} title={item.title}>{item.title}</div>
                                <div className="text-xs text-gray-500">{item.type}</div>
                            </div>
                            {!isInvalid && item.type === 'video' && (
                                <button onClick={() => onToggleMute(idx)} className={`shrink-0 p-1.5 rounded transition ${item.isMuted ? 'text-red-500 bg-red-900/20' : 'text-gray-400 hover:text-white bg-gray-900'}`}>
                                    {item.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>
                            )}
                            {!isInvalid && (
                                <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded border border-gray-800 shrink-0">
                                    {item.type === 'video' ?
                                        <span className="text-xs text-blue-400 font-mono font-bold w-12 text-center">AUTO</span> :
                                        <>
                                            <input type="number" value={item.duration} onChange={(e) => onUpdateDuration(idx, e.target.value)} className="w-8 bg-transparent text-white text-sm focus:outline-none text-center font-mono" min={1} onMouseDown={e => e.stopPropagation()}/>
                                            <span className="text-xs text-gray-500">s</span>
                                        </>
                                    }
                                </div>
                            )}
                            <button onClick={() => onRemove(idx)} className="text-gray-600 hover:text-red-500 p-1.5 shrink-0"><X size={16} /></button>
                        </div>
                    );
                })}
                {items.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm">Плейлист пуст</div>}
            </div>
        </div>
    );
};

const Library = ({
                     folders, files, currentMode, path, history, onNavigate, onBack, onRoot, onAdd, onUpload, isUploading
                 }: ILibraryProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredFiles = useMemo(() => files.filter((m) => {
        if (currentMode === 'slideshow') return m.type === 'image';
        if (currentMode === 'video') return m.type === 'video';
        return true;
    }), [files, currentMode]);

    return (
        <div className="w-1/2 flex flex-col bg-[#0A0A0A] rounded-xl border border-gray-800 p-4 min-w-0">
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {currentMode === 'slideshow' ? <ImageIcon size={16} className="text-blue-500"/> : <Film size={16} className="text-purple-500"/>} Библиотека
                    </h3>
                    <div>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={onUpload} accept={currentMode === 'slideshow' ? "image/*" : "video/*"} />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} className="mr-2"/>} {isUploading ? '...' : 'Загрузить'}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-xs bg-black/40 p-2 rounded-lg border border-gray-800 overflow-x-auto">
                    <button onClick={onRoot} className={`flex items-center gap-1 hover:text-white transition whitespace-nowrap ${path === 'root' ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                        <Home size={12} /> Root
                    </button>
                    {history.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                            <ChevronRight size={10} />
                            <span className={idx === history.length - 1 ? 'text-white font-bold' : 'text-gray-400'}>{item.name}</span>
                        </div>
                    ))}
                    {path !== 'root' && (
                        <button onClick={onBack} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-white px-2 border-l border-gray-700">
                            <CornerUpLeft size={10}/> Назад
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-1">
                    {folders.map((folder) => (
                        <div key={folder._id} onClick={() => onNavigate(folder)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition group border border-transparent hover:border-white/5 w-full overflow-hidden">
                            <Folder size={20} className="text-blue-500 fill-blue-500/20 shrink-0" />
                            <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1 min-w-0">{folder.name}</span>
                            <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                        </div>
                    ))}
                    {filteredFiles.map((mat) => (
                        <div key={mat._id} onClick={() => onAdd(mat)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition group border border-transparent hover:border-white/5 w-full overflow-hidden">
                            <div className="w-10 h-8 bg-black rounded border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                                {mat.type === 'video' ?
                                    <div className="relative w-full h-full">
                                        <video src={`/static/${mat.filename}#t=0.5`} className="w-full h-full object-cover opacity-60" />
                                        <div className="absolute inset-0 flex items-center justify-center"><FileVideo size={12} className="text-white"/></div>
                                    </div> :
                                    <img src={`/static/${mat.filename}`} className="w-full h-full object-cover opacity-80" alt="" />
                                }
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-sm text-gray-300 group-hover:text-white truncate w-full block" title={mat.title}>{mat.title}</span>
                            </div>
                            <span className="shrink-0 text-[10px] uppercase text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">{mat.type}</span>
                            <Plus size={16} className="shrink-0 text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                    ))}
                </div>
                {folders.length === 0 && filteredFiles.length === 0 && <div className="text-center text-gray-600 text-xs py-10">Папка пуста</div>}
            </div>
        </div>
    );
};

export default function DisplayConfigPage({ params }: { params: Promise<{ uid: string }> }) {
    const { uid } = use(params);

    const [isLoading, setIsLoading] = useState(true);
    const [device, setDevice] = useState<Partial<IDeviceData>>({});
    const [orgUnits, setOrgUnits] = useState<IOrgUnit[]>([]);
    const [playlist, setPlaylist] = useState<IPlaylistItem[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');

    const [libraryFiles, setLibraryFiles] = useState<IMaterial[]>([]);
    const [libraryFolders, setLibraryFolders] = useState<IFolder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [folderHistory, setFolderHistory] = useState<IFolderHistoryItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const [devRes, orgRes, mediaRes] = await Promise.all([
                    fetch(`/api/devices/${uid}`),
                    fetch('/api/structure'),
                    fetch('/api/media')
                ]);

                if (!devRes.ok) throw new Error('Device not found');

                const devData = await devRes.json();
                const allMedia: IMaterial[] = await mediaRes.json();

                setDevice({
                    name: devData.name || 'Display',
                    isActive: devData.isActive ?? true,
                    currentMode: devData.currentMode || 'slideshow',
                    volume: devData.volume ?? 100,
                    orgUnitId: devData.orgUnitId?.toString() || ''
                });

                if (devData.timework?.length === 2) {
                    setStartTime(secondsToTime(devData.timework[0]));
                    setEndTime(secondsToTime(devData.timework[1]));
                }

                const orgData = await orgRes.json();
                setOrgUnits(Array.isArray(orgData) ? orgData : []);

                const populatedPlaylist = (devData.playlist || []).map((item: { materialId: string; duration: number; isMuted: boolean }) => {
                    const mat = allMedia.find((m) => m._id === item.materialId);
                    return mat ? { ...mat, duration: item.duration, isMuted: item.isMuted || false } : null;
                }).filter((item: IPlaylistItem | null): item is IPlaylistItem => item !== null);

                setPlaylist(populatedPlaylist);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, [uid]);

    useEffect(() => {
        const loadLibrary = async () => {
            try {
                const [resFolders, resFiles] = await Promise.all([
                    fetch(`/api/folders?parentId=${currentFolderId}`),
                    fetch(`/api/media?folderId=${currentFolderId}`)
                ]);
                setLibraryFolders(await resFolders.json());
                setLibraryFiles(await resFiles.json());
            } catch (e) { console.error(e); }
        };
        loadLibrary();
    }, [currentFolderId]);

    const handleSave = async () => {
        setIsSaving(true);
        const dbPlaylist = playlist.map((item, idx) => ({
            materialId: item._id,
            duration: item.type === 'video' ? 0 : item.duration,
            order: idx,
            isMuted: item.isMuted
        }));

        let endSec = timeToSeconds(endTime);
        if (endSec >= 86340) endSec = 86400;

        try {
            const res = await fetch(`/api/devices/${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...device,
                    playlist: dbPlaylist,
                    timework: [timeToSeconds(startTime), endSec]
                })
            });
            if (!res.ok) throw new Error('Save failed');
        } catch (e) { alert("Ошибка сохранения"); }
        finally { setIsSaving(false); }
    };

    const handleAddToPlaylist = (material: IMaterial) => {
        if (device.currentMode === 'slideshow' && material.type === 'video') {
            if(!confirm("Видео в слайд-шоу не будет работать. Добавить?")) return;
        }
        if (device.currentMode === 'video' && material.type === 'image') {
            if(!confirm("Фото в режиме видео не будет работать. Добавить?")) return;
        }
        setPlaylist(prev => [...prev, { ...material, duration: 10, isMuted: false }]);
    };

    const handlePlaylistReorder = (dragIndex: number, hoverIndex: number) => {
        setPlaylist(prev => {
            const result = [...prev];
            const [removed] = result.splice(dragIndex, 1);
            result.splice(hoverIndex, 0, removed);
            return result;
        });
    };

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', currentFolderId);
        try {
            const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error();
            const newFile = await res.json();
            setLibraryFiles(prev => [newFile, ...prev]);
        } catch (err) { alert("Ошибка загрузки"); }
        finally { setIsUploading(false); e.target.value = ''; }
    };

    if (isLoading) return <div className="fixed inset-0 bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Loading...</div>;

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 animate-in fade-in pb-10">
            <Header
                name={device.name || ''}
                setName={(n) => setDevice(d => ({ ...d, name: n }))}
                uid={uid}
                isActive={device.isActive || false}
                setIsActive={(a) => setDevice(d => ({ ...d, isActive: a }))}
                onSave={handleSave}
                isSaving={isSaving}
            />

            <SettingsBar
                mode={device.currentMode || 'slideshow'}
                setMode={(m) => setDevice(d => ({ ...d, currentMode: m }))}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                volume={device.volume || 0}
                setVolume={(v: number) => setDevice(d => ({ ...d, volume: v }))}
                orgUnits={orgUnits}
                selectedOrgId={device.orgUnitId || ''}
                setSelectedOrgId={(id: string) => setDevice(d => ({ ...d, orgUnitId: id }))}
            />

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
                <Playlist
                    items={playlist}
                    mode={device.currentMode || 'slideshow'}
                    onRemove={(i) => setPlaylist(p => p.filter((_, idx) => idx !== i))}
                    onUpdateDuration={(i, v) => setPlaylist(p => p.map((item, idx) => idx === i ? { ...item, duration: parseInt(v) || 5 } : item))}
                    onToggleMute={(i) => setPlaylist(p => p.map((item, idx) => idx === i ? { ...item, isMuted: !item.isMuted } : item))}
                    onDragReorder={handlePlaylistReorder}
                />

                <Library
                    folders={libraryFolders}
                    files={libraryFiles}
                    currentMode={device.currentMode || 'slideshow'}
                    path={currentFolderId}
                    history={folderHistory}
                    onNavigate={(f) => { setFolderHistory(h => [...h, { id: f._id, name: f.name }]); setCurrentFolderId(f._id); }}
                    onBack={() => {
                        if (!folderHistory.length) return;
                        const newHist = [...folderHistory];
                        newHist.pop();
                        setFolderHistory(newHist);
                        setCurrentFolderId(newHist.length ? newHist[newHist.length - 1].id : 'root');
                    }}
                    onRoot={() => { setFolderHistory([]); setCurrentFolderId('root'); }}
                    onAdd={handleAddToPlaylist}
                    onUpload={handleFileUpload}
                    isUploading={isUploading}
                />
            </div>
        </div>
    );
}
