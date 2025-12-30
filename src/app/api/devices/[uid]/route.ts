import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { Device, Log } from '@/shared/lib/db/models';
import { redis } from '@/shared/lib/redis/client';
import { logger } from "@/shared/lib/logger";

export const dynamic = 'force-dynamic';

interface IPlaylistItem {
    materialId: string;
    duration: number;
    isMuted: boolean;
}

interface IDeviceUpdatePayload {
    name?: string;
    isActive?: boolean;
    playlist?: IPlaylistItem[];
    currentMode?: string;
    volume?: number;
    timework?: unknown;
    orgUnitId?: string | null;
}

interface IDeviceDocument {
    _id: string;
    uid: string;
    name: string;
    orgUnitId: string | null;
    [key: string]: unknown;
}

const REDIS_CHANNEL = 'device-updates';

async function sendDeviceNotification(uid: string): Promise<void> {
    await redis.publish(REDIS_CHANNEL, JSON.stringify({
        uid,
        payload: { type: 'REFRESH' }
    }));
}

async function logDeviceAction(
    req: NextRequest,
    action: string,
    device: IDeviceDocument,
    details: Record<string, unknown>
): Promise<void> {
    const actorId = req.headers.get('x-user-id') || 'system';

    await Promise.all([
        Log.create({
            level: 'info',
            action,
            details,
            actorId
        }),
        logger({
            action,
            details,
            orgUnitId: device.orgUnitId,
            req
        })
    ]);
}

function buildUpdateQuery(body: Partial<IDeviceUpdatePayload>): Partial<IDeviceDocument> {
    const query: Partial<IDeviceDocument> = {};
    const simpleFields: (keyof IDeviceUpdatePayload)[] = [
        'name', 'isActive', 'playlist', 'currentMode', 'volume', 'timework'
    ];

    simpleFields.forEach((field) => {
        if (body[field] !== undefined) {
            query[field as string] = body[field];
        }
    });

    if (body.orgUnitId !== undefined) {
        query.orgUnitId = body.orgUnitId === "" ? null : body.orgUnitId;
    }

    return query;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uid: string }> }
) {
    await connectDB();
    const { uid } = await params;

    const device = await Device.findOne({ uid }).lean();

    if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json(device);
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ uid: string }> }
) {
    try {
        await connectDB();
        const { uid } = await params;
        const body: Partial<IDeviceUpdatePayload> = await req.json();

        const updateFields = buildUpdateQuery(body);

        const updatedDevice = await Device.findOneAndUpdate(
            { uid },
            { $set: updateFields },
            { new: true }
        ).lean() as IDeviceDocument | null;

        if (!updatedDevice) {
            return NextResponse.json({ error: 'Device not found' }, { status: 404 });
        }

        await sendDeviceNotification(uid);

        await logDeviceAction(req, 'DEVICE_UPDATE', updatedDevice, {
            uid,
            updates: Object.keys(updateFields)
        });

        return NextResponse.json(updatedDevice);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ uid: string }> }
) {
    await connectDB();
    const { uid } = await params;

    const deletedDevice = await Device.findOneAndDelete({ uid }) as IDeviceDocument | null;

    if (deletedDevice) {
        await logger({
            action: 'DEVICE_DELETE',
            level: 'warn',
            details: { uid, name: deletedDevice.name },
            orgUnitId: deletedDevice.orgUnitId,
            req
        });
    }

    return NextResponse.json({ success: true });
}
