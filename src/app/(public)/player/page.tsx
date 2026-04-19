'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Ban, EyeOff, ShieldAlert } from 'lucide-react';
import { useSocket } from '@/shared/lib/hooks/useSocket';

interface PlaylistItem {
    duration: number;
    isMuted?: boolean;
    content: {
        title: string;
        type: 'image' | 'video';
    };
}

interface ScreenConfig {
    timework: [number, number];
    playlist: PlaylistItem[];
    volume?: number;
}

type PlayerStatus = 'loading' | 'active' | 'sleeping' | 'emergency';
type EmergencyMode = 'fire' | 'drone';

interface IncomingSocketMessage {
    type: string;
    payload?: unknown;
}

interface ConfigPayload {
    type?: string;
    materials?: PlaylistItem[];
    playlist?: PlaylistItem[];
    timework?: [number, number];
    volume?: number;
}

interface EmergencyPayload {
    active: boolean;
    mode?: EmergencyMode;
}

const getSecondsFromMidnight = (): number => {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
};

const isWorkingTime = (start: number, end: number): boolean => {
    if (start === 0 && end === 86400) return true;
    const current = getSecondsFromMidnight();
    return current >= start && current < end;
};

const GlobalStyles = memo(() => (
    <style jsx global>{`
        @keyframes slide-bg {
            0% { background-position: 0 0; }
            100% { background-position: 56.57px 0; }
        }
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        @keyframes siren-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
            50% { transform: scale(1.1); box-shadow: 0 0 30px 10px rgba(220, 38, 38, 1); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
        @keyframes radar-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-siren { animation: siren-pulse 1.2s infinite ease-in-out; }
        .animate-marquee { animation: marquee 15s linear infinite; }
        .animate-radar { animation: radar-spin 4s linear infinite; }
    `}</style>
));
GlobalStyles.displayName = 'GlobalStyles';

const FireAlarm = memo(() => (
    <div className="fixed inset-0 z-50 bg-[#1a0505] flex flex-col items-center justify-center overflow-hidden font-sans text-white">
        <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #dc2626 0, #dc2626 20px, transparent 20px, transparent 40px)',
                backgroundSize: '56.57px 56.57px',
                animation: 'slide-bg 2s linear infinite'
            }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(220,38,38,0.5)_100%)] animate-pulse z-10" />
        <div className="relative z-20 flex flex-col items-center text-center max-w-5xl w-[90%] p-10 border-4 border-red-600 bg-black/80 backdrop-blur-xl rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.6)] animate-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-6 mb-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full opacity-75" />
                    <div className="relative p-6 bg-red-600 rounded-full animate-siren shadow-lg z-10">
                        <AlertTriangle size={80} className="text-white" strokeWidth={2} />
                    </div>
                </div>
                <div>
                    <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] leading-none">
                        ТРЕВОГА
                    </h1>
                    <h2 className="text-3xl md:text-5xl font-bold text-red-500 uppercase tracking-widest mt-2">
                        ПОЖАР / FIRE ALARM
                    </h2>
                </div>
            </div>
            <div className="w-full bg-red-950/30 border border-red-500/30 rounded-xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex flex-col gap-4 text-left md:text-center">
                    {[
                        { id: 1, text: 'Сохраняйте спокойствие / Keep Calm' },
                        { id: 2, text: 'Покиньте здание через эвакуационные выходы' },
                        { id: 3, text: 'НЕ ПОЛЬЗУЙТЕСЬ ЛИФТОМ / DO NOT USE ELEVATORS', highlight: true }
                    ].map((item) => (
                        <div key={item.id} className="flex items-center gap-4 text-xl md:text-3xl font-medium text-gray-200">
                            <span className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-full text-white font-bold shrink-0">{item.id}</span>
                            <span className={item.highlight ? 'text-red-400 font-bold' : ''}>{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-red-600 flex items-center overflow-hidden z-30 border-t-4 border-white">
            <div className="whitespace-nowrap animate-marquee flex gap-16 font-black text-3xl text-black uppercase pr-16">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex gap-16">
                        <span>Внимание! Пожарная тревога!</span>
                        <span>Attention! Fire Alarm!</span>
                        <span>Покиньте здание!</span>
                        <span>Evacuate immediately!</span>
                        <span>Внимание! Пожарная тревога!</span>
                        <span>Attention! Fire Alarm!</span>
                    </div>
                ))}
            </div>
        </div>
        <GlobalStyles />
    </div>
));
FireAlarm.displayName = 'FireAlarm';

const DroneAlert = memo(() => (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden font-sans text-white">
        <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:40px_40px] opacity-30" />
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(234,88,12,0)_0deg,rgba(234,88,12,0.1)_300deg,rgba(234,88,12,0.4)_360deg)] animate-radar pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(234,88,12,0.3)_100%)] animate-pulse z-10" />

        <div className="relative z-20 flex flex-col items-center text-center max-w-6xl w-[95%] p-8 border-y-4 border-orange-600 bg-black/90 backdrop-blur-xl shadow-[0_0_100px_rgba(234,88,12,0.4)] animate-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-6 mb-10">
                <div className="p-6 border-2 border-orange-500 rounded-full animate-pulse shadow-[0_0_30px_rgba(234,88,12,0.5)]">
                    <ShieldAlert size={80} className="text-orange-500" strokeWidth={1.5} />
                </div>
                <div>
                    <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white leading-none">
                        ВНИМАНИЕ ВСЕМ
                    </h1>
                    <h2 className="text-3xl md:text-5xl font-bold text-orange-500 uppercase tracking-[0.2em] mt-2 animate-pulse">
                        УГРОЗА АТАКИ БПЛА
                    </h2>
                    <p className="text-orange-400/60 text-lg mt-1 font-mono tracking-widest uppercase">
                        /// UAV ATTACK THREAT /// AIR RAID ALERT ///
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {[
                    { Icon: Ban, title: 'Отойдите от окон', desc: 'Move away from windows immediately. Glass fragments are dangerous.' },
                    { Icon: ShieldAlert, title: 'Пройдите в укрытие', desc: 'Go to a shelter, corridor, or bathroom (room without windows).' },
                    { Icon: EyeOff, title: 'Не снимайте', desc: 'Do not film or post drone activity or air defense work online.' }
                ].map((card, idx) => (
                    <div key={idx} className="bg-orange-950/20 border border-orange-500/30 p-6 rounded-lg flex flex-col items-center gap-4 group">
                        <div className="p-4 bg-orange-900/20 rounded-full group-hover:bg-orange-500/20 transition-colors">
                            <card.Icon size={48} className="text-orange-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-white uppercase">{card.title}</h3>
                        <p className="text-gray-400 text-sm">{card.desc}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-orange-600 flex items-center overflow-hidden z-30 border-t-4 border-black">
            <div className="whitespace-nowrap animate-marquee flex gap-10 font-black text-2xl md:text-3xl text-black uppercase">
                {Array.from({ length: 2 }).map((_, i) => (
                    <React.Fragment key={i}>
                        <span>Внимание! Угроза БПЛА!</span><span>Отойдите от окон!</span><span>UAV THREAT!</span><span>Stay away from windows!</span>
                    </React.Fragment>
                ))}
            </div>
        </div>
        <GlobalStyles />
    </div>
));
DroneAlert.displayName = 'DroneAlert';

const LoadingScreen = memo(({ isConnected }: { isConnected: boolean }) => (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-gray-500 font-mono">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>{isConnected ? 'Waiting for content...' : 'Connecting...'}</p>
    </div>
));
LoadingScreen.displayName = 'LoadingScreen';

interface MediaRendererProps {
    item: PlaylistItem;
    nextItem: PlaylistItem | null;
    volume: number;
    hasInteracted: boolean;
    onEnded: () => void;
    onError: () => void;
    playbackId: number;
    onEnableAudio: () => void;
}

const MediaRenderer = ({
                           item,
                           nextItem,
                           volume,
                           hasInteracted,
                           onEnded,
                           onError,
                           playbackId,
                           onEnableAudio
                       }: MediaRendererProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const src = `/static/${item.content.title}`;
    const nextSrc = nextItem?.content.type === 'image' ? `/static/${nextItem.content.title}` : null;
    const shouldForceMute = !hasInteracted || item.isMuted;

    useEffect(() => {
        if (item.content.type === 'video' && videoRef.current) {
            videoRef.current.volume = item.isMuted ? 0 : volume / 100;
            if (hasInteracted && !item.isMuted) {
                videoRef.current.muted = false;
            }
        }
    }, [item, volume, hasInteracted, playbackId]);

    return (
        <div className="fixed inset-0 bg-black overflow-hidden cursor-none" onClick={onEnableAudio}>
            {item.content.type === 'video' ? (
                <video
                    key={`${src}-${playbackId}`}
                    ref={videoRef}
                    src={src}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    muted={shouldForceMute}
                    onEnded={onEnded}
                    onError={onError}
                />
            ) : (
                <img
                    key={`${src}-${playbackId}`}
                    src={src}
                    alt=""
                    className="w-full h-full object-contain animate-in fade-in duration-500"
                />
            )}
            {nextSrc && <link rel="preload" as="image" href={nextSrc} />}
            {!hasInteracted && !item.isMuted && item.content.type === 'video' && (
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs pointer-events-none opacity-50">
                    Click to unmute
                </div>
            )}
        </div>
    );
};

export default function PlayerPage() {
    const router = useRouter();

    const [status, setStatus] = useState<PlayerStatus>('loading');
    const [emergencyMode, setEmergencyMode] = useState<EmergencyMode>('fire');
    const [config, setConfig] = useState<ScreenConfig | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackId, setPlaybackId] = useState(0);
    const [hasInteracted, setHasInteracted] = useState(false);

    const sendRef = useRef<(payload: unknown) => void>(() => {});
    const timeworkInterval = useRef<NodeJS.Timeout | null>(null);

    const playlistLength = config?.playlist?.length ?? 0;

    const updateStatusBasedOnTime = useCallback((timework: [number, number]) => {
        setStatus((prev) => {
            if (prev === 'emergency') return 'emergency';
            return isWorkingTime(timework[0], timework[1]) ? 'active' : 'sleeping';
        });
    }, []);

    const handleConfigUpdate = useCallback((payload: ConfigPayload) => {
        const playlist = payload.materials || payload.playlist || [];
        const timework = payload.timework || [0, 86400];
        const volume = payload.volume ?? 100;

        setConfig({ timework, playlist, volume });
        setCurrentIndex(0);
        setPlaybackId(0);
        updateStatusBasedOnTime(timework);
    }, [updateStatusBasedOnTime]);

    const handleEmergency = useCallback((payload: EmergencyPayload) => {
        const isActive = payload.active;
        if (payload.mode) setEmergencyMode(payload.mode);

        setStatus((prev) => {
            if (isActive) return 'emergency';
            if (prev === 'emergency') {
                return config ? (isWorkingTime(config.timework[0], config.timework[1]) ? 'active' : 'sleeping') : 'loading';
            }
            return prev;
        });
    }, [config, updateStatusBasedOnTime]);

    const handleSocketMessage = useCallback((msg: IncomingSocketMessage) => {
        switch (msg.type) {
            case 'PING':
                sendRef.current({ type: 'PONG', payload: msg.payload });
                break;
            case 'UPDATE': {
                const payload = msg.payload as ConfigPayload;
                if (payload && payload.type === 'REFRESH') {
                    window.location.reload();
                } else if (payload) {
                    handleConfigUpdate(payload);
                }
                break;
            }
            case 'INFO':
                if (msg.payload) handleConfigUpdate(msg.payload as ConfigPayload);
                break;
            case 'EMERGENCY':
                if (msg.payload) handleEmergency(msg.payload as EmergencyPayload);
                break;
        }
    }, [handleConfigUpdate, handleEmergency]);

    const { isConnected, send } = useSocket(
        `wss://${typeof window !== 'undefined' ? window.location.host : ''}/ws`,
        handleSocketMessage
    );

    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    useEffect(() => {
        const uid = localStorage.getItem('device_uid');
        if (!uid) {
            router.push('/setup');
            return;
        }
        if (isConnected) send({ type: 'auth', uid });
    }, [isConnected, router, send]);

    useEffect(() => {
        if (!config) return;
        timeworkInterval.current = setInterval(() => {
            updateStatusBasedOnTime(config.timework);
        }, 60000);
        return () => {
            if (timeworkInterval.current) clearInterval(timeworkInterval.current);
        };
    }, [config, updateStatusBasedOnTime]);

    const nextSlide = useCallback(() => {
        if (playlistLength === 0) return;
        setCurrentIndex((prev) => (prev + 1) % playlistLength);
        setPlaybackId((prev) => prev + 1);
    }, [playlistLength]);

    const currentItem = useMemo(() => config?.playlist[currentIndex], [config, currentIndex]);
    const nextItem = useMemo(() => {
        if (!config?.playlist.length) return null;
        return config.playlist[(currentIndex + 1) % config.playlist.length];
    }, [config, currentIndex]);

    useEffect(() => {
        if (status !== 'active' || !currentItem || currentItem.content.type !== 'image') return;

        const durationMs = (currentItem.duration || 10) * 1000;
        const timer = setTimeout(nextSlide, durationMs);
        return () => clearTimeout(timer);
    }, [status, currentItem, nextSlide, playbackId]);

    const enableAudio = useCallback(() => setHasInteracted(true), []);

    if (status === 'emergency') {
        return emergencyMode === 'drone' ? <DroneAlert /> : <FireAlarm />;
    }

    if (status === 'sleeping') {
        return <div className="fixed inset-0 bg-black cursor-none" />;
    }

    if (status === 'loading' || !isConnected || !config?.playlist.length || !currentItem) {
        return <LoadingScreen isConnected={isConnected} />;
    }

    return (
        <MediaRenderer
            item={currentItem}
            nextItem={nextItem}
            volume={config.volume ?? 100}
            hasInteracted={hasInteracted}
            onEnded={nextSlide}
            onError={nextSlide}
            playbackId={playbackId}
            onEnableAudio={enableAudio}
        />
    );
}
