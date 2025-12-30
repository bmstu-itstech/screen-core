import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/shared/lib/auth/jwt';

const PUBLIC_PATHS = [
    '/',
    '/auth',
    '/setup',
    '/system-setup',
    '/api/auth/login',
    '/api/auth/pair',
    '/api/system/setup',
    '/player',
];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    ) {
        return NextResponse.next();
    }

    const token = req.cookies.get('token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/auth', req.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/auth', req.url));
    }

    const requestHeaders = new Headers(req.headers);

    requestHeaders.set('x-user-id', String(payload.userId));
    requestHeaders.set('x-user-role', String(payload.role));
    requestHeaders.set('x-user-org', String(payload.orgUnitId));

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
