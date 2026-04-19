'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, X, Tv } from 'lucide-react';
import { DeviceCard } from '@/entities/device/ui/DeviceCard';
import { EmergencyButton } from '@/features/EmergencyAlert/ui/EmergencyButton';
import { Button } from '@/shared/ui/Button';
import { useSocket } from '@/shared/lib/hooks/useSocket';

type DeviceStatus = 'online' | 'offline';

interface Device {
    uid: string;
    name: string;
    isActive: boolean;
    status: DeviceStatus;
    orgUnitId?: string;
    currentMode?: string;
    latency?: number | null;
}

interface SocketMessagePayload {
    uid: string;
    status: DeviceStatus;
    latency?: number;
}

const WS_URL = `wss://${typeof window !== 'undefined' ? window.location.host : ''}/ws`;

function useDevicesList() {
    const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
    const [loading, setLoading] = useState(true);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await fetch('/api/devices', { cache: 'no-store' });
            if (res.ok) {
                const data: Device[] = await res.json();
                setDevicesMap(new Map(data.map(d => [d.uid, d])));
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateDeviceStatus = useCallback((payload: SocketMessagePayload) => {
        setDevicesMap(prev => {
            const device = prev.get(payload.uid);
            if (!device) return prev;

            if (device.status === payload.status && device.latency === payload.latency) {
                return prev;
            }

            const newMap = new Map(prev);
            newMap.set(payload.uid, {
                ...device,
                status: payload.status,
                latency: payload.status === 'offline' ? null : (payload.latency ?? device.latency)
            });
            return newMap;
        });
    }, []);

    const toggleDevice = useCallback(async (uid: string, currentState: boolean) => {
        setDevicesMap(prev => {
            const device = prev.get(uid);
            if (!device) return prev;
            const newMap = new Map(prev);
            newMap.set(uid, { ...device, isActive: !currentState });
            return newMap;
        });

        try {
            await fetch(`/api/devices/${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentState })
            });
        } catch (e) {
            console.error('Toggle error:', e);
            fetchDevices();
        }
    }, [fetchDevices]);

    const removeDevice = useCallback(async (uid: string) => {
        if (!confirm('Вы уверены?')) return;

        setDevicesMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(uid);
            return newMap;
        });

        try {
            await fetch(`/api/devices/${uid}`, { method: 'DELETE' });
        } catch (e) {
            console.error('Delete error:', e);
            fetchDevices();
        }
    }, [fetchDevices]);

    return {
        devices: Array.from(devicesMap.values()),
        loading,
        fetchDevices,
        updateDeviceStatus,
        toggleDevice,
        removeDevice
    };
}

function usePairingCode() {
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateCode = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/codes/generate', { method: 'POST' });
            const data = await res.json();
            setPairingCode(data.code);
        } catch {
            alert('Ошибка генерации кода');
        } finally {
            setIsGenerating(false);
        }
    };

    return { pairingCode, isGenerating, generateCode, clearCode: () => setPairingCode(null) };
}

export default function DisplaysPage() {
    const router = useRouter();
    const {
        devices,
        loading,
        fetchDevices,
        updateDeviceStatus,
        toggleDevice,
        removeDevice
    } = useDevicesList();

    const {
        pairingCode,
        isGenerating,
        generateCode,
        clearCode
    } = usePairingCode();

    const handleSocketMessage = useCallback((msg: { type: string, payload?: any }) => {
        if (msg.type === 'DEVICE_STATUS' && msg.payload) {
            updateDeviceStatus(msg.payload);
        }
    }, [updateDeviceStatus]);

    const { send, isConnected } = useSocket(WS_URL, handleSocketMessage);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    useEffect(() => {
        if (isConnected) {
            send({ type: 'admin-auth' });
        }
    }, [isConnected, send]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Экраны</h1>
                    <p className="text-gray-400 mt-1 text-sm">Мониторинг сети</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={fetchDevices}
                        disabled={loading}
                        className="glass-button text-gray-400 hover:text-white"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button
                        variant="primary"
                        onClick={generateCode}
                        disabled={isGenerating}
                        className="shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-500/50"
                    >
                        {isGenerating ? (
                            <RefreshCw className="animate-spin mr-2" size={18} />
                        ) : (
                            <Plus size={18} className="mr-2" />
                        )}
                        Добавить экран
                    </Button>
                </div>
            </div>

            {pairingCode && (
                <div className="relative overflow-hidden bg-blue-600/10 border border-blue-500/30 p-6 rounded-2xl flex flex-col items-center justify-center animate-in slide-in-from-top-4 duration-500">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                    <button
                        onClick={clearCode}
                        className="absolute top-4 right-4 text-blue-300 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                    <span className="text-blue-200 text-sm font-medium mb-3 uppercase tracking-wider">
                        Код подключения
                    </span>
                    <div className="flex items-center gap-4">
                        <span className="text-6xl font-mono font-bold text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                            {pairingCode}
                        </span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {devices.map(device => (
                    <DeviceCard
                        key={device.uid}
                        device={device}
                        onEdit={(uid) => router.push(`/admin/displays/${uid}`)}
                        onToggle={toggleDevice}
                        onDelete={removeDevice}
                    />
                ))}

                {!loading && devices.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
                        <Tv size={48} className="mb-4 opacity-20" />
                        <p>Нет подключенных устройств</p>
                    </div>
                )}
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <h2 className="text-lg font-bold text-white mb-2">Экстренное оповещение</h2>
                        <p className="text-sm text-gray-500">
                            Сигнал тревоги будет отправлен на все активные устройства немедленно.
                        </p>
                    </div>
                    <div className="lg:col-span-2">
                        <EmergencyButton />
                    </div>
                </div>
            </div>
        </div>
    );
}
