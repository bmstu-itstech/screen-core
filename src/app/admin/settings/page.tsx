'use client';

import { useState, useEffect, ChangeEvent, FormEvent, useMemo } from 'react';
import { Button } from '@/shared/ui/Button';

interface OrgUnit {
    _id: string;
    name: string;
    type: string;
}

interface CreateUserPayload {
    login: string;
    password: string;
    orgUnitId: string;
    role: 'admin';
}

const API_ROUTES = {
    STRUCTURE: '/api/structure',
    USERS: '/api/users',
};

const INITIAL_FORM_STATE = {
    login: '',
    password: '',
    orgUnitId: '',
};

function useAdminForm() {
    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchStructure = async () => {
            try {
                const res = await fetch(API_ROUTES.STRUCTURE);
                if (!res.ok) throw new Error('Failed to fetch structure');
                const data: OrgUnit[] = await res.json();
                setOrgUnits(data);
            } catch (error) {
                console.error(error);
            }
        };

        fetchStructure();
    }, []);

    const sortedOrgUnits = useMemo(() => {
        return [...orgUnits].sort((a, b) => a.name.localeCompare(b.name));
    }, [orgUnits]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: null, message: '' });

        const payload: CreateUserPayload = {
            login: formData.login,
            password: formData.password,
            orgUnitId: formData.orgUnitId,
            role: 'admin',
        };

        try {
            const res = await fetch(API_ROUTES.USERS, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
            });

            if (res.ok) {
                setStatus({ type: 'success', message: 'Пользователь успешно создан' });
                setFormData(INITIAL_FORM_STATE);
            } else {
                throw new Error('Ошибка при создании');
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Не удалось создать пользователя' });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData,
        orgUnits: sortedOrgUnits,
        handleChange,
        handleSubmit,
        status,
        isLoading
    };
}

interface FieldProps {
    label: string;
    children: React.ReactNode;
}

const FieldWrapper = ({ label, children }: FieldProps) => (
    <div>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        {children}
    </div>
);

const baseInputClasses = "w-full bg-gray-950 border border-gray-700 p-2 rounded text-white focus:outline-none focus:border-blue-500 transition-colors";

export default function SettingsPage() {
    const { formData, orgUnits, handleChange, handleSubmit, status, isLoading } = useAdminForm();

    return (
        <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-8">Настройки доступа</h1>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                <h2 className="text-xl text-white mb-4">Создать администратора</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FieldWrapper label="Логин">
                        <input
                            name="login"
                            className={baseInputClasses}
                            value={formData.login}
                            onChange={handleChange}
                            required
                            autoComplete="off"
                        />
                    </FieldWrapper>

                    <FieldWrapper label="Пароль">
                        <input
                            name="password"
                            type="password"
                            className={baseInputClasses}
                            value={formData.password}
                            onChange={handleChange}
                            required
                            autoComplete="new-password"
                        />
                    </FieldWrapper>

                    <FieldWrapper label="Вуз">
                        <select
                            name="orgUnitId"
                            className={baseInputClasses}
                            value={formData.orgUnitId}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Выберите вуз</option>
                            {orgUnits.map(u => (
                                <option key={u._id} value={u._id}>
                                    {u.name} ({u.type})
                                </option>
                            ))}
                        </select>
                    </FieldWrapper>

                    {status.message && (
                        <div className={`text-sm ${status.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {status.message}
                        </div>
                    )}

                    <Button variant="primary" type="submit" disabled={isLoading}>
                        {isLoading ? 'Создание...' : 'Создать'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
