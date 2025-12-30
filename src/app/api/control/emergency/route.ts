import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/shared/lib/redis/client';
import { logger } from '@/shared/lib/logger';
import { connectDB } from '@/shared/lib/db/connect';
import { OrgUnit, Device } from '@/shared/lib/db/models';

interface EmergencyRequestBody {
    active: boolean;
    mode?: string;
}

interface RedisEmergencyPayload {
    active: boolean;
    mode?: string;
    targetUids: string[];
}

const REDIS_CHANNEL = 'system-emergency';
const HEADER_ORG_ID = 'x-user-org';
const HEADER_USER_ROLE = 'x-user-role';

async function getTargetDeviceUids(role: string | null, orgId: string | null): Promise<string[]> {
    if (role === 'root') {
        const allDevices = await Device.find({}).select('uid').lean();
        return allDevices.map((d) => d.uid);
    }

    if (!orgId) {
        return [];
    }

    const childUnits = await OrgUnit.find({
        $or: [
            { _id: orgId },
            { path: { $regex: orgId } }
        ]
    }).select('_id').lean();

    const allowedUnitIds = childUnits.map((u) => u._id);

    const devices = await Device.find({
        orgUnitId: { $in: allowedUnitIds }
    }).select('uid').lean();

    return devices.map((d) => d.uid);
}

async function handleEmergencyState(
    orgId: string | null,
    payload: RedisEmergencyPayload
): Promise<void> {
    const { active, mode, targetUids } = payload;

    if (active && mode) {
        const key = orgId ? `emergency:mode:${orgId}` : 'emergency:mode:global';
        await redis.set(key, mode);
    }

    await redis.publish(REDIS_CHANNEL, JSON.stringify({
        active,
        mode,
        targetUids
    }));
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const body = await req.json() as EmergencyRequestBody;
        const { active, mode } = body;

        const userOrgId = req.headers.get(HEADER_ORG_ID);
        const userRole = req.headers.get(HEADER_USER_ROLE);

        const targetUids = await getTargetDeviceUids(userRole, userOrgId);

        if (targetUids.length === 0) {
            return NextResponse.json(
                { error: 'No devices found in your scope' },
                { status: 404 }
            );
        }

        await handleEmergencyState(userOrgId, { active, mode, targetUids });

        await logger({
            action: active ? 'EMERGENCY_STARTED' : 'EMERGENCY_STOPPED',
            level: 'warn',
            details: {
                mode: mode || 'fire',
                affectedDevices: targetUids.length
            },
            req
        });

        return NextResponse.json({ success: true, count: targetUids.length });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
