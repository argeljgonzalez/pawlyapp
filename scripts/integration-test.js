// Prueba un servidor aislado en el puerto 4001 usando la base local de Compose.
// Solo elimina los registros que crea. No requiere configurar un administrador real.
require('dotenv').config();
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/database/db');
const { hashPassword } = require('../src/security/auth');
const { connectMongo, closeMongo } = require('../src/database/mongo');
const { connectRedis, closeRedis, redisClient } = require('../src/database/redis');
const { Historial } = require('../src/models/HistorialMedico');
const { keysKey, versionKey } = require('../src/services/history-cache');
const fs = require('node:fs');
const sessions = [];
const created = [];
let output = '';
const run = Date.now();
let server;
let serverExit;
let adminToken;
let ownerToken;
let outsiderToken;
const encode = data => Object.entries(data).map(([key, val]) => `${key}:${JSON.stringify(val)}`).join(',');
async function request(query, token, expected) {
    const response = await fetch('http://127.0.0.1:4001/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (expected) {
        assert.equal(body.errors?.[0]?.extensions?.code, expected, JSON.stringify(body));
        if (expected === 'UNAUTHENTICATED') assert.equal(response.status, 401);
        assert.ok(!JSON.stringify(body).includes('stacktrace'));
        return;
    }
    assert.ok(!body.errors && body.data, JSON.stringify(body));
    return body.data;
}
async function add(entity, table, id, data, token, fields = '') {
    const value = (await request(`mutation { add${entity}(${encode(data)}) { ${id} ${fields} } }`, token))['add' + entity];
    created.push({ table, id, value: value[id] });
    return value;
}
async function login(correo, contrasena = 'local-test-password') {
    const token = (await request(`mutation { login(${encode({ correo, contrasena })}) { token } }`)).login.token;
    sessions.push(jwt.decode(token).jti);
    return token;
}
(async () => {
    try {
        await Promise.all([connectMongo(), connectRedis()]);
        const [adminId] = await db('usuarios').insert({ nombre: 'Docker Admin Test', apellido: 'Temporal', correo: `admin-${run}@example.invalid`, contrasena: await hashPassword('local-test-password'), estado: 'activo' });
        created.push({ table: 'usuarios', id: 'id_usuario', value: adminId });
        server = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT: '4001', ADMIN_USER_IDS: String(adminId) }, stdio: ['ignore', 'pipe', 'pipe'] });
        server.stdout.on('data', data => { output += data; });
        server.stderr.on('data', data => { output += data; });
        serverExit = once(server, 'exit');
        for (let i = 0; i < 300 && !output.includes('Pawly API lista'); i++) {
            if (server.exitCode !== null) throw new Error(output);
            await delay(100);
        }
        assert.ok(output.includes('Pawly API lista'), output);
        adminToken = await login(`admin-${run}@example.invalid`);
        const ownerMail = `owner-${run}@example.invalid`;
        const owner = await add('Usuario', 'usuarios', 'id_usuario', { nombre: 'Owner', apellido: 'Test', correo: ownerMail, contrasena: 'local-test-password' });
        const outsider = await add('Usuario', 'usuarios', 'id_usuario', { nombre: 'Other', apellido: 'Test', correo: `other-${run}@example.invalid`, contrasena: 'local-test-password' });
        ownerToken = await login(ownerMail);
        outsiderToken = await login(`other-${run}@example.invalid`);
        const stored = await db('usuarios').where(owner).first();
        assert.notEqual(stored.contrasena, 'local-test-password');
        assert.ok(await bcrypt.compare('local-test-password', stored.contrasena));
        await request('{ me { contrasena } }', ownerToken, 'GRAPHQL_VALIDATION_FAILED');
        await request('{ perros { id_perro } }', undefined, 'UNAUTHENTICATED');
        await request('{ me { id_usuario } }', undefined, 'UNAUTHENTICATED');
        await request('{ me { id_usuario } }', 'invalid', 'UNAUTHENTICATED');
        const expired = jwt.sign({ id_usuario: owner.id_usuario }, process.env.JWT_SECRET, { algorithm: 'HS256', issuer: 'pawly-api', audience: 'pawly', expiresIn: -1 });
        await request('{ me { id_usuario } }', expired, 'UNAUTHENTICATED');
        await request('{ me { id_usuario } }', jwt.sign({ id_usuario: owner.id_usuario }, 'different-secret'), 'UNAUTHENTICATED');
        await request('mutation { login(correo:"missing@example.invalid", contrasena:"bad") { token } }', undefined, 'UNAUTHENTICATED');
        await request(`mutation { addUsuario(nombre:"X",apellido:"X",correo:"${ownerMail}",contrasena:"local-test-password") { id_usuario } }`, undefined, 'CONFLICT');
        await request('mutation { addRaza(nombre_raza:"No",tamano:"Mediano") { id_raza } }', ownerToken, 'FORBIDDEN');
        const raza = await add('Raza', 'razas', 'id_raza', { nombre_raza: 'Test', tamano: 'Mediano' }, adminToken);
        const perro = await add('Perro', 'perros', 'id_perro', { ...owner, ...raza, nombre: 'Test', sexo: 'Macho', peso: 10.5, fecha_nacimiento: '2024-01-02' }, ownerToken, 'peso fecha_nacimiento');
        assert.equal(perro.peso, 10.5);
        assert.equal(perro.fecha_nacimiento, '2024-01-02');
        const dogId = perro.id_perro;
        const ubi = await add('Ubicacion', 'ubicaciones', 'id_ubicacion', { id_perro: dogId, latitud: 28.63, longitud: -106.07 }, ownerToken);
        const tipo = await add('TipoRecordatorio', 'tipos_recordatorio', 'id_tipo_recordatorio', { nombre_tipo: 'Test' }, adminToken);
        const reminder = await add('Recordatorio', 'recordatorios', 'id_recordatorio', { id_perro: dogId, ...tipo, titulo: 'Test', fecha_programada: '2026-10-20 10:00:00' }, ownerToken);
        const cartilla = await add('CartillaVacunacion', 'cartillas_vacunacion', 'id_cartilla', { id_perro: dogId }, ownerToken);
        const vacuna = await add('Vacuna', 'vacunas', 'id_vacuna', { nombre_vacuna: 'Test', requiere_refuerzo: true }, adminToken, 'requiere_refuerzo');
        assert.equal(vacuna.requiere_refuerzo, true);
        const detalle = await add('CartillaDetalle', 'cartilla_detalle', 'id_detalle_cartilla', { ...cartilla, id_vacuna: vacuna.id_vacuna, fecha_aplicacion: '2026-10-19' }, ownerToken);
        const cita = await add('CitaVeterinaria', 'citas_veterinarias', 'id_cita', { id_perro: dogId, fecha_cita: '2026-10-20 10:00:00', veterinaria: 'Test', motivo: 'Test' }, ownerToken);
        const historial = await add('HistorialMedico', 'historial_medico', 'id_historial', { id_perro: dogId, tipo_registro: 'Test', descripcion: 'Test' }, ownerToken);
        const post = await add('Publicacion', 'publicaciones', 'id_publicacion', { ...owner, titulo: 'Test', contenido: 'Test' }, ownerToken);
        const privates = [['Usuario', 'usuarios', 'usuario', owner], ['Perro', 'perros', 'perro', { id_perro: dogId }], ['Ubicacion', 'ubicaciones', 'ubicacion', ubi], ['Recordatorio', 'recordatorios', 'recordatorio', reminder], ['CartillaVacunacion', 'cartillasVacunacion', 'cartillaVacunacion', cartilla], ['CartillaDetalle', 'cartillaDetalles', 'cartillaDetalle', detalle], ['CitaVeterinaria', 'citasVeterinarias', 'citaVeterinaria', cita], ['HistorialMedico', 'historialesMedicos', 'historialMedico', historial], ['Publicacion', 'publicaciones', 'publicacion', post]];
        for (const [entity, list, one, ident] of privates) {
            const key = Object.keys(ident)[0];
            assert.equal((await request(`{ ${one}(${encode(ident)}) { ${key} } }`, outsiderToken))[one], null);
            assert.ok(!(await request(`{ ${list} { ${key} } }`, outsiderToken))[list].some(x => x[key] === ident[key]));
            await request(`mutation { update${entity}(${encode(ident)}) { ${key} } }`, outsiderToken, 'NOT_FOUND');
            await request(`mutation { delete${entity}(${encode(ident)}) }`, outsiderToken, 'NOT_FOUND');
        }
        await request(`mutation { addUbicacion(id_perro:${dogId},latitud:0,longitud:0) { id_ubicacion } }`, outsiderToken, 'FORBIDDEN');
        await request(`mutation { addCartillaDetalle(id_cartilla:${cartilla.id_cartilla},id_vacuna:${vacuna.id_vacuna}) { id_detalle_cartilla } }`, outsiderToken, 'FORBIDDEN');
        await request(`mutation { updatePerro(id_perro:${dogId},id_usuario:${outsider.id_usuario}) { id_perro } }`, ownerToken, 'FORBIDDEN');
        const otherDog = await add('Perro', 'perros', 'id_perro', { ...outsider, ...raza, nombre: 'Other dog', sexo: 'Macho' }, outsiderToken);
        await request(`mutation { updateUbicacion(${encode(ubi)},id_perro:${otherDog.id_perro}) { id_ubicacion } }`, ownerToken, 'FORBIDDEN');
        await request(`mutation { updateCartillaDetalle(${encode(detalle)},id_cartilla:${cartilla.id_cartilla}) { id_detalle_cartilla } }`, outsiderToken, 'NOT_FOUND');
        await request(`mutation { updatePerro(id_perro:${dogId},nombre:null) { id_perro } }`, ownerToken, 'BAD_USER_INPUT');
        await request('{ perros(limit:101) { id_perro } }', ownerToken, 'BAD_USER_INPUT');
        await request(`mutation { deletePerro(id_perro:${dogId}) }`, ownerToken, 'CONFLICT');
        assert.equal((await request(`mutation { updatePerro(id_perro:${dogId},nombre:"Actualizado") { nombre } }`, ownerToken)).updatePerro.nombre, 'Actualizado');
        // Un dueño puede registrar más de una mascota; cada historial se aísla por mascota.
        const second = await add('Perro', 'perros', 'id_perro', { ...owner, ...raza, nombre: 'Max', sexo: 'Macho' }, ownerToken);
        const secondHistory = await add('HistorialMedico', 'historial_medico', 'id_historial', { ...second, tipo_registro: 'Consulta', descripcion: 'Max' }, ownerToken);
        const firstQuery = `{ historialesMedicos(id_perro:${dogId}) { id_historial descripcion } }`;
        const secondQuery = `{ historialesMedicos(id_perro:${second.id_perro}) { id_historial descripcion } }`;
        const firstRows = (await request(firstQuery, ownerToken)).historialesMedicos;
        assert.equal(firstRows.length, 1);
        assert.deepEqual((await request(firstQuery, ownerToken)).historialesMedicos, firstRows);
        const cacheKeys = await redisClient.sMembers(keysKey(dogId));
        assert.ok(cacheKeys.length > 0);
        assert.ok((await redisClient.ttl(cacheKeys[0])) > 0);
        const addedAfterCache = await add('HistorialMedico', 'historial_medico', 'id_historial', { id_perro: dogId, tipo_registro: 'Temporal', descripcion: 'Prueba de invalidación al crear' }, ownerToken);
        for (const key of cacheKeys) assert.equal(await redisClient.exists(key), 0);
        assert.equal((await request(firstQuery, ownerToken)).historialesMedicos.length, 2);
        await request(`mutation { deleteHistorialMedico(${encode(addedAfterCache)}) }`, ownerToken);
        await request(secondQuery, ownerToken);
        const secondKeys = await redisClient.sMembers(keysKey(second.id_perro));
        await request(firstQuery, outsiderToken, 'FORBIDDEN');
        assert.equal((await request(`{ resumenHistorialMedico { tipo_registro cantidad } }`, ownerToken)).resumenHistorialMedico.reduce((n,r) => n+r.cantidad, 0), 2);
        await request(`mutation { updateHistorialMedico(${encode(historial)}, descripcion:"Actualizado") { id_historial } }`, ownerToken);
        for (const key of cacheKeys) assert.equal(await redisClient.exists(key), 0);
        assert.equal(await redisClient.exists(secondKeys[0]), 1);
        assert.equal((await request(firstQuery, ownerToken)).historialesMedicos[0].descripcion, 'Actualizado');
        // Mover un registro entre mascotas propias invalida ambas cachés.
        await request(`mutation { updateHistorialMedico(${encode(historial)}, id_perro:${second.id_perro}) { id_historial } }`, ownerToken);
        assert.equal((await request(firstQuery, ownerToken)).historialesMedicos.length, 0);
        assert.equal((await request(secondQuery, ownerToken)).historialesMedicos.length, 2);
        await request(`mutation { deleteHistorialMedico(${encode(historial)}) }`, ownerToken);
        assert.equal((await request(secondQuery, ownerToken)).historialesMedicos.length, 1);
        for (let i=0; i<5; i++) await request(secondQuery, ownerToken);
        // Expirar de verdad la página cacheada y comprobar que vuelve a MongoDB.
        const activeKeys = await redisClient.sMembers(keysKey(second.id_perro));
        for (const key of activeKeys) await redisClient.expire(key, 1);
        await delay(1100);
        await request(secondQuery, ownerToken);
        // TTL real de sesión, revocación inmediata y cierre aislado por jti.
        const firstSession = jwt.decode(ownerToken).jti;
        assert.ok((await redisClient.ttl(`sesion:${firstSession}`)) > 0);
        const otherSession = await login(ownerMail);
        assert.equal((await request('mutation { logout }', ownerToken)).logout, true);
        assert.equal(await redisClient.exists(`sesion:${firstSession}`), 0);
        await request('{ me { id_usuario } }', ownerToken, 'UNAUTHENTICATED');
        await request('{ me { id_usuario } }', otherSession);
        await redisClient.expire(`sesion:${jwt.decode(otherSession).jti}`, 1);
        await delay(1100);
        await request('{ me { id_usuario } }', otherSession, 'UNAUTHENTICATED');
        ownerToken = await login(ownerMail);
        await request(`mutation { updateUsuario(id_usuario:${owner.id_usuario},contrasena:"new-test-password") { id_usuario } }`, ownerToken);
        await request('{ me { id_usuario } }', ownerToken, 'UNAUTHENTICATED');
        ownerToken = await login(ownerMail, 'new-test-password');
        await db('usuarios').where(owner).update({ estado: 'inactivo' });
        await request('{ me { id_usuario } }', ownerToken, 'UNAUTHENTICATED');
        await request(`mutation { login(correo:"${ownerMail}",contrasena:"new-test-password") { token } }`, undefined, 'UNAUTHENTICATED');
        let rateLimited = false;
        for (let i = 0; i < 21; i++) {
            const res = await fetch('http://127.0.0.1:4001/', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query:'mutation { login(correo:"missing@example.invalid",contrasena:"bad"){token} }'}) });
            const body = await res.json();
            if (body.errors?.[0]?.extensions?.code === 'RATE_LIMITED') { rateLimited = true; break; }
        }
        assert.ok(rateLimited);
        const readings = output.split('\n').filter(line => line.startsWith('{')).map(line => { try { return JSON.parse(line); } catch { return {}; } }).filter(row => row.evento === 'historial_lectura');
        assert.ok(readings.some(row => row.fuente === 'MongoDB'));
        const hits = readings.filter(row => row.fuente === 'Redis').map(row => row.ms).sort((a,b)=>a-b);
        assert.ok(hits.length >= 6);
        const evidence = { timestamp_utc: new Date().toISOString(), tests: 'passed', mongo_first_ms: readings.find(row => row.fuente === 'MongoDB').ms,
            redis_samples: hits.length, redis_min_ms: hits[0], redis_median_ms: hits[Math.floor(hits.length/2)], redis_max_ms: hits.at(-1),
            all_redis_below_1_5_ms: hits.every(ms => ms < 1.5), measurements: readings };
        console.log('EVIDENCIA ' + JSON.stringify(evidence));
        if (process.env.INTEGRATION_REPORT_PATH) fs.writeFileSync(process.env.INTEGRATION_REPORT_PATH, JSON.stringify(evidence,null,2)+'\n');
        console.log('OK: 12 módulos, bcrypt, JWT, aislamiento entre usuarios, permisos de catálogos, validación, errores y límites.');
    } finally {
        if (server && server.exitCode === null) { server.kill('SIGTERM'); await serverExit; }
        for (const item of created.reverse()) {
            if (item.table === 'historial_medico') await Historial.deleteOne({ id_historial: item.value });
            else {
                if (item.table === 'perros') {
                    const keys = await redisClient.sMembers(keysKey(item.value));
                    if (keys.length) await redisClient.del(keys);
                    await redisClient.del([keysKey(item.value), versionKey(item.value)]);
                }
                await db(item.table).where(item.id, item.value).del();
            }
        }
        if (sessions.length) await redisClient.del(sessions.map(id => `sesion:${id}`));
        await Promise.all([db.destroy(), closeMongo(), closeRedis()]);
        console.log('Registros de prueba eliminados.');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
