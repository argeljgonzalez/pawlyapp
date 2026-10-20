// Ejecutar por stdin dentro de la imagen ANTERIOR, antes de migrar. Solo lectura.
// El mysql2 de la imagen anterior no es dependencia del backend MongoDB.
const mysql = require('mysql2/promise');
(async () => {
    const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
        dateStrings: true, supportBigNumbers: true });
    try {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const tables = {};
        for (const name of ['usuarios','razas','perros','ubicaciones','tipos_recordatorio','recordatorios','cartillas_vacunacion','vacunas','cartilla_detalle','citas_veterinarias','historial_medico','publicaciones']) {
            const [rows] = await db.query('SELECT * FROM `' + name + '`'); tables[name] = rows;
        }
        await db.commit();
        process.stdout.write(JSON.stringify({ format: 'pawly-mysql-v1', exportedAt: new Date().toISOString(), tables }));
    } finally { await db.end(); }
})().catch(() => { console.error('No se pudo exportar MySQL. Revisa conexión y credenciales de la imagen anterior.'); process.exitCode=1; });
