// API detenida. Importación local, repetible, transaccional y sin sobrescritura.
require('dotenv').config();
const fs=require('node:fs');
const assert=require('node:assert/strict');
const db=require('../src/database/repository');
const {Counter}=require('../src/models/HistorialMedico');
const {connectMongo,closeMongo}=require('../src/database/mongo');
const {connectRedis,closeRedis}=require('../src/database/redis');
const {invalidateHistory}=require('../src/services/history-cache');
const names=['usuarios','razas','perros','ubicaciones','tipos_recordatorio','recordatorios','cartillas_vacunacion','vacunas','cartilla_detalle','citas_veterinarias','historial_medico','publicaciones'];
const comparable=row=>Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null && v!==undefined));
async function importData(input) {
    if (input.format!=='pawly-mysql-v1' || !input.tables || names.some(n=>!Array.isArray(input.tables[n])) || Object.keys(input.tables).some(n=>!names.includes(n))) throw new Error('Formato de exportación incorrecto o incompleto.');
    return db.transaction(async()=>{
        const counts={};
        for (const source of names) {
            const name=source==='historial_medico'?'historiales_medicos':source;
            const model=db.models[name], id=db.specs[name].id;
            const seen=new Set();let inserted=0;
            for (const data of input.tables[source]) {
                if (!Number.isInteger(data[id]) || data[id]<1 || data[id]>2147483647 || seen.has(data[id])) throw new Error(`ID inválido o repetido en ${source}.`);
                seen.add(data[id]);
                // Aplicar los mismos tipos y validadores que la API, sin generar IDs nuevos.
                const document=new model(data);await document.validate();
                const row=db.serialize(name,document);
                const old=await db.one(name,{[id]:data[id]});
                if (old) {
                    try {assert.deepEqual(comparable(old),comparable(row));}
                    catch {throw new Error(`Conflicto en ${source}, ID ${data[id]}. Se canceló toda la importación.`);}
                } else {await model.create([row],db.options());inserted++;}
            }
            counts[source]={exported:input.tables[source].length,inserted};
        }
        for (const [name,spec] of Object.entries(db.specs)) {
            // Incluye historiales que ya existían en MongoDB.
            const rows=await db.find(name);
            for (const row of rows) await db.references(name,row);
            const max=rows.reduce((n,r)=>Math.max(n,r[spec.id]),0);
            await Counter.updateOne({_id:spec.counter||name},{$max:{seq:max}},{...db.options(),upsert:true});
        }
        return counts;
    });
}
async function main() {
    if (!process.argv[2]) throw new Error('Uso: npm run migrate:mysql -- /ruta/mysql-export.json');
    const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    await connectMongo();await connectRedis();
    const counts=await importData(input);
    // La transacción Mongo ya terminó: Redis sigue siendo la misma caché.
    for (const dog of await db.find('perros')) await invalidateHistory(dog.id_perro);
    console.log(JSON.stringify({status:'imported',counts},null,2));
}
if (require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>Promise.all([closeMongo(),closeRedis()]));
module.exports={importData};
