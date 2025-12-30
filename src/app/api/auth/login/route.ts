import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/shared/lib/db/connect';
import { User } from '@/shared/lib/db/models';
import { signToken } from '@/shared/lib/auth/jwt';
import { logger } from '@/shared/lib/logger';

export const dynamic = 'force-dynamic';

interface LoginBody {
    login?: string;
    password?: string;
}

const COOKIE_OPTIONS = {
    httpOnly: false,
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax' as const,
};

const OS_PATTERNS: [string, string][] = [
    ['Windows', 'Windows PC'],
    ['Macintosh', 'Mac'],
    ['Linux', 'Linux'],
    ['iPhone', 'iPhone'],
    ['Android', 'Android'],
];

const BROWSER_PATTERNS: [string, string][] = [
    ['Chrome', 'Chrome'],
    ['Firefox', 'Firefox'],
    ['Safari', 'Safari'],
];

function parseUserAgent(userAgent: string): string {
    const os = OS_PATTERNS.find(([key]) => userAgent.includes(key))?.[1] || 'Unknown Device';

    const browserEntry = BROWSER_PATTERNS.find(([key]) =>
        userAgent.includes(key) && !(key === 'Safari' && userAgent.includes('Chrome'))
    );

    return browserEntry ? `${os} / ${browserEntry[1]}` : os;
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { login, password }: LoginBody = await req.json();

        if (!login || !password) {
            return NextResponse.json({ error: 'Не указан логин или пароль' }, { status: 400 });
        }

        const user = await User.findOne({ login });
        const isPasswordValid = user && await bcrypt.compare(password, user.passwordHash);

        if (!user || !isPasswordValid) {
            return NextResponse.json({ error: 'Неверные учетные данные' }, { status: 401 });
        }

        const userIdString = user._id.toString();
        const orgUnitIdString = user.orgUnitId?.toString();

        const token = await signToken({
            userId: user._id.toString(),
            role: user.role,
            orgUnitId: user.orgUnitId?.toString()
        });

        const userAgent = req.headers.get('user-agent') || 'Unknown';
        const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

        await logger({
            action: 'USER_LOGIN',
            level: 'info',
            details: {
                ip,
                device: parseUserAgent(userAgent),
                fullUA: userAgent
            },
            orgUnitId: orgUnitIdString,
            req: {
                headers: {
                    get: (key: string) => key === 'x-user-id' ? userIdString : null
                }
            } as unknown as NextRequest
        });

        const response = NextResponse.json({
            success: true,
            token,
            user: { login: user.login, role: user.role }
        });

        response.cookies.set('token', token, COOKIE_OPTIONS);

        return response;

    } catch (error) {
        console.error('Login Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
