const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../src/security/validation');
const { hashPassword } = require('../src/security/auth');
const { formatError, operationLimit } = require('../src/server');
const { parse } = require('graphql');
test('rechaza IDs, fechas imposibles, coordenadas y valores negativos', () => {
    for (const data of [{ id_perro: 0 }, { fecha_cita: '2026-02-30' }, { fecha_cita: '2026-10-19 25:00:00' }, { latitud: 91 }, { longitud: -181 }, { peso: -1 }, { edad: -1 }]) assert.throws(() => validate(data));
    assert.doesNotThrow(() => validate({ fecha_cita: '2024-02-29 10:30:00', latitud: 90, longitud: -180 }));
});
test('normaliza correo y rechaza campos requeridos vacíos o nulos', () => {
    assert.equal(validate({ correo: ' User@Example.com ' }).correo, 'user@example.com');
    assert.throws(() => validate({ correo: 'invalid' }));
    for (const nombre of [null, '   ']) assert.throws(() => validate({ nombre }, ['nombre']));
});
test('limita contraseñas por bytes para evitar truncamiento bcrypt', async () => {
    await assert.rejects(hashPassword('short'));
    await assert.rejects(hashPassword('é'.repeat(37)));
});
test('los errores internos no revelan SQL ni trazas', () => {
    const error = formatError({ message: 'SQL password=secret', extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['secret'] } });
    assert.ok(!JSON.stringify(error).includes('secret'));
});
test('limita consultas con fragmentos repetidos antes de resolver', async () => {
    const document = parse(`{ ${Array.from({length: 101}, (_, i) => `a${i}: razas { ...F }`).join(' ')} } fragment F on Raza { id_raza }`);
    const hooks = await operationLimit.requestDidStart();
    await assert.rejects(hooks.didResolveOperation({ document, operation: document.definitions[0] }));
});

test('rechaza autenticación con 503 si Redis no puede verificar la sesión', async () => {
    const jwt = require('jsonwebtoken');
    const { randomUUID } = require('node:crypto');
    const { redisClient } = require('../src/database/redis');
    const { contextForRequest } = require('../src/security/auth');
    const before = redisClient.get;
    const secretBefore = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';
    const token = jwt.sign({ id_usuario: 1 }, process.env.JWT_SECRET, { algorithm: 'HS256', jwtid: randomUUID(), issuer: 'pawly-api', audience: 'pawly', expiresIn: 60 });
    redisClient.get = async () => { throw new Error('offline'); };
    try {
        await assert.rejects(contextForRequest({ headers: { authorization: `Bearer ${token}` } }), error => error.extensions.code === 'SERVICE_UNAVAILABLE' && error.extensions.http.status === 503);
    } finally {
        redisClient.get = before;
        if (secretBefore === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = secretBefore;
    }
});
