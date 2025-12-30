import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { redis } from '@/shared/lib/redis/client';
import { connectDB } from '@/shared/lib/db/connect';
import { Device, Log } from '@/shared/lib/db/models';
import { logger } from '@/shared/lib/logger';

interface PairingCacheData {
    orgUnitId: string;
}

interface PairingRequest {
    code: string;
}

const REDIS_PREFIX = 'pairing:';

async function getPairingData(code: string): Promise<PairingCacheData> {
    const dataString = await redis.get(`${REDIS_PREFIX}${code}`);

    if (!dataString) {
        throw new Error('Code not found or expired');
    }

    try {
        const parsed = JSON.parse(dataString);
        if (!parsed.orgUnitId || typeof parsed.orgUnitId !== 'string') {
            throw new Error('Invalid Organization ID');
        }
        return parsed as PairingCacheData;
    } catch {
        throw new Error('System Error: Bad Pairing Data');
    }
}

async function handleSideEffects(
    req: NextRequest,
    code: string,
    device: { uid: string; name: string; orgUnitId: string }
) {
    await Promise.all([
        redis.del(`${REDIS_PREFIX}${code}`),
        Log.create({
            level: 'info',
            action: 'DEVICE_PAIRED',
            details: { code, name: device.name },
            actorId: device.uid,
            orgUnitId: device.orgUnitId
        }),
        logger({
            action: 'DEVICE_ADD',
            details: {
                name: device.name,
                uid: device.uid,
                code: code
            },
            orgUnitId: device.orgUnitId,
            req
        })
    ]);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as PairingRequest;

        if (!body.code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        const { orgUnitId } = await getPairingData(body.code);

        await connectDB();

        const uid = randomUUID();
        const newDevice = await Device.create({
            uid,
            name: `Display ${body.code}`,
            orgUnitId,
            status: 'online',
            currentMode: 'slideshow',
            playlist: [],
            timework: [0, 86400]
        });

        await handleSideEffects(req, body.code, {
            uid: newDevice.uid,
            name: newDevice.name,
            orgUnitId
        });

        return NextResponse.json({
            uid: newDevice.uid,
            title: newDevice.name,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        const status = message === 'Code not found or expired' ? 404 : 500;

        console.error('Pairing Error:', message);

        return NextResponse.json({ error: message }, { status });
    }
}
