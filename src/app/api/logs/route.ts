import { NextRequest, NextResponse } from 'next/server';
import mongoose, { QueryFilter, Types } from 'mongoose';
import { connectDB } from '@/shared/lib/db/connect';
import { Log, OrgUnit, User } from '@/shared/lib/db/models';

export const dynamic = 'force-dynamic';

interface IOrgUnit {
    _id: Types.ObjectId;
    path: string;
    name: string;
}

interface IUser {
    _id: Types.ObjectId;
    login: string;
}

interface ILogDoc {
    _id: Types.ObjectId;
    action: string;
    actorId: string;
    orgUnitId?: IOrgUnit | Types.ObjectId;
    timestamp: Date;
    [key: string]: unknown;
}

type EnrichedLog = ILogDoc & { actorName: string };

interface QueryParams {
    action: string | null;
    search: string | null;
    page: number;
    limit: number;
    skip: number;
    userOrgId: string | null;
    userRole: string | null;
    userId: string | null;
}

function parseParams(req: NextRequest): QueryParams {
    const { searchParams } = new URL(req.url);
    const headers = req.headers;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10));

    return {
        action: searchParams.get('action'),
        search: searchParams.get('search'),
        page,
        limit,
        skip: (page - 1) * limit,
        userOrgId: headers.get('x-user-org'),
        userRole: headers.get('x-user-role'),
        userId: headers.get('x-user-id'),
    };
}

async function getOrgFilter(
    userRole: string | null,
    userOrgId: string | null,
    userId: string | null
): Promise<QueryFilter<ILogDoc> | null> {
    if (userRole === 'root' || !userOrgId) return null;

    const childUnits = await OrgUnit.find({
        $or: [{ _id: userOrgId }, { path: { $regex: userOrgId } }]
    })
        .select('_id')
        .lean<Pick<IOrgUnit, '_id'>[]>();

    const childIds = childUnits.map((u) => u._id);

    return {
        $or: [
            { orgUnitId: { $in: childIds } },
            { actorId: userId }
        ]
    };
}

async function getSearchFilter(search: string): Promise<QueryFilter<ILogDoc>> {
    const searchRegex = { $regex: search, $options: 'i' };

    const foundUsers = await User.find({ login: searchRegex })
        .select('_id')
        .lean<Pick<IUser, '_id'>[]>();

    const foundUserIds = foundUsers.map((u) => u._id.toString());

    return {
        $or: [
            { action: searchRegex },
            { actorId: { $in: foundUserIds } },
            { actorId: searchRegex }
        ]
    };
}

async function enrichLogsWithActors(logs: ILogDoc[]): Promise<EnrichedLog[]> {
    const actorIds = new Set<string>();

    for (const log of logs) {
        if (log.actorId && log.actorId !== 'system' && mongoose.Types.ObjectId.isValid(log.actorId)) {
            actorIds.add(log.actorId);
        }
    }

    const actorsMap = new Map<string, string>();

    if (actorIds.size > 0) {
        const users = await User.find({ _id: { $in: Array.from(actorIds) } })
            .select('login')
            .lean<Pick<IUser, '_id' | 'login'>[]>();

        for (const user of users) {
            actorsMap.set(user._id.toString(), user.login);
        }
    }

    return logs.map((log) => {
        let actorName;
        if (log.actorId === 'system') {
            actorName = 'System';
        } else {
            actorName = actorsMap.get(log.actorId) || log.actorId;
        }

        return { ...log, actorName };
    });
}

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const params = parseParams(req);
        const conditions: QueryFilter<ILogDoc>[] = [];

        const orgFilter = await getOrgFilter(params.userRole, params.userOrgId, params.userId);
        if (orgFilter) {
            conditions.push(orgFilter);
        }

        if (params.action && params.action !== 'ALL') {
            conditions.push({ action: params.action });
        }

        if (params.search) {
            const searchFilter = await getSearchFilter(params.search);
            conditions.push(searchFilter);
        }

        const query = conditions.length > 0 ? { $and: conditions } : {};

        const logs = await Log.find(query)
            .sort({ timestamp: -1 })
            .skip(params.skip)
            .limit(params.limit)
            .populate('orgUnitId', 'name')
            .lean<ILogDoc[]>();

        const enrichedLogs = await enrichLogsWithActors(logs);

        return NextResponse.json({
            data: enrichedLogs,
            hasMore: logs.length === params.limit
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[LOGS_API_ERROR]', error);

        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 }
        );
    }
}
