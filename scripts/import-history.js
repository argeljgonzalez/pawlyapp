// Ejecutar con la API detenida y un respaldo previo. Conserva el archivo SQL histórico.
require('dotenv').config();
const db = require('../src/database/db');
const { connectMongo, closeMongo } = require('../src/database/mongo');
const { connectRedis, closeRedis } = require('../src/database/redis');
const { Historial, Counter, serialize } = require('../src/models/HistorialMedico');
const { invalidateHistory } = require('../src/services/history-cache');
(async () => {
    await Promise.all([connectMongo(), connectRedis()]);
    const rows = await db('historial_medico').select('*').orderBy('id_historial');
    const newest = await Historial.findOne().sort({ id_historial: -1 }).lean();
    const highest = Math.max(newest?.id_historial || 0, ...rows.map(row => row.id_historial));
    await Counter.updateOne({ _id: 'historial' }, { $max: { seq: highest } }, { upsert: true });
    let inserted = 0;
    for (const row of rows) {
        const data = { id_historial: row.id_historial, id_perro: row.id_perro, tipo_registro: row.tipo_registro,
            descripcion: row.descripcion, fecha_registro: row.fecha_registro, observaciones: row.observaciones };
        if (!await db('perros').where('id_perro', row.id_perro).first()) throw new Error(`Mascota ausente en registro ${row.id_historial}.`);
        const existing = await Historial.findOne({ id_historial: row.id_historial }).lean();
        if (existing) {
            const old = serialize(existing), source = serialize(data);
            if (Object.keys(source).some(key => source[key] !== old[key])) throw new Error(`Conflicto de ID ${row.id_historial}; no se sobrescribió el documento existente.`);
        } else { await Historial.create(data); inserted++; }
        await invalidateHistory(row.id_perro);
    }
    console.log(`Importación terminada. Insertados: ${inserted}. Total SQL revisado: ${rows.length}. La fuente SQL no fue eliminada.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
    await Promise.all([db.destroy(), closeMongo(), closeRedis()]);
});
