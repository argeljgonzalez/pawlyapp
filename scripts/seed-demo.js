// Dataset ficticio estable; no modifica cuentas ni mascotas preexistentes.
require('dotenv').config();
const { randomBytes } = require('node:crypto');
const db = require('../src/database/db');
const { connectMongo, closeMongo } = require('../src/database/mongo');
const { connectRedis, closeRedis } = require('../src/database/redis');
const { Historial, nextHistoryId } = require('../src/models/HistorialMedico');
const { hashPassword } = require('../src/security/auth');
const { invalidateHistory } = require('../src/services/history-cache');
(async () => {
    await Promise.all([connectMongo(), connectRedis()]);
    const correo = 'demo.parcial2@pawly.example';
    if (await db('usuarios').where({ correo }).first()) {
        console.log('La cuenta demo ya existe; no se modificaron sus datos ni su contraseña.'); return;
    }
    const password = randomBytes(16).toString('hex');
    const result = await db.transaction(async trx => {
        const [id_usuario] = await trx('usuarios').insert({ nombre: 'Ana', apellido: 'Demo', correo, contrasena: await hashPassword(password), estado: 'activo' });
        const [id_raza] = await trx('razas').insert({ nombre_raza: 'Mestizo demo parcial 2', tamano: 'Mediano' });
        const dogs = [];
        for (const nombre of ['Luna', 'Max']) {
            const [id_perro] = await trx('perros').insert({ id_usuario, id_raza, nombre, sexo: 'Sin especificar', edad: 3 });
            dogs.push({ id_perro, nombre });
        }
        return { id_usuario, dogs };
    });
    // Cada evento médico es un documento independiente, escrito atómicamente.
    for (const dog of result.dogs) {
        for (const tipo_registro of ['Consulta', 'Vacunación', ...(dog.nombre === 'Luna' ? ['Consulta'] : [])]) {
            await Historial.create({ id_historial: await nextHistoryId(), id_perro: dog.id_perro, tipo_registro,
                descripcion: `Ejemplo académico de ${tipo_registro.toLowerCase()} para ${dog.nombre}.`, observaciones: 'Datos ficticios para el parcial.' });
        }
        await invalidateHistory(dog.id_perro);
    }
    console.log(JSON.stringify({ correo, contrasena: password, ...result }, null, 2));
    console.log('Guarda esta contraseña localmente; no incluyas la salida en Git.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
    await Promise.all([db.destroy(), closeMongo(), closeRedis()]);
});
