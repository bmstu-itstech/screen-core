import { useEffect, useRef, useState, useCallback } from 'react';

type SocketMessage = {
    type: string;
    payload?: any;
};

export const useSocket = (url: string, onMessage: (msg: SocketMessage) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

    const onMessageRef = useRef(onMessage);
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        const connect = () => {
            if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

            const socket = new WebSocket(url);

            socket.onopen = () => {
                console.log('WS Connected');
                setIsConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (onMessageRef.current) {
                        onMessageRef.current(data);
                    }
                } catch (e) {
                    console.error('WS Parse Error', e);
                }
            };

            socket.onclose = (event) => {
                setIsConnected(false);
                ws.current = null;

                if (!event.wasClean) {
                    console.log('WS Disconnected unexpectedly. Reconnecting...');
                    reconnectTimeout.current = setTimeout(connect, 3000);
                }
            };

            socket.onerror = (err) => {
                console.warn('WS Error', err);
                socket.close();
            };

            ws.current = socket;
        };

        connect();

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close();
                ws.current = null;
            }
            setIsConnected(false);
        };
    }, [url]);

    const send = useCallback((data: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data));
        } else {
            console.warn('WS not ready, message dropped:', data);
        }
    }, []);

    return { isConnected, send };
};
