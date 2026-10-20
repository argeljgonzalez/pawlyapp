const { performance } = require('node:perf_hooks');
const { redisClient, ttl } = require('../database/redis');
const versionKey = id => `historial:mascota:${id}:version`;
const keysKey = id => `historial:mascota:${id}:claves`;
async function cachedHistory(id, page, load) {
    const version = await redisClient.get(versionKey(id)) || '0';
    const key = `historial:mascota:${id}:v${version}:${page}`;
    const startRedis = performance.now();
    const cached = await redisClient.get(key);
    const redisMs = performance.now() - startRedis;
    if (cached !== null) {
        console.log(JSON.stringify({ evento: 'historial_lectura', fuente: 'Redis', id_perro: id, ms: Number(redisMs.toFixed(3)) }));
        return JSON.parse(cached);
    }
    const startMongo = performance.now();
    const rows = await load();
    const mongoMs = performance.now() - startMongo;
    const seconds = ttl('HISTORY_CACHE_TTL', 60);
    await redisClient.sAdd(keysKey(id), key);
    await redisClient.expire(keysKey(id), seconds * 2);
    await redisClient.set(key, JSON.stringify(rows), { EX: seconds });
    // Si hubo una escritura mientras se cargaba Mongo, no conservar una copia vieja.
    if ((await redisClient.get(versionKey(id)) || '0') !== version) await redisClient.del(key);
    console.log(JSON.stringify({ evento: 'historial_lectura', fuente: 'MongoDB', id_perro: id, ms: Number(mongoMs.toFixed(3)), redis_miss_ms: Number(redisMs.toFixed(3)) }));
    return rows;
}
async function invalidateHistory(id) {
    // Primero cambia la versión: ninguna lectura nueva reutiliza claves anteriores.
    await redisClient.incr(versionKey(id));
    const keys = await redisClient.sMembers(keysKey(id));
    if (keys.length) {
        await redisClient.del(keys);
        await redisClient.sRem(keysKey(id), keys);
    }
}
module.exports = { cachedHistory, invalidateHistory, versionKey, keysKey };
