'use client';

import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Server, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface FormData {
    orgName: string;
    login: string;
    password: string;
}

interface FieldConfig {
    name: keyof FormData;
    label: string;
    type: string;
    placeholder: string;
    autoFocus?: boolean;
    extraContent?: React.ReactNode;
}

const INITIAL_FORM: FormData = { orgName: '', login: '', password: '' };

const FIELDS: FieldConfig[] = [
    {
        name: 'orgName',
        label: 'Вуз',
        type: 'text',
        placeholder: 'Пример: МГТУ им. Н.Э. Баумана',
        autoFocus: true
    },
    {
        name: 'login',
        label: 'Логин',
        type: 'text',
        placeholder: 'root'
    },
    {
        name: 'password',
        label: 'Пароль',
        type: 'password',
        placeholder: '••••••••••••',
        extraContent: (
            <div className="flex gap-3 bg-blue-900/20 border border-blue-900/30 p-3 rounded-lg mt-2">
                <div className="mt-0.5"><CheckCircle2 size={16} className="text-blue-400"/></div>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                    Это мастер-аккаунт. Он будет иметь неограниченный доступ к управлению всей системой
                </p>
            </div>
        )
    }
];

function useSystemSetup() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(INITIAL_FORM);

    useEffect(() => {
        const checkInit = async () => {
            try {
                const res = await fetch('/api/system/setup');
                const data = await res.json();
                if (data.initialized) router.replace('/auth');
                else setLoading(false);
            } catch {
                setLoading(false);
            }
        };
        checkInit();
    }, [router]);

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setError(null);
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/system/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                router.push('/admin/dashboard');
            } else {
                throw new Error('Ошибка при создании администратора');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
            setSubmitting(false);
        }
    };

    return { loading, submitting, error, form, handleChange, handleSubmit };
}

const Header = () => (
    <div className="w-full max-w-md mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-6 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <Server className="text-black" size={24} strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Настройка сервера</h1>
        <p className="text-zinc-400">Информация о вузе и мастер-аккаунте</p>
    </div>
);

const InputField = ({
                        config,
                        value,
                        onChange,
                        disabled
                    }: {
    config: FieldConfig;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
}) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
            {config.label}
        </label>
        <input
            name={config.name}
            type={config.type}
            placeholder={config.placeholder}
            autoFocus={config.autoFocus}
            value={value}
            onChange={onChange}
            disabled={disabled}
            required
            className="w-full bg-black border border-zinc-700 text-white text-base rounded-lg px-4 py-3 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50"
        />
        {config.extraContent}
    </div>
);

const SubmitButton = ({ loading }: { loading: boolean }) => (
    <button
        type="submit"
        disabled={loading}
        className="group mt-2 w-full bg-white hover:bg-zinc-200 text-black font-bold text-base h-12 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {loading ? 'Настройка...' : 'Завершить установку'}
        {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>}
    </button>
);

const ErrorMessage = ({ message }: { message: string | null }) => {
    if (!message) return null;
    return (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 p-3 rounded-lg border border-red-900/50">
            <AlertCircle size={16} />
            <span>{message}</span>
        </div>
    );
};

export default function SystemSetupPage() {
    const { loading, submitting, error, form, handleChange, handleSubmit } = useSystemSetup();

    if (loading) return <div className="min-h-screen bg-black" />;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-black font-sans">
            <Header />

            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-zinc-900/50 p-6 rounded-xl space-y-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {FIELDS.map((field) => (
                            <InputField
                                key={field.name}
                                config={field}
                                value={form[field.name]}
                                onChange={handleChange}
                                disabled={submitting}
                            />
                        ))}

                        <ErrorMessage message={error} />
                        <SubmitButton loading={submitting} />
                    </form>
                </div>
            </div>
        </div>
    );
}
