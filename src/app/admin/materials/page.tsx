'use client';

import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import {
    Folder, Trash2, Edit2, Upload, FolderPlus,
    ChevronRight, Home, ArrowLeft, Calendar,
    HardDrive, FileVideo, type LucideIcon
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

type FileSystemType = 'file' | 'folder';

interface IBaseEntity {
    _id: string;
    createdAt?: string;
    updatedAt?: string;
}

interface IFile extends IBaseEntity {
    title: string;
    filename: string;
    type: 'image' | 'video';
    folderId: string;
}

interface IFolder extends IBaseEntity {
    name: string;
    parentId: string;
}

interface IHistoryItem {
    id: string;
    name: string;
}

interface RenameTarget {
    id: string;
    name: string;
    type: FileSystemType;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
});

const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
        return dateFormatter.format(new Date(dateStr));
    } catch {
        return 'Invalid Date';
    }
};

const stringCollator = new Intl.Collator('ru-RU', { numeric: true, sensitivity: 'base' });

const apiClient = async <T,>(url: string, options: RequestInit = {}): Promise<T | null> => {
    const isFormData = options.body instanceof FormData;

    const headers: HeadersInit = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
    };

    try {
        const res = await fetch(url, {
            ...options,
            headers,
        });

        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);

        return res.status !== 204 ? await res.json() : null;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
};

const useFolderNavigation = () => {
    const [currentId, setCurrentId] = useState<string>('root');
    const [history, setHistory] = useState<IHistoryItem[]>([]);

    const navigateTo = useCallback((folder: IFolder) => {
        setHistory(prev => [...prev, { id: folder._id, name: folder.name }]);
        setCurrentId(folder._id);
    }, []);

    const goBack = useCallback(() => {
        if (history.length === 0) return;
        setHistory(prev => {
            const newHistory = prev.slice(0, -1);
            setCurrentId(newHistory.length > 0 ? newHistory[newHistory.length - 1].id : 'root');
            return newHistory;
        });
    }, [history]);

    const goToRoot = useCallback(() => {
        setHistory([]);
        setCurrentId('root');
    }, []);

    return { currentId, history, navigateTo, goBack, goToRoot };
};

const useFileSystem = (currentFolderId: string) => {
    const [folders, setFolders] = useState<IFolder[]>([]);
    const [files, setFiles] = useState<IFile[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const [resFolders, resFiles] = await Promise.all([
                apiClient<IFolder[]>(`/api/folders?parentId=${currentFolderId}`, { signal }),
                apiClient<IFile[]>(`/api/media?folderId=${currentFolderId}`, { signal })
            ]);

            if (!signal?.aborted) {
                setFolders(resFolders || []);
                setFiles(resFiles || []);
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error(error);
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [currentFolderId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [currentFolderId, fetchData]);

    const refresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    const createFolder = async (name: string) => {
        if (!name.trim()) return;
        await apiClient('/api/folders', {
            method: 'POST',
            body: JSON.stringify({ name, parentId: currentFolderId })
        });
        refresh();
    };

    const deleteItem = async (id: string, type: FileSystemType) => {
        const endpoint = type === 'folder' ? '/api/folders' : '/api/media';
        await apiClient(endpoint, {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        refresh();
    };

    const renameItem = async (id: string, newName: string, type: FileSystemType) => {
        if (type === 'file') {
            await apiClient('/api/media/rename', {
                method: 'POST',
                body: JSON.stringify({ id, newTitle: newName })
            });
            refresh();
        }
    };

    const uploadFile = async (file: File) => {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', currentFolderId);

        await apiClient('/api/media/upload', {
            method: 'POST',
            body: formData
        });
        refresh();
    };

    const sortedFolders = useMemo(() =>
            [...folders].sort((a, b) => stringCollator.compare(a.name, b.name)),
        [folders]);

    const sortedFiles = useMemo(() =>
            [...files].sort((a, b) => stringCollator.compare(a.title, b.title)),
        [files]);

    return {
        folders: sortedFolders,
        files: sortedFiles,
        loading,
        createFolder,
        deleteItem,
        renameItem,
        uploadFile
    };
};

const GridRow = ({
                     children,
                     className = '',
                     onClick,
                     onDoubleClick
                 }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    onDoubleClick?: () => void;
}) => (
    <div
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`grid grid-cols-12 gap-4 p-3 border-b border-white/5 items-center hover:bg-white/5 transition group ${className}`}
    >
        {children}
    </div>
);

const IconButton = ({
                        icon: Icon,
                        onClick,
                        variant = 'default'
                    }: {
    icon: LucideIcon;
    onClick: (e: React.MouseEvent) => void;
    variant?: 'default' | 'danger';
}) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`p-2 rounded-lg transition ${
            variant === 'danger'
                ? 'text-gray-400 hover:text-red-500 hover:bg-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
    >
        <Icon size={16} />
    </button>
);

const Breadcrumbs = memo(({
                              history,
                              onRootClick,
                              currentId
                          }: {
    history: IHistoryItem[];
    onRootClick: () => void;
    currentId: string;
}) => (
    <nav className="flex items-center gap-2 text-sm overflow-hidden" aria-label="Breadcrumb">
        <button
            onClick={onRootClick}
            className={`flex items-center gap-1 hover:text-white transition ${currentId === 'root' ? 'text-blue-400 font-bold' : 'text-gray-400'}`}
        >
            <Home size={16} /> Home
        </button>
        {history.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 text-gray-400 whitespace-nowrap">
                <ChevronRight size={14} />
                <span className={idx === history.length - 1 ? 'text-white font-bold' : ''}>
                    {item.name}
                </span>
            </div>
        ))}
    </nav>
));
Breadcrumbs.displayName = 'Breadcrumbs';

const FileIconPreview = ({ file }: { file: IFile }) => {
    const isVideo = file.type === 'video';

    return (
        <div className="w-8 h-8 rounded bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
            {isVideo ? (
                <>
                    <video src={`/static/${file.filename}#t=1.0`} className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FileVideo size={12} className="text-white"/>
                    </div>
                </>
            ) : (
                <img src={`/static/${file.filename}`} alt="" className="w-full h-full object-cover" />
            )}
        </div>
    );
};

const FolderRow = memo(({
                            folder,
                            onNavigate,
                            onDelete
                        }: {
    folder: IFolder;
    onNavigate: (f: IFolder) => void;
    onDelete: (id: string) => void;
}) => (
    <GridRow onDoubleClick={() => onNavigate(folder)} className="cursor-pointer">
        <div className="col-span-6 md:col-span-5 flex items-center gap-3 pl-2 min-w-0">
            <Folder size={20} className="text-blue-400 fill-blue-400/20 shrink-0" />
            <span className="text-sm font-medium text-white truncate">{folder.name}</span>
        </div>
        <div className="col-span-3 hidden md:block text-xs text-gray-500 font-mono">
            {formatDate(folder.updatedAt || folder.createdAt)}
        </div>
        <div className="col-span-3 hidden md:block">
            <span className="text-[10px] uppercase px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
                Папка
            </span>
        </div>
        <div className="col-span-6 md:col-span-1 flex justify-end pr-2 opacity-0 group-hover:opacity-100 transition">
            <IconButton icon={Trash2} onClick={() => onDelete(folder._id)} variant="danger" />
        </div>
    </GridRow>
));
FolderRow.displayName = 'FolderRow';

const FileRow = memo(({
                          file,
                          onRename,
                          onDelete
                      }: {
    file: IFile;
    onRename: (file: IFile) => void;
    onDelete: (id: string) => void;
}) => {
    const isVideo = file.type === 'video';
    const badgeStyle = isVideo
        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        : 'bg-green-500/10 text-green-400 border-green-500/20';

    return (
        <GridRow>
            <div className="col-span-6 md:col-span-5 flex items-center gap-3 pl-2 min-w-0">
                <FileIconPreview file={file} />
                <span className="text-sm text-gray-200 truncate">{file.title}</span>
            </div>
            <div className="col-span-3 hidden md:block text-xs text-gray-500 font-mono">
                {formatDate(file.updatedAt || file.createdAt)}
            </div>
            <div className="col-span-3 hidden md:block">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${badgeStyle}`}>
                    {isVideo ? 'Видео' : 'Фото'}
                </span>
            </div>
            <div className="col-span-6 md:col-span-1 flex justify-end gap-1 pr-2 opacity-0 group-hover:opacity-100 transition">
                <IconButton icon={Edit2} onClick={() => onRename(file)} />
                <IconButton icon={Trash2} onClick={() => onDelete(file._id)} variant="danger" />
            </div>
        </GridRow>
    );
});
FileRow.displayName = 'FileRow';

const CreateFolderModal = ({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}) => {
    const [name, setName] = useState('');

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (name.trim()) {
            onSubmit(name);
            onClose();
            setName('');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Новая папка">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    className="w-full bg-black border border-gray-700 p-3 rounded-lg text-white focus:border-blue-500 outline-none"
                    placeholder="Название папки"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                />
                <Button type="submit" className="w-full">Создать</Button>
            </form>
        </Modal>
    );
};

const RenameForm = ({ target, onSubmit, onClose }: {
    target: RenameTarget;
    onSubmit: (id: string, name: string, type: FileSystemType) => void;
    onClose: () => void;
}) => {
    const [name, setName] = useState(target.name);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && name !== target.name) {
            onSubmit(target.id, name, target.type);
        }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input
                className="w-full bg-black border border-gray-700 p-3 rounded-lg text-white focus:border-blue-500 outline-none"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
            />
            <Button type="submit" className="w-full">Сохранить</Button>
        </form>
    );
};

export default function MaterialsPage() {
    const { currentId, history, navigateTo, goBack, goToRoot } = useFolderNavigation();
    const { folders, files, loading, createFolder, deleteItem, renameItem, uploadFile } = useFileSystem(currentId);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDelete = useCallback((id: string, type: FileSystemType) => {
        if (window.confirm(`Удалить ${type === 'folder' ? 'папку и всё содержимое' : 'файл'}?`)) {
            deleteItem(id, type);
        }
    }, [deleteItem]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
            e.target.value = '';
        }
    };

    const isEmpty = folders.length === 0 && files.length === 0;

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 animate-in fade-in duration-500">
            <header className="glass-panel p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 sticky top-0 z-20 backdrop-blur-md">
                <Breadcrumbs history={history} currentId={currentId} onRootClick={goToRoot} />

                <div className="flex gap-2">
                    {currentId !== 'root' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goBack}
                            className="bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:bg-white/10"
                        >
                            <ArrowLeft size={16} className="mr-2"/> Назад
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:bg-white/10"
                    >
                        <FolderPlus size={16} className="mr-2" /> Папка
                    </Button>

                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="shadow-blue-500/30 shadow-lg hover:shadow-blue-500/50 border border-blue-500/50"
                    >
                        <Upload size={16} className="mr-2" /> {loading ? '...' : 'Загрузить'}
                    </Button>
                </div>
            </header>

            <main className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-6 md:col-span-5 pl-2">Название</div>
                    <div className="col-span-3 hidden md:block flex items-center gap-1"><Calendar size={12} className="inline mr-1"/> Дата</div>
                    <div className="col-span-3 hidden md:block flex items-center gap-1"><HardDrive size={12} className="inline mr-1"/> Тип</div>
                    <div className="col-span-6 md:col-span-1 text-right pr-2">Действия</div>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {isEmpty && !loading && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <FolderPlus size={48} className="mb-4 opacity-20" />
                            <p>Эта папка пуста</p>
                        </div>
                    )}

                    {folders.map(folder => (
                        <FolderRow
                            key={folder._id}
                            folder={folder}
                            onNavigate={navigateTo}
                            onDelete={(id) => handleDelete(id, 'folder')}
                        />
                    ))}

                    {files.map(file => (
                        <FileRow
                            key={file._id}
                            file={file}
                            onRename={(f) => setRenameTarget({ id: f._id, name: f.title, type: 'file' })}
                            onDelete={(id) => handleDelete(id, 'file')}
                        />
                    ))}
                </div>
            </main>

            <CreateFolderModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSubmit={createFolder}
            />

            <Modal isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title="Переименовать">
                {renameTarget && (
                    <RenameForm
                        key={renameTarget.id}
                        target={renameTarget}
                        onClose={() => setRenameTarget(null)}
                        onSubmit={renameItem}
                    />
                )}
            </Modal>
        </div>
    );
}
