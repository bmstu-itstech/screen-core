import amqp from 'amqplib';

let channel: amqp.Channel | null = null;

export const getAmqpChannel = async () => {
    if (channel) return channel;
    try {
        const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost');
        channel = await connection.createChannel();
        await channel.assertExchange('screencore_events', 'topic', { durable: true });
        return channel;
    } catch (e) {
        console.error('RabbitMQ connection failed', e);
        return null;
    }
};

export const publishEvent = async (routingKey: string, data: any) => {
    const ch = await getAmqpChannel();
    if (ch) {
        ch.publish('screencore_events', routingKey, Buffer.from(JSON.stringify(data)));
    }
};
