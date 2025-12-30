'use client';

import Link from 'next/link';
import { Monitor, LayoutDashboard, ArrowRight, type LucideIcon } from 'lucide-react';

interface ThemeConfig {
  gradient: string;
  iconHover: string;
  ctaHover: string;
}

interface NavigationOption {
  id: string;
  href: string;
  title: string;
  description: string;
  ctaText: string;
  Icon: LucideIcon;
  theme: ThemeConfig;
}

const NAVIGATION_OPTIONS: NavigationOption[] = [
  {
    id: 'screen-mode',
    href: '/setup',
    title: 'Экран',
    description: 'Выберите этот пункт, если это устройство будет отображать контент (телевизор, монитор, табло).',
    ctaText: 'ПОДКЛЮЧИТЬ УСТРОЙСТВО',
    Icon: Monitor,
    theme: {
      gradient: 'from-purple-500/10 to-blue-500/10',
      iconHover: 'group-hover:bg-white group-hover:text-black',
      ctaHover: 'group-hover:text-white',
    },
  },
  {
    id: 'admin-mode',
    href: '/auth',
    title: 'Администратор',
    description: 'Вход в панель управления. Загрузка материалов, настройка и управление экранами.',
    ctaText: 'ВОЙТИ В СИСТЕМУ',
    Icon: LayoutDashboard,
    theme: {
      gradient: 'from-blue-500/10 to-cyan-500/10',
      iconHover: 'group-hover:bg-blue-600 group-hover:text-white',
      ctaHover: 'group-hover:text-blue-400',
    },
  },
];

const Header = () => (
    <header className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        ScreenCore
      </h1>
      <p className="text-zinc-400 text-lg">
        Система удаленного управления экранами
      </p>
    </header>
);

const NavigationCard = ({ option }: { option: NavigationOption }) => {
  const { href, theme, Icon, title, description, ctaText } = option;

  return (
      <Link href={href} className="group relative block">
        <div
            className={`absolute inset-0 bg-linear-to-r ${theme.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
        />
        <article className="relative h-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1">
          <div className={`w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300 ${theme.iconHover}`}>
            <Icon size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3">{title}</h2>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            {description}
          </p>
          <div className={`flex items-center text-sm font-bold text-zinc-500 transition-colors ${theme.ctaHover}`}>
            {ctaText} <ArrowRight size={16} className="ml-2" />
          </div>
        </article>
      </Link>
  );
};

export default function LandingPage() {
  return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-white selection:text-black">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {NAVIGATION_OPTIONS.map((option) => (
              <NavigationCard key={option.id} option={option} />
          ))}
        </div>
      </main>
  );
}
