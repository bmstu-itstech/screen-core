export const Skeleton = ({ className = '' }: { className?: string }) => {
    return (
        <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
    );
};
