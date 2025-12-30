import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { Folder, Material } from '@/shared/lib/db/models';

interface CreateFolderBody {
    name: string;
    parentId?: string;
}

interface DeleteFolderBody {
    id: string;
}

const deleteFolderTree = async (folderId: string): Promise<void> => {
    const subfolders = await Folder.find({ parentId: folderId }).select('_id');

    await Promise.all(subfolders.map((folder) => deleteFolderTree(folder._id.toString())));

    await Promise.all([
        Material.deleteMany({ folderId }),
        Folder.findByIdAndDelete(folderId),
    ]);
};

export async function GET(req: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const parentId = searchParams.get('parentId') || 'root';

        const folders = await Folder.find({ parentId }).sort({ name: 1 }).lean();

        return NextResponse.json(folders);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const body: CreateFolderBody = await req.json();
        const { name, parentId } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        const newFolder = await Folder.create({
            name,
            parentId: parentId || 'root',
        });

        return NextResponse.json(newFolder, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await connectDB();
        const body: DeleteFolderBody = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        await deleteFolderTree(id);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
