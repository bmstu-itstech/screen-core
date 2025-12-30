import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { User, OrgUnit } from '@/shared/lib/db/models';
import bcrypt from 'bcryptjs';
import { logger } from '@/shared/lib/logger';

interface CreateUserBody {
    login?: string;
    password?: string;
    orgUnitId?: string;
    role?: string;
}

interface OrgUnitWithPath {
    _id: unknown;
    path?: string;
}

async function checkHierarchyAccess(
    creatorOrgId: string | null,
    targetOrgId: string
): Promise<boolean> {
    if (creatorOrgId === targetOrgId) return true;

    const targetUnit = await OrgUnit.findById(targetOrgId).select('path').lean() as OrgUnitWithPath | null;

    if (!targetUnit) return false;

    const path = targetUnit.path || '';

    return path.includes(`,${creatorOrgId},`) || path.includes(`/${creatorOrgId}/`);
}

export async function GET(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const orgUnitId = searchParams.get('orgUnitId');

    const query = orgUnitId ? { orgUnitId } : {};

    const users = await User.find(query)
        .select('-passwordHash')
        .lean();

    return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
    await connectDB();

    const creatorRole = req.headers.get('x-user-role');
    const creatorOrgId = req.headers.get('x-user-org');

    const body: CreateUserBody = await req.json();
    const { login, password, orgUnitId, role } = body;

    if (!login || !password) {
        return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const targetRole = role || 'admin';

    if (targetRole === 'root' && creatorRole !== 'root') {
        return NextResponse.json(
            { error: 'Только Root может создавать супер-администраторов' },
            { status: 403 }
        );
    }

    if (creatorRole !== 'root') {
        if (!creatorOrgId) {
            return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 401 });
        }

        if (!orgUnitId) {
            return NextResponse.json({ error: 'Необходимо указать подразделение' }, { status: 400 });
        }

        const isAllowed = await checkHierarchyAccess(creatorOrgId, orgUnitId);
        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Вы не можете назначать администраторов в вышестоящие или чужие подразделения' },
                { status: 403 }
            );
        }
    }

    const userExists = await User.exists({ login });
    if (userExists) {
        return NextResponse.json({ error: 'Пользователь уже существует' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
        login,
        passwordHash,
        role: targetRole,
        orgUnitId
    });

    await logger({
        action: 'USER_CREATE',
        level: 'warn',
        details: {
            newLogin: newUser.login,
            role: newUser.role,
            targetOrg: orgUnitId
        },
        orgUnitId: orgUnitId,
        req
    });

    return NextResponse.json({ id: newUser._id, login: newUser.login });
}

export async function DELETE(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const user = await User.findById(id);

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role === 'root') {
        return NextResponse.json({ error: 'Cannot delete root user' }, { status: 403 });
    }

    await User.deleteOne({ _id: id });

    await logger({
        action: 'USER_DELETE',
        level: 'warn',
        details: {
            deletedLogin: user.login,
            role: user.role
        },
        orgUnitId: user.orgUnitId,
        req
    });

    return NextResponse.json({ success: true });
}
