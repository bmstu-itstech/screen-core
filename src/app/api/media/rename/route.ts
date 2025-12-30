import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/shared/lib/db/connect';
import { Material } from '@/shared/lib/db/models';

interface UpdateMaterialPayload {
    id: string;
    newTitle: string;
}

async function updateMaterialTitle(id: string, title: string) {
    return Material.findByIdAndUpdate(
        id,
        { title },
        { new: true }
    ).lean().exec();
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const body = await req.json() as Partial<UpdateMaterialPayload>;
        const { id, newTitle } = body;

        if (!id || !newTitle) {
            return NextResponse.json(
                { error: 'Missing id or title' },
                { status: 400 }
            );
        }

        const updatedMaterial = await updateMaterialTitle(id, newTitle);

        if (!updatedMaterial) {
            return NextResponse.json(
                { error: 'Material not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedMaterial);

    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
