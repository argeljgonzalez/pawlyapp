// Ejecutar explícitamente después de respaldar la base existente.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/database/db');
const { isHash } = require('../src/security/auth');
(async () => {
    let updated = 0;
    // Transacción: no deja una migración parcial si algún dato es inválido.
    await db.transaction(async trx => {
        const users = await trx('usuarios').select('id_usuario', 'contrasena').forUpdate();
        for (const user of users) {
            if (isHash(user.contrasena)) continue;
            if (typeof user.contrasena !== 'string' || !user.contrasena || Buffer.byteLength(user.contrasena) > 72) {
                throw new Error(`El usuario ${user.id_usuario} requiere restablecer su contraseña antes de migrar.`);
            }
            await trx('usuarios').where({ id_usuario: user.id_usuario }).update({ contrasena: await bcrypt.hash(user.contrasena, 12) });
            updated++;
        }
    });
    console.log(`Contraseñas convertidas: ${updated}.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.destroy());
