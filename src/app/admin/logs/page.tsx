'use client';

import { useCallback, useEffect, useRef, useState, useMemo, memo } from 'react';
import {
    Search, Filter, RefreshCw, AlertTriangle, Info, User, Monitor,
    Shield, FileText, Upload, Trash2, Smartphone, Loader2
} from 'lucide-react';

interface ILogDetails {
    device?: string;
    ip?: string;
    title?: string;
    type?: string;
    updates?: string[];
    uid?: string;
    name?: string;
    code?: string;
    req?: any;
    [key: string]: any;
}

interface ILog {
    _id: string;
    level: 'info' | 'warn' | 'error';
    action: string;
    details: ILogDetails;
    actorId: string;
    actorName?: string;
    timestamp: string;
    orgUnitId?: { name: string } | string;
}

const ACTION_OPTIONS = [
    { value: 'ALL', label: 'Все события' },
    { value: 'USER_LOGIN', label: 'Вход в систему' },
    { value: 'DEVICE_ADD', label: 'Добавление экрана' },
    { value: 'DEVICE_UPDATE', label: 'Настройка экрана' },
    { value: 'MEDIA_UPLOAD', label: 'Загрузка файла' },
    { value: 'MEDIA_DELETE', label: 'Удаление файла' },
    { value: 'USER_CREATE', label: 'Создание админа' },
    { value: 'EMERGENCY_STARTED', label: 'Тревога' },
];

const FIELD_LABELS: Record<string, string> = {
    name: 'Имя',
    isActive: 'Статус (Вкл/Выкл)',
    playlist: 'Плейлист',
    currentMode: 'Режим',
    volume: 'Громкость',
    timework: 'Расписание',
    orgUnitId: 'Расположение'
};

const LEVEL_STYLES = {
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    warn: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    default: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
};

const formatDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return {
            date: new Intl.DateTimeFormat('ru-RU').format(date),
            time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
        };
    } catch (e) {
        return { date: '-', time: '-' };
    }
};

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const ActionIcon = memo(({ action }: { action: string }) => {
    if (action.includes('DEVICE')) return <Monitor size={16} />;
    if (action.includes('LOGIN')) return <User size={16} />;
    if (action.includes('MEDIA_UPLOAD')) return <Upload size={16} />;
    if (action.includes('MEDIA_DELETE')) return <Trash2 size={16} />;
    if (action.includes('EMERGENCY')) return <AlertTriangle size={16} className="text-red-500" />;
    return <Info size={16} />;
});
ActionIcon.displayName = 'ActionIcon';

const DetailsLogin = ({ details }: { details: ILogDetails }) => (
    <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-1 rounded text-gray-300 border border-gray-700">
            <Smartphone size={12} />
            <span>{details.device}</span>
        </div>
        <span className="text-gray-500 text-[10px] font-mono">{details.ip}</span>
    </div>
);

const DetailsMedia = ({ details }: { details: ILogDetails }) => (
    <div className="flex items-center gap-2">
        <span className="text-gray-400">Файл:</span>
        <span className="text-white font-medium bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            {details.title}
        </span>
        {details.type && <span className="text-[10px] text-gray-500 uppercase font-mono">{details.type}</span>}
    </div>
);

const DetailsDeviceUpdate = ({ details }: { details: ILogDetails }) => (
    <div className="flex flex-col gap-1.5 items-start">
        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
            UID: {details.uid}
        </div>
        <div className="flex flex-wrap gap-1.5">
            <span className="text-gray-400 text-xs py-0.5">Изменено:</span>
            {Array.isArray(details.updates) && details.updates.map((field) => (
                <span key={field} className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {FIELD_LABELS[field] || field}
                </span>
            ))}
        </div>
    </div>
);

const DetailsDeviceLifecycle = ({ details }: { details: ILogDetails }) => (
    <div className="flex items-center gap-2">
        <span className="text-white font-medium">{details.name}</span>
        <span className="text-gray-600 text-[10px] font-mono">({details.uid})</span>
        {details.code && (
            <span className="bg-yellow-900/30 text-yellow-500 px-1.5 rounded font-mono text-xs">
                Code: {details.code}
            </span>
        )}
    </div>
);

const DetailsFallback = ({ details }: { details: ILogDetails }) => (
    <span title={JSON.stringify(details)} className="text-gray-400">
        {Object.entries(details || {})
            .filter(([k]) => k !== 'req')
            .map(([k, v]) => {
                const val = typeof v === 'object' ? '...' : v;
                return `${k}: ${val}`;
            })
            .join(' | ')}
    </span>
);

const LogDetailsRenderer = memo(({ action, details }: { action: string, details: ILogDetails }) => {
    if (!details) return <span className="text-gray-600">-</span>;
    if (action === 'USER_LOGIN' && details.device) return <DetailsLogin details={details} />;
    if (action.includes('MEDIA')) return <DetailsMedia details={details} />;
    if (action === 'DEVICE_UPDATE' && details.updates) return <DetailsDeviceUpdate details={details} />;
    if (action.includes('DEVICE') && details.name) return <DetailsDeviceLifecycle details={details} />;
    return <DetailsFallback details={details} />;
});
LogDetailsRenderer.displayName = 'LogDetailsRenderer';

const LogRow = memo(({ log }: { log: ILog }) => {
    const { date, time } = useMemo(() => formatDate(log.timestamp), [log.timestamp]);
    const levelStyle = LEVEL_STYLES[log.level] || LEVEL_STYLES.default;

    return (
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800/50 hover:bg-white/5 transition-colors items-center text-sm">
            <div className="col-span-3 lg:col-span-2 text-gray-400 font-mono text-xs flex flex-col">
                <span>{date}</span>
                <span className="text-gray-600">{time}</span>
            </div>

            <div className="col-span-2 lg:col-span-1">
                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${levelStyle}`}>
                    {log.level}
                </span>
            </div>

            <div className="col-span-3 lg:col-span-2 flex items-center gap-2 font-medium text-white truncate">
                <div className="p-1.5 bg-gray-800 rounded text-gray-400">
                    <ActionIcon action={log.action} />
                </div>
                <span className="truncate" title={log.action}>{log.action}</span>
            </div>

            <div className="col-span-4 lg:col-span-5 text-gray-400 text-xs">
                {log.orgUnitId && typeof log.orgUnitId === 'object' && (
                    <div className="mb-1">
                        <span className="text-blue-400 bg-blue-900/20 border border-blue-900/30 px-1.5 py-0.5 rounded text-[10px]">
                            @{log.orgUnitId.name}
                        </span>
                    </div>
                )}
                <LogDetailsRenderer action={log.action} details={log.details} />
            </div>

            <div className="col-span-2 lg:col-span-2 text-right">
                <div className="inline-flex flex-col items-end">
                    <span className="text-white font-medium text-xs">
                        {log.actorName || (log.actorId === 'system' ? 'System' : 'Unknown')}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono" title={log.actorId}>
                        {log.actorId.slice(0, 6)}...
                    </span>
                </div>
            </div>
        </div>
    );
});
LogRow.displayName = 'LogRow';

export default function LogsPage() {
    const [logs, setLogs] = useState<ILog[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [selectedAction, setSelectedAction] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const observerTarget = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const debouncedSearch = useDebounce(searchQuery, 500);

    const fetchLogs = useCallback(async (pageNum: number, isReset: boolean, filters: { action: string, search: string }) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);

        const params = new URLSearchParams({
            page: pageNum.toString(),
            limit: '30'
        });

        if (filters.action !== 'ALL') params.append('action', filters.action);
        if (filters.search) params.append('search', filters.search);

        try {
            const res = await fetch(`/api/logs?${params.toString()}`, {
                signal: controller.signal
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`API Error: ${res.status}`, errorText);
                setHasMore(false);
                return;
            }

            const { data, hasMore: moreAvailable } = await res.json();

            setLogs(prev => {
                if (isReset) return data;
                const prevIds = new Set(prev.map(l => l._id));
                const newUnique = data.filter((l: ILog) => !prevIds.has(l._id));
                return [...prev, ...newUnique];
            });
            setHasMore(moreAvailable);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Fetch error:', error);
        } finally {
            if (controller.signal.aborted) return;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchLogs(1, true, { action: selectedAction, search: debouncedSearch });
    }, [selectedAction, debouncedSearch, fetchLogs]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    setPage(prevPage => {
                        const nextPage = prevPage + 1;
                        fetchLogs(nextPage, false, { action: selectedAction, search: debouncedSearch });
                        return nextPage;
                    });
                }
            },
            { threshold: 1.0 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) observer.observe(currentTarget);

        return () => {
            if (currentTarget) observer.unobserve(currentTarget);
        };
    }, [hasMore, loading, fetchLogs, selectedAction, debouncedSearch]);

    const handleRefresh = () => {
        setPage(1);
        fetchLogs(1, true, { action: selectedAction, search: debouncedSearch });
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Shield className="text-blue-500" /> Журнал аудита
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">История изменений и безопасности</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-white transition-colors" size={16} />
                        <input
                            placeholder="Поиск по пользователю или событию..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full md:w-64 bg-black border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="relative">
                        <select
                            value={selectedAction}
                            onChange={e => setSelectedAction(e.target.value)}
                            className="appearance-none bg-black border border-gray-800 text-white text-sm rounded-lg pl-4 pr-10 py-2 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-900 transition-colors"
                        >
                            {ACTION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" size={16} />
                    </div>

                    <button
                        onClick={handleRefresh}
                        className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95"
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#0A0A0A] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 bg-black/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-3 lg:col-span-2">Время</div>
                    <div className="col-span-2 lg:col-span-1">Уровень</div>
                    <div className="col-span-3 lg:col-span-2">Событие</div>
                    <div className="col-span-4 lg:col-span-5">Детали</div>
                    <div className="col-span-2 lg:col-span-2 text-right">Пользователь</div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {logs.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Событий не найдено</p>
                        </div>
                    )}

                    {logs.map((log) => <LogRow key={log._id} log={log} />)}

                    <div ref={observerTarget} className="flex justify-center p-6 h-16 w-full">
                        {loading && <Loader2 className="animate-spin text-blue-500" />}
                    </div>
                </div>
            </div>
        </div>
    );
}
