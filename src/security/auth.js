const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('node:crypto');
const { redisClient, ttl } = require('../database/redis');
const db = require('../database/repository');
const { fail } = require('./errors');
const version = hash => createHash('sha256').update(hash).digest('hex');
const isHash = value => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value || '');
const active = user => user && String(user.estado).toLowerCase() === 'activo';
const admin = id => (process.env.ADMIN_USER_IDS || '').split(',').map(x => x.trim()).includes(String(id));
async function hashPassword(value) {
    if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
        fail('La contraseña debe tener al menos 8 caracteres y no exceder 72 bytes.');
    }
    return bcrypt.hash(value, 12);
}
async function generateToken(user) {
    const seconds = ttl('SESSION_TTL', 3600);
    const jti = randomUUID();
    const token = jwt.sign({ id_usuario: user.id_usuario, version: version(user.contrasena) }, process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: seconds, jwtid: jti, issuer: 'pawly-api', audience: 'pawly' });
    await redisClient.set(`sesion:${jti}`, String(user.id_usuario), { EX: seconds });
    return token;
}
async function logout(_, __, context) {
    if (!context.user || !context.jti) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
    await redisClient.del(`sesion:${context.jti}`);
    return true;
}
async function contextForRequest(req) {
    const context = { user: null, ip: req.ip || req.socket?.remoteAddress || 'unknown' };
    const header = req.headers.authorization;
    if (!header) return context;
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) fail('Sesión inválida. Inicia sesión de nuevo.', 'UNAUTHENTICATED');
    let payload;
    try {
        payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'pawly-api', audience: 'pawly' });
    } catch { fail('Sesión inválida o vencida.', 'UNAUTHENTICATED'); }
    if (!Number.isInteger(payload.id_usuario)) fail('Sesión inválida.', 'UNAUTHENTICATED');
    if (typeof payload.jti !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.jti)) fail('Sesión inválida.', 'UNAUTHENTICATED');
    let session;
    try { session = await redisClient.get(`sesion:${payload.jti}`); }
    catch { fail('No se puede verificar la sesión. Inténtalo más tarde.', 'SERVICE_UNAVAILABLE'); }
    if (session !== String(payload.id_usuario)) fail('Sesión cerrada o vencida.', 'UNAUTHENTICATED');
    const user = await db.one('usuarios', { id_usuario: payload.id_usuario });
    if (!active(user) || payload.version !== version(user.contrasena)) fail('Sesión inválida.', 'UNAUTHENTICATED');
    context.jti = payload.jti;
    context.user = { id_usuario: user.id_usuario, isAdmin: admin(user.id_usuario) };
    return context;
}
module.exports = { hashPassword, generateToken, contextForRequest, isHash, active, logout };
