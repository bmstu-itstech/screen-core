'use client';
import { useState, useEffect } from 'react';
import { FolderTree, Plus, ChevronRight, ChevronDown } from 'lucide-react';

type Node = {
    _id: string;
    name: string;
    type: string;
    parentId: string | null;
    children?: Node[];
};

const TreeNode = ({ node, onSelect }: { node: Node; onSelect: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="ml-4 border-l border-gray-700 pl-2">
            <div className="flex items-center gap-2 py-1 cursor-pointer hover:text-blue-400 group">
                {hasChildren && (
                    <button onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                )}
                {!hasChildren && <div className="w-3.5" />}

                <FolderTree size={16} className="text-gray-500 group-hover:text-blue-400" />
                <span onClick={() => onSelect(node._id)}>{node.name}</span>
                <span className="text-xs text-gray-600 bg-gray-900 px-1 rounded border border-gray-800">{node.type}</span>
            </div>
            {isOpen && hasChildren && (
                <div>
                    {node.children!.map(child => (
                        <TreeNode key={child._id} node={child} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const StructureTree = () => {
    const [tree, setTree] = useState<Node[]>([]);

    useEffect(() => {
        fetch('/api/structure')
            .then(res => res.json())
            .then(data => {
                const nodes = buildTree(data);
                setTree(nodes);
            });
    }, []);

    const buildTree = (items: any[]) => {
        const rootItems: any[] = [];
        const lookup: any = {};
        items.forEach(item => {
            lookup[item._id] = { ...item, children: [] };
        });
        items.forEach(item => {
            if (item.parentId) {
                lookup[item.parentId]?.children.push(lookup[item._id]);
            } else {
                rootItems.push(lookup[item._id]);
            }
        });
        return rootItems;
    };

    return (
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <h3 className="text-white font-bold mb-4 flex justify-between">
                Structure
                <button className="p-1 hover:bg-gray-800 rounded"><Plus size={16} /></button>
            </h3>
            {tree.map(node => (
                <TreeNode key={node._id} node={node} onSelect={(id) => console.log('Selected', id)} />
            ))}
        </div>
    );
};
