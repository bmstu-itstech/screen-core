import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    color?: 'blue' | 'green' | 'red' | 'purple';
}

export const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }: StatCardProps) => {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-500',
        green: 'bg-green-500/10 text-green-500',
        red: 'bg-red-500/10 text-red-500',
        purple: 'bg-purple-500/10 text-purple-500',
    };

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex items-center gap-4">
            <div className={`p-4 rounded-lg ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-gray-400 text-sm font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
                {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
            </div>
        </div>
    );
};
