'use client';
import { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

export const EmergencyButton = () => {
    const [status, setStatus] = useState<'off' | 'fire' | 'drone'>('off');
    const [confirmingMode, setConfirmingMode] = useState<'fire' | 'drone' | null>(null);
    const [loading, setLoading] = useState(false);

    const requestActivation = (mode: 'fire' | 'drone') => {
        setConfirmingMode(mode);
    };

    const confirmActivation = async () => {
        if (!confirmingMode) return;

        const modeToActivate = confirmingMode;
        setLoading(true);

        try {
            await fetch('/api/control/emergency', {
                method: 'POST',
                body: JSON.stringify({
                    active: true,
                    mode: modeToActivate
                })
            });
            setStatus(modeToActivate);
        } catch (e) {
            console.error(e);
            alert('Не удалось запустить тревогу');
        } finally {
            setLoading(false);
            setConfirmingMode(null);
        }
    };

    const deactivate = async () => {
        setLoading(true);
        try {
            await fetch('/api/control/emergency', {
                method: 'POST',
                body: JSON.stringify({ active: false })
            });
            setStatus('off');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (confirmingMode) {
        return (
            <div className="bg-black/50 border border-red-500/50 p-6 rounded-xl animate-in zoom-in duration-200">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">
                        ПОДТВЕРДИТЕ ЗАПУСК
                    </h3>
                    <p className="text-sm text-gray-300">
                        Вы действительно хотите объявить
                        <span className="text-red-500 font-bold uppercase mx-1">
                            {confirmingMode === 'fire' ? 'ПОЖАРНУЮ ТРЕВОГУ' : 'АТАКУ БПЛА'}
                        </span>
                        в вашем секторе?
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        onClick={() => setConfirmingMode(null)}
                        variant="ghost"
                        className="border border-white/10 hover:bg-white/10"
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmActivation}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <><Check size={18} className="mr-2"/> ПОДТВЕРДИТЬ</>}
                    </Button>
                </div>
            </div>
        );
    }

    if (status !== 'off') {
        return (
            <div className={`p-6 rounded-xl border flex flex-col items-center gap-4 text-center animate-pulse
                ${status === 'fire' ? 'bg-red-900/30 border-red-500' : 'bg-orange-900/30 border-orange-500'}
            `}>
                <h3 className={`text-2xl font-bold uppercase ${status === 'fire' ? 'text-red-500' : 'text-orange-500'}`}>
                    {status === 'fire' ? 'ПОЖАРНАЯ ТРЕВОГА' : 'АТАКА БПЛА'} АКТИВНА
                </h3>
                <p className="text-gray-400 text-sm">Оповещение транслируется на подконтрольные экраны.</p>

                <Button
                    variant="outline"
                    size="lg"
                    className="w-full bg-black/50 border-white/20 hover:bg-white/10 text-white"
                    onClick={deactivate}
                    disabled={loading}
                >
                    <X className="mr-2"/> ОТКЛЮЧИТЬ ТРЕВОГУ
                </Button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            <button
                onClick={() => requestActivation('fire')}
                disabled={loading}
                className="flex flex-col items-center justify-center p-6 bg-red-900/10 border border-red-900/30 hover:bg-red-900/30 hover:border-red-500 rounded-xl transition-all group"
            >
                <div className="p-3 bg-red-500/10 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>
                <span className="font-bold text-red-500">ПОЖАР / FIRE</span>
                <span className="text-[10px] text-red-400/60 mt-1">Красный код</span>
            </button>

            <button
                onClick={() => requestActivation('drone')}
                disabled={loading}
                className="flex flex-col items-center justify-center p-6 bg-orange-900/10 border border-orange-900/30 hover:bg-orange-900/30 hover:border-orange-500 rounded-xl transition-all group"
            >
                <div className="p-3 bg-orange-500/10 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <ShieldAlert size={32} className="text-orange-500" />
                </div>
                <span className="font-bold text-orange-500">БПЛА / DRONE</span>
                <span className="text-[10px] text-orange-400/60 mt-1">Оранжевый код</span>
            </button>
        </div>
    );
};
