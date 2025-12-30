import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { connectDB } from '@/shared/lib/db/connect';
import { Material } from '@/shared/lib/db/models';
import { logger } from "@/shared/lib/logger";

const UPLOAD_FOLDER = 'uploads';
const DEFAULT_FOLDER_ID = 'root';

interface FileMeta {
    filename: string;
    originalName: string;
    type: 'video' | 'image';
    folderId: string;
}

async function saveFileToDisk(file: File): Promise<string> {
    const uploadDir = path.join(process.cwd(), UPLOAD_FOLDER);
    await mkdir(uploadDir, { recursive: true });

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${sanitizedName}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return filename;
}

async function createMaterialRecord(meta: FileMeta) {
    return Material.create({
        title: meta.originalName,
        filename: meta.filename,
        type: meta.type,
        folderId: meta.folderId
    });
}

async function logUploadAction(req: NextRequest, meta: FileMeta) {
    await logger({
        action: 'MEDIA_UPLOAD',
        details: {
            title: meta.originalName,
            type: meta.type,
            folderId: meta.folderId
        },
        req
    });
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const folderId = (formData.get('folderId') as string) || DEFAULT_FOLDER_ID;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const filename = await saveFileToDisk(file);

        const fileMeta: FileMeta = {
            filename,
            originalName: file.name,
            type: file.type.startsWith('video') ? 'video' : 'image',
            folderId
        };

        const material = await createMaterialRecord(fileMeta);

        await logUploadAction(req, fileMeta);

        return NextResponse.json(material);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
