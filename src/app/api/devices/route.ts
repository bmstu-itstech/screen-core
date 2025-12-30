import { NextRequest, NextResponse } from 'next/server';
import { QueryFilter, Types } from 'mongoose';
import { connectDB } from '@/shared/lib/db/connect';
import { Device, OrgUnit } from '@/shared/lib/db/models';
import { redis } from '@/shared/lib/redis/client';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const REDIS_PREFIX = 'device:latency';
const HEADER_ORG = 'x-user-org';
const HEADER_ROLE = 'x-user-role';

type DeviceStatus = 'online' | 'offline';
type LatencyValue = string | null;

interface IDeviceBase {
    _id: Types.ObjectId | string;
    uid: string;
    createdAt?: Date;
    [key: string]: unknown;
}

interface IDeviceResponse extends IDeviceBase {
    status: DeviceStatus;
    latency: number | null;
}

const getLatencyKey = (uid: string) => `${REDIS_PREFIX}:${uid}`;

async function fetchRedisBatch(keys: string[]): Promise<LatencyValue[]> {
    if (!redis) return new Array(keys.length).fill(null);

    try {
        if (!redis.isOpen) {
            await redis.connect();
        }

        const results = await redis.mGet(keys);

        return results || new Array(keys.length).fill(null);
    } catch (error) {
        console.error('Redis batch fetch error:', error);
        return new Array(keys.length).fill(null);
    }
}

async function fetchLatencies(uids: string[]): Promise<LatencyValue[]> {
    if (uids.length === 0) return [];

    const keys = uids.map(getLatencyKey);
    const results: LatencyValue[] = [];

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        const chunk = keys.slice(i, i + BATCH_SIZE);
        const chunkLatencies = await fetchRedisBatch(chunk);
        results.push(...chunkLatencies);
    }

    return results;
}

async function getAllowedOrgUnitIds(orgUnitId: string): Promise<Types.ObjectId[]> {
    const units = await OrgUnit.find(
        {
            $or: [
                { _id: orgUnitId },
                { path: { $regex: orgUnitId } }
            ]
        },
        { _id: 1 }
    ).lean<{ _id: Types.ObjectId }[]>();

    return units.map((u) => u._id);
}

async function resolveOrgFilter(req: NextRequest): Promise<QueryFilter<typeof Device>> {
    const orgUnitId = req.headers.get(HEADER_ORG);
    const userRole = req.headers.get(HEADER_ROLE);

    if (userRole === 'root' || !orgUnitId) {
        return {};
    }

    const allowedIds = await getAllowedOrgUnitIds(orgUnitId);
    return { orgUnitId: { $in: allowedIds } };
}

function enrichDevices(devices: IDeviceBase[], latencies: LatencyValue[]): IDeviceResponse[] {
    return devices.map((device, index) => {
        const rawLatency = latencies[index];
        const isOnline = rawLatency !== null;

        return {
            ...device,
            status: isOnline ? 'online' : 'offline',
            latency: isOnline ? Number(rawLatency) : null,
        };
    });
}

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const filter = await resolveOrgFilter(req);

        const devices = await Device.find(filter)
            .sort({ createdAt: -1 })
            .lean<IDeviceBase[]>();

        const uids = devices.map((d) => d.uid);
        const latencies = await fetchLatencies(uids);

        const responseData = enrichDevices(devices, latencies);

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Fetch Devices Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
