'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, ArrowRight, Loader2 } from 'lucide-react';

const CONFIG = {
    API_ENDPOINT: '/api/auth/pair',
    STORAGE_KEY: 'device_uid',
    REDIRECT_PATH: '/player',
    CODE_LENGTH: 5,
};

function useDevicePairing() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const pairDevice = async (code: string) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(CONFIG.API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                throw new Error('Код не найден или истек');
            }

            const data = await response.json();
            localStorage.setItem(CONFIG.STORAGE_KEY, data.uid);
            router.push(CONFIG.REDIRECT_PATH);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Произошла ошибка';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return { pairDevice, isLoading, error };
}

const Header = () => (
    <>
        <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 rounded-2xl mb-8 border border-zinc-800">
            <Monitor size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Подключение экрана</h1>
        <p className="text-zinc-500 mb-8">
            Введите 5-значный код, сгенерированный в панели управления.
        </p>
    </>
);

const Footer = () => (
    <div className="mt-12 text-zinc-600 text-sm">
        Нет кода? Обратитесь к администратору системы.
    </div>
);

const SubmitButton = ({ isLoading, disabled }: { isLoading: boolean; disabled: boolean }) => (
    <button
        type="submit"
        disabled={disabled}
        className="mt-6 w-full bg-white text-black font-bold h-12 rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
    >
        {isLoading ? <Loader2 className="animate-spin" /> : <>Подключить <ArrowRight size={18} /></>}
    </button>
);

const ErrorMessage = ({ message }: { message: string }) => {
    if (!message) return null;
    return (
        <p className="text-red-500 mt-4 text-sm font-medium animate-in slide-in-from-top-2">
            {message}
        </p>
    );
};

export default function SetupPage() {
    const [code, setCode] = useState('');
    const { pairDevice, isLoading, error } = useDevicePairing();

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value.length <= CONFIG.CODE_LENGTH) {
            setCode(value);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (code.length === CONFIG.CODE_LENGTH) {
            await pairDevice(code);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <Header />

                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={CONFIG.CODE_LENGTH}
                        value={code}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-white text-center text-4xl font-mono tracking-[0.5em] rounded-xl py-6 text-white outline-none transition-all placeholder:text-zinc-800"
                        placeholder={"0".repeat(CONFIG.CODE_LENGTH)}
                        autoFocus
                    />

                    <ErrorMessage message={error} />

                    <SubmitButton
                        isLoading={isLoading}
                        disabled={code.length !== CONFIG.CODE_LENGTH || isLoading}
                    />
                </form>

                <Footer />
            </div>
        </div>
    );
};
