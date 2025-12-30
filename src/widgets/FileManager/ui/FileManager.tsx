'use client';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Folder, FileVideo, FileImage, MoreVertical } from 'lucide-react';

export const FileManager = () => {
    const [path, setPath] = useState<string[]>([]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop: (files) => {
        }
    });

    return (
        <div className="h-full flex flex-col bg-gray-950 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Materials</h2>
                <div {...getRootProps()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded cursor-pointer">
                    <input {...getInputProps()} />
                    Upload
                </div>
            </div>

            <div className="flex gap-2 text-gray-400 mb-4">
                <span onClick={() => setPath([])} className="cursor-pointer hover:text-white">Home</span>
                {path.map(p => <span key={p}>/ {p}</span>)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {['Folder A', 'Folder B'].map(f => (
                    <div key={f} className="aspect-square bg-gray-900 rounded-lg flex flex-col items-center justify-center border border-gray-800 hover:border-blue-500 cursor-pointer">
                        <Folder size={48} className="text-yellow-500 mb-2" />
                        <span className="text-gray-300 text-sm">{f}</span>
                    </div>
                ))}

                {['video1.mp4', 'banner.jpg'].map(f => (
                    <div key={f} className="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                        <img src={`/api/proxy/static/${f}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-white truncate">
                            {f}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
