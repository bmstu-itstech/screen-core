import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { Device, Log } from '@/shared/lib/db/models';
import { publishEvent } from '@/shared/lib/queue/rabbitmq';

type DevicePayload = Record<string, unknown> & {
    playlist?: unknown;
    timework?: unknown;
};

interface RouteContext {
    params: Promise<{ uid: string }>;
}

async function updateDeviceInDb(uid: string, payload: DevicePayload) {
    return Device.findOneAndUpdate(
        { uid },
        { $set: payload },
        { new: true, lean: true }
    );
}

async function handleSideEffects(uid: string, payload: DevicePayload, deviceData: DevicePayload) {
    const queueData = {
        uid,
        data: {
            playlist: deviceData.playlist,
            timework: deviceData.timework,
        },
    };

    const logData = {
        level: 'info',
        action: 'DEVICE_UPDATE_CONTENT',
        details: payload,
        actorId: 'admin-id',
    };

    await Promise.all([
        Log.create(logData),
        publishEvent('screen.update_content', queueData),
    ]);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    try {
        await connectDB();

        const { uid } = await params;
        const body: DevicePayload = await req.json();

        const updatedDevice = await updateDeviceInDb(uid, body);

        if (!updatedDevice) {
            return NextResponse.json(
                { success: false, error: 'Device not found' },
                { status: 404 }
            );
        }

        await handleSideEffects(uid, body, updatedDevice);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
