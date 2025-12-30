import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.ACCESS_SECRET || 'secret-key');

export async function signToken(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(SECRET);
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload;
    } catch (e) {
        return null;
    }
}
