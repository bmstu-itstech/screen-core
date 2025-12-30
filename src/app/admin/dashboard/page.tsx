'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    Monitor,
    HardDrive,
    AlertCircle,
    Activity,
    CheckCircle2,
    Clock,
    User,
    Shield,
    Upload
} from 'lucide-react';
import { StatCard } from '@/widgets/DashboardStats/ui/StatCard';

interface LogDetails {
    device?: string;
    ip?: string;
    title?: string;
    name?: string;
    updates?: string[];
    [key: string]: unknown;
}

interface ILog {
    _id: string;
    level: 'info' | 'warn' | 'error';
    action: string;
    details: LogDetails;
    actorId: string;
    actorName?: string;
    timestamp: string;
}

interface Device {
    _id: string;
    status: 'online' | 'offline';
    [key: string]: unknown;
}

interface DashboardStats {
    totalScreens: number;
    activeScreens: number;
    totalFiles: number;
    totalSize: string;
    recentLogs: ILog[];
    errorsCount: number;
}

interface ServiceStatus {
    name: string;
    status: 'online' | 'offline';
    ping: string;
}

const FIELD_NAMES: Record<string, string> = {
    name: 'Имя',
    isActive: 'Статус',
    playlist: 'Плейлист',
    currentMode: 'Режим',
    volume: 'Громкость',
    timework: 'Расписание',
    orgUnitId: 'Расположение'
};

const SYSTEM_SERVICES: ServiceStatus[] = [
    { name: 'API Server', status: 'online', ping: '24ms' },
    { name: 'Media CDN', status: 'online', ping: '12ms' },
    { name: 'Message Broker', status: 'online', ping: '4ms' },
    { name: 'Cache (Redis)', status: 'online', ping: '1ms' },
    { name: 'Database', status: 'online', ping: '8ms' },
];

const renderActionIcon = (action: string) => {
    const size = 14;
    if (action.includes('DEVICE')) return <Monitor size={size} />;
    if (action.includes('LOGIN')) return <User size={size} />;
    if (action.includes('MEDIA')) return <Upload size={size} />;
    if (action.includes('EMERGENCY')) return <AlertCircle size={size} />;
    return <Activity size={size} />;
};

const formatLogDetails = (log: ILog): string => {
    const { details, action } = log;
    if (!details) return 'Нет деталей';

    if (action === 'USER_LOGIN') {
        return `Вход с ${details.device || 'Unknown Device'} (${details.ip || 'IP?'})`;
    }

    if (action.includes('MEDIA')) {
        const isDelete = action.includes('DELETE');
        return `${isDelete ? 'Удален' : 'Загружен'}: ${details.title || 'Unknown File'}`;
    }

    if (action === 'DEVICE_UPDATE' && details.updates) {
        const updates = Array.isArray(details.updates)
            ? details.updates.map((u) => FIELD_NAMES[u] || u).join(', ')
            : 'Параметры';
        return `Изменено: ${updates}`;
    }

    if (action.includes('DEVICE') && details.name) {
        return `Экран: ${details.name}`;
    }

    return 'Системное событие';
};

const useDashboardData = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalScreens: 0,
        activeScreens: 0,
        totalFiles: 0,
        totalSize: '0 MB',
        recentLogs: [],
        errorsCount: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [devicesRes, mediaRes, logsRes] = await Promise.all([
                    fetch('/api/devices'),
                    fetch('/api/media'),
                    fetch('/api/logs?limit=5')
                ]);

                const devices: Device[] = devicesRes.ok ? await devicesRes.json() : [];
                const media: unknown[] = mediaRes.ok ? await mediaRes.json() : [];
                const logsData = logsRes.ok ? await logsRes.json() : {};

                const logs: ILog[] = Array.isArray(logsData) ? logsData : (logsData.data || []);

                const activeCount = devices.filter((d) => d.status === 'online').length;
                const errorsCount = logs.filter((l) => l.level === 'error').length;
                const totalSizeVal = (media.length * 2.5).toFixed(1);

                setStats({
                    totalScreens: devices.length,
                    activeScreens: activeCount,
                    totalFiles: media.length,
                    totalSize: `${totalSizeVal} MB`,
                    recentLogs: logs,
                    errorsCount
                });
            } catch (error) {
                console.error("Dashboard data fetch failed", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { loading, stats };
};

const ServiceStatusRow = ({ name, status, ping }: ServiceStatus) => (
    <div className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
            <div className={`
                flex items-center justify-center w-6 h-6 rounded-full 
                ${status === 'online' ? 'bg-green-500/20 text-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500/10 text-red-500'}
            `}>
                <CheckCircle2 size={12} />
            </div>
            <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {name}
            </p>
        </div>
        <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 group-hover:border-white/10 transition-colors">
            {ping}
        </span>
    </div>
);

const LogItem = ({ log }: { log: ILog }) => {
    const detailsText = useMemo(() => formatLogDetails(log), [log]);

    const colorClass = log.level === 'error' ? 'bg-red-500/10 text-red-500' :
        log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-500' :
            'bg-blue-500/10 text-blue-500';

    return (
        <div className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors group">
            <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/5
                ${colorClass}
            `}>
                {renderActionIcon(log.action)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">{log.action}</p>
                    <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 rounded">
                        {log.actorName || (log.actorId === 'system' ? 'System' : 'User')}
                    </span>
                </div>
                <p className="text-gray-400 text-xs truncate mt-0.5">
                    {detailsText}
                </p>
            </div>

            <div className="text-right shrink-0">
                <p className="text-gray-500 text-xs flex items-center gap-1 font-mono">
                    <Clock size={10} />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
};

const ActivityWidget = ({ logs }: { logs: ILog[] }) => (
    <div className="xl:col-span-2 bg-[#0A0A0A] rounded-xl border border-gray-800 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-white/5">
            <h2 className="text-lg font-bold text-white">Последняя активность</h2>
        </div>
        <div className="flex-1 overflow-y-auto max-h-100 custom-scrollbar p-2">
            {logs.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {logs.map((log) => <LogItem key={log._id} log={log} />)}
                </div>
            ) : (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                    <Activity size={32} className="mb-2 opacity-20" />
                    Журнал событий пуст
                </div>
            )}
        </div>
    </div>
);

const SystemHealthWidget = () => (
    <div className="bg-[#0A0A0A] rounded-xl border border-gray-800 p-6 h-fit">
        <h2 className="text-lg font-bold text-white mb-6">Статус сервисов</h2>
        <div className="space-y-5">
            {SYSTEM_SERVICES.map((service) => (
                <ServiceStatusRow key={service.name} {...service} />
            ))}
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-blue-400 font-bold text-xs uppercase mb-1 flex items-center gap-2">
                    <Shield size={12} /> Версия системы
                </h4>
                <p className="text-gray-400 text-xs">ScreenCore v0.5.2 (Beta)</p>
            </div>
        </div>
    </div>
);

const StatsGrid = ({ stats }: { stats: DashboardStats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Всего экранов" value={stats.totalScreens} icon={Monitor} color="blue" />
        <StatCard title="Активные экраны" value={stats.activeScreens} icon={Activity} color="green" />
        <StatCard title="Файлы" value={stats.totalFiles} icon={HardDrive} color="purple" trend={stats.totalSize} />
        <StatCard title="Ошибки" value={stats.errorsCount} icon={AlertCircle} color="red" />
    </div>
);

const DashboardSkeleton = () => (
    <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-gray-800 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-900 border border-gray-800 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 h-96 bg-gray-900 border border-gray-800 rounded-xl" />
            <div className="h-96 bg-gray-900 border border-gray-800 rounded-xl" />
        </div>
    </div>
);

export default function DashboardPage() {
    const { loading, stats } = useDashboardData();

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Обзор системы</h1>
                <p className="text-gray-400 mt-1">Сводка состояния сети</p>
            </div>

            <StatsGrid stats={stats} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <ActivityWidget logs={stats.recentLogs} />
                <SystemHealthWidget />
            </div>
        </div>
    );
}
