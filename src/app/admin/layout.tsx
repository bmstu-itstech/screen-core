'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Monitor,
    FolderOpen,
    LogOut,
    FileText,
    Network,
    type LucideIcon
} from 'lucide-react';

interface INavItem {
    href: string;
    icon: LucideIcon;
    label: string;
}

const NAVIGATION_ITEMS: ReadonlyArray<INavItem> = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Обзор' },
    { href: '/admin/structure', icon: Network, label: 'Структура' },
    { href: '/admin/displays', icon: Monitor, label: 'Экраны' },
    { href: '/admin/materials', icon: FolderOpen, label: 'Материалы' },
    { href: '/admin/logs', icon: FileText, label: 'Логи' },
];

const SidebarLogo: React.FC = () => (
    <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Monitor size={18} className="text-white" />
            </div>
            ScreenCore
        </div>
    </div>
);

const NavItem: React.FC<{ item: INavItem }> = ({ item }) => {
    const pathname = usePathname();
    const currentPath = pathname ?? '';

    const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group";
    const activeClasses = "bg-blue-600 text-white shadow-lg shadow-blue-900/20";
    const inactiveClasses = "text-gray-400 hover:text-white hover:bg-gray-800";

    return (
        <Link
            href={item.href}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
            <item.icon
                size={20}
                className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'}
            />
            <span className="font-medium text-sm">{item.label}</span>
        </Link>
    );
};

const Navigation: React.FC = () => (
    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {NAVIGATION_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} />
        ))}
    </nav>
);

const LogoutButton: React.FC = () => {
    const router = useRouter();

    const handleLogout = useCallback(() => {
        document.cookie = 'token=; Max-Age=0; path=/;';
        router.push('/auth');
    }, [router]);

    return (
        <div className="p-4 border-t border-gray-800">
            <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-red-400 hover:text-white hover:bg-red-900/20 rounded-lg transition-colors"
                type="button"
            >
                <LogOut size={20} />
                <span className="font-medium text-sm">Выйти</span>
            </button>
        </div>
    );
};

const Sidebar: React.FC = () => (
    <aside className="w-64 border-r border-gray-800 flex flex-col bg-[#0A0A0A]">
        <SidebarLogo />
        <Navigation />
        <LogoutButton />
    </aside>
);

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="flex h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500 selection:text-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-auto p-6 md:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
