import { Log } from '@/shared/lib/db/models';

interface LogPayload {
    action: string;
    details?: any;
    req?: Request | any;
    level?: 'info' | 'warn' | 'error';
    orgUnitId?: string | null;
}

export const logger = async ({ action, details, req, level = 'info', orgUnitId }: LogPayload) => {
    try {
        let actorId = 'system';
        let inferredOrgId = orgUnitId;

        if (req && req.headers) {
            const userId = req.headers.get('x-user-id');
            if (userId) actorId = userId;

            if (!inferredOrgId) {
                const headerOrg = req.headers.get('x-user-org');
                if (headerOrg && headerOrg !== 'undefined') inferredOrgId = headerOrg;
            }
        }

        await Log.create({
            level,
            action,
            details,
            actorId,
            orgUnitId: inferredOrgId,
            timestamp: new Date()
        });
    } catch (e) {
        console.error('Failed to write log:', e);
    }
};
