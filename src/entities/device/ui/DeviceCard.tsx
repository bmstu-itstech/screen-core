import { Settings, Trash2, Monitor, MoreVertical, Activity } from 'lucide-react';
import { useState } from 'react';

interface Device {
    uid: string;
    name: string;
    isActive: boolean;
    status: 'online' | 'offline';
    currentMode?: string;
    orgUnitId?: string;
    latency?: number | null;
}

interface DeviceCardProps {
    device: Device;
    onEdit: (id: string) => void;
    onToggle: (id: string, state: boolean) => void;
    onDelete: (id: string) => void;
}

export const DeviceCard = ({ device, onEdit, onToggle, onDelete }: DeviceCardProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isConnected = typeof device.latency === 'number';

    let statusDotColor = 'bg-gray-700';
    let statusText = 'Disabled';

    if (device.isActive) {
        if (isConnected) {
            statusDotColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
            statusText = 'В сети';
        } else {
            statusDotColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
            statusText = 'Не в сети';
        }
    }

    let pingColor = 'bg-red-500';
    let pingTextClass = 'text-red-500 font-bold';
    let pingLabel = 'timeout';

    if (isConnected) {
        const ping = device.latency!;
        pingLabel = `${ping}ms`;

        if (ping < 50) {
            pingColor = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
            pingTextClass = 'text-green-400';
        } else if (ping < 150) {
            pingColor = 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]';
            pingTextClass = 'text-yellow-400';
        } else {
            pingColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
            pingTextClass = 'text-red-400';
        }
    } else {
        if (!device.isActive) {
            pingColor = 'bg-gray-600';
            pingTextClass = 'text-gray-500';
            pingLabel = '-';
        }
    }

    return (
        <div className="group relative bg-[#0A0A0A] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col">

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 
                        ${device.isActive && isConnected ? 'bg-blue-600/10 text-blue-500' : 'bg-gray-800/50 text-gray-600'}`}>
                        <Monitor size={24} />
                    </div>

                    <div className="min-w-0">
                        <h3 className="text-white font-bold text-lg leading-tight truncate" title={device.name}>
                            {device.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className={`w-2 h-2 rounded-full ${statusDotColor} transition-all duration-500`} />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                {statusText}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition"
                    >
                        <MoreVertical size={18} />
                    </button>

                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-32 bg-[#111] border border-gray-800 rounded-lg shadow-xl z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={() => onDelete(device.uid)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 transition"
                                >
                                    <Trash2 size={14} /> Удалить
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-white/5 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-600 uppercase mb-0.5">Режим</span>
                    <span className="text-xs text-gray-300 font-medium truncate">
                        {device.currentMode == 'slideshow' ? 'Слайд-шоу' : 'Видео'}
                    </span>
                </div>

                <div className="bg-white/5 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-600 uppercase mb-0.5 flex items-center gap-1">
                        Пинг <Activity size={10} />
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${pingColor}`} />
                        <span className={`text-xs font-mono font-medium ${pingTextClass}`}>
                            {pingLabel}
                        </span>
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-600 uppercase mb-0.5">UID</span>
                    <span className="text-xs text-gray-500 font-mono truncate" title={device.uid}>
                        {device.uid.slice(0, 6)}...
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5 mt-auto">

                <div className="flex items-center gap-3" title={device.isActive ? "Выключить экран" : "Включить экран"}>
                    <button
                        onClick={() => onToggle(device.uid, device.isActive)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${device.isActive ? 'bg-blue-600' : 'bg-gray-800'}`}
                    >
                        <span
                            className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform duration-300 shadow-md ${device.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                    <span className={`text-xs font-bold ${device.isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {device.isActive ? 'ВКЛ' : 'ВЫКЛ'}
                    </span>
                </div>

                <button
                    onClick={() => onEdit(device.uid)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/5 transition-all hover:border-white/20 group"
                >
                    <Settings size={14} className="group-hover:rotate-45 transition-transform duration-300" />
                    Настроить
                </button>
            </div>
        </div>
    );
};
