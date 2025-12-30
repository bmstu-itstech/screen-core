import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

declare global {
    var redis: ReturnType<typeof createClient> | undefined;
}

const client = global.redis || createClient({
    url: REDIS_URL
});

client.on('error', (err) => console.error('❌ Redis Client Error', err));

if (!client.isOpen) {
    client.connect().then(() => {
        console.log('✅ Connected to Redis');
    }).catch((err) => {
        console.error('❌ Redis Connection Failed:', err);
    });
}

if (process.env.NODE_ENV !== 'production') {
    global.redis = client;
}

export const redis = client;
