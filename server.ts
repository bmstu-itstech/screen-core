import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { createClient } from 'redis';
import mongoose from 'mongoose';
import { Device, OrgUnit } from './src/shared/lib/db/models';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

interface WsMessage {
    type: string;
    payload?: unknown;
    uid?: string;
}

interface DeviceConfig {
    timework: number[];
    playlist: unknown[];
    volume: number;
    type: string;
}

const clients = {
    devices: new Map<string, WebSocket>(),
    admins: new Set<WebSocket>()
};

const pings = new Map<string, number>();

const redisSub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const redisPub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

const getDeviceConfig = async (uid: string): Promise<DeviceConfig> => {
    const device = await Device.findOne({ uid }).populate('playlist.materialId').lean();

    if (!device) return { playlist: [], timework: [0, 86400], volume: 0, type: 'slideshow' };
    if (device.isActive === false) return { playlist: [], timework: [-1, -1], volume: 0, type: 'slideshow' };

    let activeSource = device;

    if (device.orgUnitId) {
        const directUnit = await OrgUnit.findById(device.orgUnitId).lean();
        if (directUnit) {
            const pathIds = directUnit.path ? directUnit.path.split(',').filter(Boolean) : [];
            pathIds.push(directUnit._id.toString());

            const chain = await OrgUnit.find({ _id: { $in: pathIds } })
                .populate('playlist.materialId')
                .lean();

            chain.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));

            for (const unit of chain) {
                if (unit.isActive && unit.playlist && unit.playlist.length > 0) {
                    activeSource = unit;
                    break;
                }
            }
        }
    }

    const playlist = (activeSource.playlist || [])
        .sort((a: { order: number }, b: { order: number }) => (a.order || 0) - (b.order || 0))
        .map((item: any) => {
            const material = item.materialId;
            if (!material) return null;
            return {
                duration: item.duration || 10,
                isMuted: item.isMuted || false,
                content: { title: material.filename, type: material.type }
            };
        })
        .filter(Boolean);

    return {
        timework: Array.isArray(activeSource.timework) && activeSource.timework.length === 2
            ? activeSource.timework
            : [0, 86400],
        playlist,
        volume: activeSource.volume ?? 100,
        type: activeSource.currentMode || 'slideshow'
    };
};

const serveStaticFile = (req: IncomingMessage, res: ServerResponse, fileName: string) => {
    try {
        const safeName = path.normalize(fileName).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(UPLOADS_DIR, safeName);

        if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }

        const stat = statSync(filePath);
        const range = req.headers.range;

        if (range) {
            const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
            const chunkSize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'video/mp4'
            });
            createReadStream(filePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': 'application/octet-stream'
            });
            createReadStream(filePath).pipe(res);
        }
    } catch (e) {
        console.error('Static serve error:', e);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    }
};

const broadcastToAdmins = (msg: WsMessage) => {
    const data = JSON.stringify(msg);
    clients.admins.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(data);
    });
};

app.prepare().then(async () => {
    await mongoose.connect(process.env.DB_URI || 'mongodb://localhost:27017/screencore');
    await Promise.all([redisSub.connect(), redisPub.connect()]);

    console.log('✅ Server Ready');

    redisSub.subscribe('device-updates', (message) => {
        try {
            const { uid, payload } = JSON.parse(message);
            const client = clients.devices.get(uid);

            if (client?.readyState === WebSocket.OPEN) {
                if (payload.type === 'REFRESH') {
                    getDeviceConfig(uid).then(config => {
                        client.send(JSON.stringify({ type: 'INFO', payload: config }));
                    });
                } else {
                    client.send(JSON.stringify({ type: 'UPDATE', payload }));
                }
            }
        } catch (e) { console.error('Redis sub error', e); }
    });

    redisSub.subscribe('system-emergency', (message) => {
        const payload = JSON.parse(message);
        const targetUids = payload.targetUids as string[] | undefined;
        const msgStr = JSON.stringify({ type: 'EMERGENCY', payload });

        if (Array.isArray(targetUids)) {
            targetUids.forEach(uid => {
                const client = clients.devices.get(uid);
                if (client?.readyState === WebSocket.OPEN) client.send(msgStr);
            });
        } else {
            clients.devices.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) ws.send(msgStr);
            });
        }
    });

    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            const { pathname } = parsedUrl;

            if (pathname?.startsWith('/static/')) {
                const fileName = decodeURIComponent(pathname.replace('/static/', ''));
                serveStaticFile(req, res, fileName);
                return;
            }
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error(err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    const wss = new WebSocketServer({ noServer: true });

    setInterval(() => {
        const now = Date.now();
        const msg = JSON.stringify({ type: 'PING', payload: { ts: now } });
        clients.devices.forEach((ws, uid) => {
            if (ws.readyState === WebSocket.OPEN) {
                pings.set(uid, now);
                ws.send(msg);
            }
        });
    }, 5000);

    wss.on('connection', (ws) => {
        let deviceUid: string | null = null;
        let isAdmin = false;

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString()) as WsMessage;

                if (data.type === 'admin-auth') {
                    isAdmin = true;
                    clients.admins.add(ws);
                    return;
                }

                if (data.type === 'auth' && typeof data.uid === 'string') {
                    deviceUid = data.uid;
                    clients.devices.set(deviceUid, ws);

                    await redisPub.set(`device:latency:${deviceUid}`, '1', { EX: 60 });

                    broadcastToAdmins({
                        type: 'DEVICE_STATUS',
                        payload: { uid: deviceUid, status: 'online', latency: 1 }
                    });

                    const [isEmergency, emergencyMode] = await Promise.all([
                        redisPub.get('emergency_active'),
                        redisPub.get('emergency_mode')
                    ]);

                    if (isEmergency === 'true') {
                        ws.send(JSON.stringify({
                            type: 'EMERGENCY',
                            payload: { active: true, mode: emergencyMode || 'fire' }
                        }));
                    }

                    const config = await getDeviceConfig(deviceUid);
                    ws.send(JSON.stringify({ type: 'INFO', payload: config }));
                }

                if (data.type === 'PONG' && deviceUid) {
                    const start = pings.get(deviceUid);
                    if (start) {
                        const latency = Date.now() - start;

                        redisPub.set(`device:latency:${deviceUid}`, latency.toString(), { EX: 60 });

                        broadcastToAdmins({
                            type: 'DEVICE_STATUS',
                            payload: { uid: deviceUid, status: 'online', latency }
                        });
                    }
                }
            } catch (e) { console.error('WS Message error', e); }
        });

        ws.on('close', () => {
            if (isAdmin) clients.admins.delete(ws);
            if (deviceUid) {
                clients.devices.delete(deviceUid);
                pings.delete(deviceUid);
                redisPub.del(`device:latency:${deviceUid}`);
                broadcastToAdmins({
                    type: 'DEVICE_STATUS',
                    payload: { uid: deviceUid, status: 'offline', latency: null }
                });
            }
        });
    });

    server.on('upgrade', (req, socket, head) => {
        if (parse(req.url || '', true).pathname === '/ws') {
            wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
        }
    });

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
