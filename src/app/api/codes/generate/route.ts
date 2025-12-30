import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/shared/lib/redis/client';

export const dynamic = 'force-dynamic';

const REDIS_TTL_SECONDS = 300;
const CODE_MIN = 10000;
const CODE_MAX = 99999;

interface PairingData {
    orgUnitId: string;
    generatedBy: string | null;
}

const generateCode = (): string => {
    return Math.floor(CODE_MIN + Math.random() * (CODE_MAX - CODE_MIN + 1)).toString();
};

const isValidOrgId = (id: string | null): id is string => {
    return Boolean(id) && id !== 'undefined' && id !== 'null';
};

export async function POST(req: NextRequest) {
    try {
        const orgUnitId = req.headers.get('x-user-org');
        const userId = req.headers.get('x-user-id');

        if (!isValidOrgId(orgUnitId)) {
            return NextResponse.json(
                { error: 'Ваша сессия не содержит ID организации. Попробуйте выйти и войти заново.' },
                { status: 401 }
            );
        }

        const code = generateCode();

        const payload: PairingData = {
            orgUnitId,
            generatedBy: userId,
        };

        await redis.set(`pairing:${code}`, JSON.stringify(payload), {
            EX: REDIS_TTL_SECONDS,
        });

        return NextResponse.json({ code });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
