import { NextRequest, NextResponse } from 'next/server';
import { QueryFilter, Types } from 'mongoose';
import { connectDB } from '@/shared/lib/db/connect';
import { OrgUnit } from '@/shared/lib/db/models';

export const dynamic = 'force-dynamic';

interface IOrgUnit {
    _id: Types.ObjectId;
    name: string;
    type: string;
    parentId: Types.ObjectId | null;
    path: string;
}

interface CreateOrgUnitBody {
    name: string;
    type: string;
    parentId?: string;
}

const isValidId = (id: string | null): boolean => {
    return !!id && id !== 'undefined' && id !== 'null' && Types.ObjectId.isValid(id);
};

const getRequestHeaders = (req: NextRequest) => {
    const role = req.headers.get('x-user-role');
    const orgId = req.headers.get('x-user-org');
    return { role, orgId };
};

const buildReadFilter = (role: string | null, orgId: string | null): QueryFilter<IOrgUnit> | null => {
    if (role === 'root') {
        return {};
    }

    if (!isValidId(orgId)) {
        return null;
    }

    return {
        $or: [
            { _id: new Types.ObjectId(orgId!) },
            { path: { $regex: orgId! } }
        ]
    };
};

const checkWritePermissions = (
    userRole: string | null,
    userOrgId: string | null,
    parentId: string | null,
    parentUnit: IOrgUnit | null
): boolean => {
    if (userRole === 'root') return true;
    if (!parentId) return false;

    if (parentId === userOrgId) return true;

    return !!parentUnit && (parentUnit.path?.includes(userOrgId!) || false);
};

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { role, orgId } = getRequestHeaders(req);
        const filter = buildReadFilter(role, orgId);

        if (!filter) {
            return NextResponse.json([]);
        }

        const units = await OrgUnit.find(filter).lean<IOrgUnit[]>();

        return NextResponse.json(units);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { role, orgId } = getRequestHeaders(req);
        const body = await req.json() as CreateOrgUnitBody;
        const { name, type, parentId } = body;

        let parentUnit: IOrgUnit | null = null;
        let newPath = ',';

        if (parentId) {
            if (!isValidId(parentId)) {
                return NextResponse.json({ error: 'Invalid Parent ID' }, { status: 400 });
            }
            parentUnit = await OrgUnit.findById(parentId).lean<IOrgUnit>();
            if (parentUnit) {
                newPath = `${parentUnit.path}${parentUnit._id},`;
            }
        }

        const hasPermission = checkWritePermissions(role, orgId, parentId || null, parentUnit);

        if (!hasPermission) {
            const status = (!parentId && role !== 'root') ? 400 : 403;
            const message = (!parentId && role !== 'root') ? 'Parent ID required' : 'Forbidden';
            return NextResponse.json({ error: message }, { status });
        }

        const newUnit = await OrgUnit.create({
            name,
            type,
            parentId: parentId || null,
            path: newPath
        });

        return NextResponse.json(newUnit);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
