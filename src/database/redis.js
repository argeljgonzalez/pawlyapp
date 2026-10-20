const { createClient } = require('redis');
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    disableOfflineQueue: true,
    socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(100 * retries, 2000) }
});
redisClient.on('error', () => console.error('Redis no disponible. Las sesiones requieren conexión activa.'));
async function connectRedis() { if (!redisClient.isOpen) await redisClient.connect(); }
async function closeRedis() { if (redisClient.isOpen) await redisClient.close(); }
function ttl(name, fallback) {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 86400) throw new Error(`${name} debe estar entre 1 y 86400 segundos.`);
    return value;
}
module.exports = { redisClient, connectRedis, closeRedis, ttl };
