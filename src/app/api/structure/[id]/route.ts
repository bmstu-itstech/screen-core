import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { OrgUnit, Device, User } from '@/shared/lib/db/models';
import { redis } from '@/shared/lib/redis/client';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface UpdateUnitDto {
    name?: string;
    isActive?: boolean;
    playlist?: string;
    currentMode?: string;
    volume?: number;
    timework?: Record<string, unknown>;
}

interface DeviceSubset {
    uid: string;
    name: string;
}

const NotificationService = {
    async broadcastRefresh(unitIds: string[]): Promise<void> {
        if (unitIds.length === 0) return;

        const devices = await Device.find({ orgUnitId: { $in: unitIds } })
            .select('uid')
            .lean<DeviceSubset[]>();

        if (devices.length === 0) return;

        const payload = JSON.stringify({
            payload: { type: 'REFRESH' }
        });

        const updates = devices.map(dev => {
            const message = JSON.stringify({ uid: dev.uid, ...JSON.parse(payload) });
            return redis.publish('device-updates', message);
        });

        await Promise.all(updates);
    }
};

const UnitService = {
    async getById(id: string) {
        return OrgUnit.findById(id).lean();
    },

    async update(id: string, data: UpdateUnitDto) {
        const { name, isActive, playlist, currentMode, volume, timework } = data;

        const updatedUnit = await OrgUnit.findByIdAndUpdate(
            id,
            { $set: { name, isActive, playlist, currentMode, volume, timework } },
            { new: true, lean: true }
        );

        if (!updatedUnit) return null;

        const children = await OrgUnit.find({ path: { $regex: id } })
            .select('_id')
            .lean();

        const affectedIds = [id, ...children.map(c => c._id.toString())];

        NotificationService.broadcastRefresh(affectedIds).catch(console.error);

        return updatedUnit;
    },

    async deleteCascade(id: string) {
        const targetUnit = await OrgUnit.findById(id).select('type').lean();

        if (!targetUnit) throw new Error('Not found');
        if (targetUnit.type === 'root') throw new Error('Cannot delete root');

        const children = await OrgUnit.find({ path: { $regex: id } }).select('_id').lean();
        const idsToDelete = [id, ...children.map(c => c._id)];

        await Promise.all([
            OrgUnit.deleteMany({ _id: { $in: idsToDelete } }),
            Device.updateMany({ orgUnitId: { $in: idsToDelete } }, { $unset: { orgUnitId: "" } }),
            User.deleteMany({ orgUnitId: { $in: idsToDelete } })
        ]);
    }
};

export async function GET(req: NextRequest, { params }: RouteParams) {
    await connectDB();
    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const unit = await UnitService.getById(id);

    if (!unit) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(unit);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        await connectDB();
        const { id } = await params;
        const body = await req.json() as UpdateUnitDto;

        const updatedUnit = await UnitService.update(id, body);

        if (!updatedUnit) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(updatedUnit);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        await connectDB();
        const { id } = await params;

        await UnitService.deleteCascade(id);

        return NextResponse.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Delete failed';
        const status = message === 'Not found' ? 404 : (message === 'Cannot delete root' ? 403 : 500);

        return NextResponse.json({ error: message }, { status });
    }
}
