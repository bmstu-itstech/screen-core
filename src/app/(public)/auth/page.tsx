'use client';

import { useState, useEffect, ChangeEvent, FormEvent, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Monitor, AlertCircle, LucideIcon } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

type AppRouter = ReturnType<typeof useRouter>;

interface InputFieldProps {
    label: string;
    icon: LucideIcon;
    type?: string;
    placeholder: string;
    value: string;
    name: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    autoFocus?: boolean;
}

const Background = memo(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-125 h-125 bg-blue-600/5 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-125 h-125 bg-indigo-600/5 blur-[100px] rounded-full animate-pulse delay-1000" />
    </div>
));

Background.displayName = 'Background';

const InputField = ({ label, icon: Icon, type = 'text', ...props }: InputFieldProps) => (
    <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
            {label}
        </label>
        <div className="relative group">
            <Icon className="absolute left-3 top-3 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
                className="w-full bg-[#111] border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-700 focus:border-blue-500 focus:bg-[#151515] outline-none transition-all"
                type={type}
                {...props}
            />
        </div>
    </div>
);

const useSystemInitialization = (router: AppRouter) => {
    useEffect(() => {
        const controller = new AbortController();

        const checkSystem = async () => {
            try {
                const res = await fetch('/api/system/setup', { signal: controller.signal });
                const data = await res.json();
                if (!data.initialized) router.replace('/system-setup');
            } catch {

            }
        };

        checkSystem();

        return () => controller.abort();
    }, [router]);
};

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ login: '', password: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useSystemInitialization(router);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (status === 'error') setStatus('idle');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const data = await res.json();
                document.cookie = `token=${data.token}; path=/; max-age=86400`;
                router.push('/admin/dashboard');
            } else {
                setErrorMessage('Неверные учетные данные');
                setStatus('error');
            }
        } catch {
            setErrorMessage('Ошибка сети');
            setStatus('error');
        } finally {
            if (status !== 'error') setStatus('idle');
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <Background />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white/5 border border-white/10 rounded-xl mb-4 backdrop-blur-sm">
                        <Monitor className="text-blue-500" size={24} />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">ScreenCore</h1>
                    <p className="text-gray-500 text-sm mt-2">Войдите для управления экранами</p>
                </div>

                <div className="bg-[#0A0A0A]/80 border border-gray-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <InputField
                            label="Логин"
                            icon={User}
                            name="login"
                            placeholder="Введите логин"
                            value={formData.login}
                            onChange={handleInputChange}
                            autoFocus
                        />

                        <InputField
                            label="Пароль"
                            icon={Lock}
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleInputChange}
                        />

                        {status === 'error' && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-900/10 border border-red-900/20 p-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={16} />
                                {errorMessage}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-900/20 rounded-xl mt-2 transition-all active:scale-[0.98]"
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? 'Выполняется вход...' : 'Войти'}
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-800 text-center">
                        <button
                            onClick={() => router.push('/setup')}
                            className="text-gray-500 hover:text-white text-sm transition-colors outline-none focus:text-white"
                        >
                            Подключить новый экран?
                        </button>
                    </div>
                </div>

                <p className="text-center text-gray-600 text-xs mt-8">
                    &copy; 2025 ИТС ТЕХ
                </p>
            </div>
        </div>
    );
}
