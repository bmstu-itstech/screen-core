import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { Material } from '@/shared/lib/db/models';
import { unlink } from 'fs/promises';
import path from 'path';
import { logger } from '@/shared/lib/logger';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

interface MaterialDocument {
    _id: string;
    filename: string;
    title: string;
    type: string;
    folderId?: string;
    createdAt?: Date;
}

interface DeleteRequestBody {
    id: string;
}

const createErrorResponse = (message: string, status: number) =>
    NextResponse.json({ error: message }, { status });

async function deleteFileFromDisk(filename: string): Promise<void> {
    try {
        const filePath = path.join(UPLOAD_DIR, filename);
        await unlink(filePath);
    } catch {

    }
}

async function getMaterialsService(folderId: string) {
    return Material.find({ folderId }).sort({ createdAt: -1 }).lean();
}

async function logDeletion(file: MaterialDocument, req: NextRequest) {
    await logger({
        action: 'MEDIA_DELETE',
        level: 'warn',
        details: {
            title: file.title,
            filename: file.filename,
            type: file.type,
            id: file._id
        },
        req
    });
}

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get('folderId') ?? 'root';

        const files = await getMaterialsService(folderId);

        return NextResponse.json(files);
    } catch {
        return createErrorResponse('Internal Server Error', 500);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await connectDB();

        const body = await req.json() as Partial<DeleteRequestBody>;
        if (!body.id) {
            return createErrorResponse('File ID required', 400);
        }

        const file = await Material.findById(body.id) as MaterialDocument | null;
        if (!file) {
            return createErrorResponse('Not found', 404);
        }

        await deleteFileFromDisk(file.filename);
        await Material.findByIdAndDelete(body.id);
        await logDeletion(file, req);

        return NextResponse.json({ success: true });
    } catch {
        return createErrorResponse('Internal Server Error', 500);
    }
}
