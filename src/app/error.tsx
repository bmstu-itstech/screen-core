'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/ui/Button';

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

const ErrorMessage = ({ message }: { message: string }) => (
    <p className="mb-6 text-gray-400 font-mono text-sm bg-black p-4 rounded border border-gray-800 break-all">
        {message}
    </p>
);

const ErrorActions = ({ onRetry, onReload }: { onRetry: () => void; onReload: () => void }) => (
    <div className="flex gap-4">
        <Button onClick={onRetry}>
            Try again
        </Button>
        <Button variant="outline" onClick={onReload}>
            Full Reload
        </Button>
    </div>
);

export default function ErrorPage({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const handleReload = () => {
        window.location.reload();
    };

    return (
        <div className="h-screen w-full bg-gray-900 flex flex-col items-center justify-center text-white p-4">
            <h2 className="text-2xl font-bold mb-4 text-red-500">
                Something went wrong!
            </h2>

            <ErrorMessage message={error.message} />

            <ErrorActions
                onRetry={reset}
                onReload={handleReload}
            />
        </div>
    );
}
