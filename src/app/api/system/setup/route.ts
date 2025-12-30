import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/shared/lib/db/connect';
import { User, OrgUnit } from '@/shared/lib/db/models';
import { signToken } from '@/shared/lib/auth/jwt';

export const dynamic = 'force-dynamic';

interface SetupRequest {
    orgName: string;
    login: string;
    password: string;
}

export async function GET() {
    await connectDB();

    const isInitialized = await User.exists({ role: 'root' });

    return NextResponse.json(
        { initialized: !!isInitialized },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
}

export async function POST(req: NextRequest) {
    await connectDB();

    const rootExists = await User.exists({ role: 'root' });
    if (rootExists) {
        return NextResponse.json(
            { error: 'System already initialized' },
            { status: 403 }
        );
    }

    const body = await req.json() as Partial<SetupRequest>;
    if (!validateBody(body)) {
        return NextResponse.json(
            { error: 'All fields are required' },
            { status: 400 }
        );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const token = await performSystemSetup(body, session);
        await session.commitTransaction();

        const response = NextResponse.json({ success: true });
        response.cookies.set('token', token, { httpOnly: true, path: '/' });

        return response;
    } catch {
        await session.abortTransaction();
        return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
    } finally {
        await session.endSession();
    }
}

function validateBody(body: Partial<SetupRequest>): body is SetupRequest {
    return Boolean(body.login && body.password && body.orgName);
}

async function performSystemSetup(data: SetupRequest, session: mongoose.ClientSession): Promise<string> {
    const { orgName, login, password } = data;

    const [rootOrg] = await OrgUnit.create(
        [{
            name: orgName,
            type: 'root',
            path: ','
        }],
        { session }
    );

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await User.create(
        [{
            login,
            passwordHash,
            role: 'root',
            orgUnitId: rootOrg._id
        }],
        { session }
    );

    return signToken({
        userId: user._id.toString(),
        role: user.role,
        orgUnitId: user.orgUnitId.toString()
    });
}
