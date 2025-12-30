'use client';

import { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import {
    FolderTree, Plus, Trash2, Monitor, Edit2,
    Check, X, Users, UserPlus, Shield, ChevronRight, ChevronDown
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useRouter } from "next/navigation";

interface OrgNode {
    _id: string;
    name: string;
    type: 'root' | 'branch' | 'floor' | 'room';
    parentId: string | null;
}

interface User {
    _id: string;
    login: string;
    role: string;
}

interface NodeMap {
    [key: string]: OrgNode[];
}

const getNodeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        root: 'ВУЗ',
        branch: 'КОРПУС',
        floor: 'ЭТАЖ',
        room: 'УЧАСТОК'
    };
    return labels[type] || '-';
};

const getNextNodeType = (currentType: string): OrgNode['type'] => {
    const map: Record<string, OrgNode['type']> = {
        root: 'branch',
        branch: 'floor',
        floor: 'room',
        room: 'room'
    };
    return map[currentType] || 'branch';
};

const api = {
    fetchStructure: async (): Promise<OrgNode[]> => {
        const res = await fetch('/api/structure');
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    },
    createNode: async (body: Partial<OrgNode>) => {
        const res = await fetch('/api/structure', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res;
    },
    updateNode: async (id: string, name: string) => {
        return fetch(`/api/structure/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
    },
    deleteNode: async (id: string) => {
        return fetch(`/api/structure/${id}`, { method: 'DELETE' });
    },
    fetchAdmins: async (orgUnitId: string): Promise<User[]> => {
        const res = await fetch(`/api/users?orgUnitId=${orgUnitId}`);
        return res.ok ? await res.json() : [];
    },
    createAdmin: async (body: Record<string, string>) => {
        const res = await fetch('/api/users', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res;
    },
    deleteAdmin: async (userId: string) => {
        return fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
    }
};

const TreeItem = ({
                      node,
                      childMap,
                      selectedId,
                      onSelect,
                      depth = 0
                  }: {
    node: OrgNode;
    childMap: NodeMap;
    selectedId: string | null;
    onSelect: (id: string) => void;
    depth?: number;
}) => {
    const children = childMap[node._id] || [];
    const isSelected = selectedId === node._id;

    return (
        <div style={{ marginLeft: depth * 12 }} className="mt-1">
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node._id);
                }}
                className={`
                    flex items-center gap-2 p-2 rounded cursor-pointer transition border border-transparent select-none
                    ${isSelected
                    ? 'bg-blue-900/20 border-blue-500/30 text-blue-100'
                    : 'hover:bg-white/5 text-gray-400'}
                `}
            >
                {children.length > 0 ? (
                    <FolderTree size={16} className={isSelected ? 'text-blue-400' : 'text-gray-600'} />
                ) : (
                    <div className="w-4 h-4" />
                )}
                <span className="text-sm font-medium truncate">{node.name}</span>
                <span className="text-[10px] uppercase bg-white/5 px-1.5 py-0.5 rounded text-gray-500 whitespace-nowrap">
                    {getNodeLabel(node.type)}
                </span>
            </div>
            {children.map(child => (
                <TreeItem
                    key={child._id}
                    node={child}
                    childMap={childMap}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    depth={depth + 1}
                />
            ))}
        </div>
    );
};

const AdminPanel = ({ orgId }: { orgId: string }) => {
    const [admins, setAdmins] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({ login: '', password: '' });

    const load = useCallback(() => {
        api.fetchAdmins(orgId).then(setAdmins);
    }, [orgId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.login || !form.password) return;

        setIsLoading(true);
        try {
            await api.createAdmin({ ...form, orgUnitId: orgId, role: 'admin' });
            setForm({ login: '', password: '' });
            load();
            alert('Администратор создан');
        } catch (err: any) {
            alert(err.error || 'Ошибка создания');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить пользователя?')) return;
        await api.deleteAdmin(id);
        load();
    };

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 flex flex-col h-full">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <Shield size={14}/> Локальные администраторы
            </h3>

            <div className="flex-1 mb-4 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {!admins.length ? (
                    <p className="text-xs text-gray-600 italic">Нет администраторов</p>
                ) : (
                    admins.map(admin => (
                        <div key={admin._id} className="flex justify-between items-center bg-black p-2 rounded border border-gray-800">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs text-gray-400">
                                    <Users size={12}/>
                                </div>
                                <span className="text-sm text-gray-200">{admin.login}</span>
                            </div>
                            <button onClick={() => handleDelete(admin._id)} className="text-gray-600 hover:text-red-500 transition-colors">
                                <X size={14}/>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleCreate} className="space-y-2 pt-4 border-t border-gray-800">
                <input
                    className="w-full bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                    placeholder="Логин"
                    value={form.login}
                    onChange={e => setForm(p => ({ ...p, login: e.target.value }))}
                    required
                />
                <input
                    type="password"
                    className="w-full bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                    placeholder="Пароль"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                />
                <Button size="sm" type="submit" disabled={isLoading} className="w-full mt-2">
                    <UserPlus size={14} className="mr-2"/> Создать
                </Button>
            </form>
        </div>
    );
};

export default function StructurePage() {
    const router = useRouter();
    const [nodes, setNodes] = useState<OrgNode[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [newItemName, setNewItemName] = useState('');

    const loadData = async () => {
        const data = await api.fetchStructure();
        setNodes(data);
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedId) {
            const node = nodes.find(n => n._id === selectedId);
            if (node) {
                setRenameValue(node.name);
                setIsRenaming(false);
            }
        }
    }, [selectedId, nodes]);

    const { rootNodes, childrenMap } = useMemo(() => {
        const map: NodeMap = {};
        const ids = new Set(nodes.map(n => n._id));
        const roots: OrgNode[] = [];

        nodes.forEach(node => {
            if (!node.parentId || !ids.has(node.parentId)) {
                roots.push(node);
            } else {
                if (!map[node.parentId]) map[node.parentId] = [];
                map[node.parentId].push(node);
            }
        });

        return { rootNodes: roots, childrenMap: map };
    }, [nodes]);

    const selectedNode = useMemo(() =>
            nodes.find(n => n._id === selectedId),
        [nodes, selectedId]);

    const handleAddNode = async () => {
        if (!newItemName || !selectedId || !selectedNode) return;

        try {
            await api.createNode({
                name: newItemName,
                type: getNextNodeType(selectedNode.type),
                parentId: selectedId
            });
            await loadData();
            setNewItemName('');
        } catch (e: any) {
            alert(e.error || 'Ошибка');
        }
    };

    const handleRename = async () => {
        if (!selectedId || !renameValue.trim()) return;
        const res = await api.updateNode(selectedId, renameValue);
        if (res.ok) {
            setNodes(prev => prev.map(n => n._id === selectedId ? { ...n, name: renameValue } : n));
            setIsRenaming(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedNode) return;
        if (selectedNode.type === 'root') return alert('Нельзя удалить корневую организацию');
        if (!confirm(`Удалить "${selectedNode.name}" и всё вложенное?`)) return;

        const res = await api.deleteNode(selectedNode._id);
        if (res.ok) {
            setSelectedId(null);
            loadData();
        } else {
            alert('Ошибка удаления');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-6rem)]">
            <div className="glass-panel p-4 rounded-xl flex flex-col bg-black/40 border border-white/10">
                <h2 className="text-lg font-bold text-white mb-4">Структура</h2>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {rootNodes.length > 0 ? rootNodes.map(node => (
                        <TreeItem
                            key={node._id}
                            node={node}
                            childMap={childrenMap}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    )) : (
                        <div className="text-gray-500 text-sm p-4 text-center">Нет данных</div>
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 glass-panel p-6 rounded-xl overflow-y-auto custom-scrollbar bg-black/40 border border-white/10">
                {selectedNode ? (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="flex justify-between items-start border-b border-gray-800 pb-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    {isRenaming ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="bg-black border border-gray-700 rounded px-2 py-1 text-xl font-bold text-white focus:border-blue-500 outline-none"
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => e.key === 'Enter' && handleRename()}
                                            />
                                            <button onClick={handleRename} className="p-1 bg-green-900/50 text-green-400 rounded hover:bg-green-900"><Check size={18}/></button>
                                            <button onClick={() => setIsRenaming(false)} className="p-1 bg-red-900/50 text-red-400 rounded hover:bg-red-900"><X size={18}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 group">
                                            <h2 className="text-3xl font-bold text-white">{selectedNode.name}</h2>
                                            <button onClick={() => setIsRenaming(true)} className="text-gray-600 hover:text-white transition opacity-0 group-hover:opacity-100">
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded">ID: {selectedId}</span>
                                    <span className="text-xs uppercase font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded">{getNodeLabel(selectedNode.type)}</span>
                                </div>
                            </div>

                            {nodes.some(n => n._id === selectedNode.parentId) && (
                                <Button variant="danger" size="sm" onClick={handleDelete} className="opacity-80 hover:opacity-100">
                                    <Trash2 size={16} className="mr-2"/> Удалить узел
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><FolderTree size={14}/> Добавить подраздел</h3>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                            placeholder="Название"
                                            value={newItemName}
                                            onChange={e => setNewItemName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddNode()}
                                        />
                                        <Button size="sm" onClick={handleAddNode} disabled={!newItemName}><Plus size={16}/></Button>
                                    </div>
                                </div>

                                <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-500/20">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                                        <Monitor size={14}/> Эфир
                                    </h3>
                                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                        Настройка контента для всех экранов в этом узле.
                                    </p>
                                    <Button size="sm" className="w-full" variant="primary" onClick={() => router.push(`/admin/structure/${selectedId}`)}>
                                        Настроить вещание
                                    </Button>
                                </div>
                            </div>

                            <AdminPanel orgId={selectedNode._id} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                        <FolderTree size={48} className="opacity-20"/>
                        <p>Выберите элемент структуры</p>
                    </div>
                )}
            </div>
        </div>
    );
}
