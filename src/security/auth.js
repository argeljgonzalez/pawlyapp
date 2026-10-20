const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const db = require('../database/db');
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
function generateToken(user) {
    return jwt.sign({ id_usuario: user.id_usuario, version: version(user.contrasena) }, process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h', issuer: 'pawly-api', audience: 'pawly' });
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
    const user = await db('usuarios').where({ id_usuario: payload.id_usuario }).first();
    if (!active(user) || payload.version !== version(user.contrasena)) fail('Sesión inválida.', 'UNAUTHENTICATED');
    context.user = { id_usuario: user.id_usuario, isAdmin: admin(user.id_usuario) };
    return context;
}
module.exports = { hashPassword, generateToken, contextForRequest, isHash, active };
