// Solo desarrollo: verifica transacciones y referencias con datos temporales.
require('dotenv').config();
const assert=require('node:assert/strict');
const db=require('../src/database/repository');
const {connectMongo,closeMongo}=require('../src/database/mongo');
const {importData}=require('./import-mysql-json');
const created=[];
async function add(name,data) {const row=await db.insert(name,data);created.push([name,row[db.specs[name].id]]);return row;}
async function main() {
 await connectMongo();
 const tag=`integrity-${Date.now()}`;
 const user=await add('usuarios',{nombre:tag,apellido:'Test',correo:`${tag}@example.invalid`,contrasena:'temporary-hash'});
 const breed=await add('razas',{nombre_raza:tag,tamano:'Mediano'});
 const dog=await add('perros',{id_usuario:user.id_usuario,id_raza:breed.id_raza,nombre:tag,sexo:'Macho'});
 await assert.rejects(db.remove('usuarios',{id_usuario:user.id_usuario}),e=>e.extensions.code==='CONFLICT');
 await assert.rejects(db.remove('razas',{id_raza:breed.id_raza}),e=>e.extensions.code==='CONFLICT');
 await assert.rejects(db.update('perros',{id_perro:dog.id_perro},{id_raza:2147483647}),e=>e.extensions.code==='CONFLICT');
 assert.equal((await db.one('perros',{id_perro:dog.id_perro})).id_raza,breed.id_raza);
 await assert.rejects(db.transaction(async()=>{await db.insert('razas',{nombre_raza:tag+'-rollback',tamano:'Grande'});throw Error('rollback');}),/rollback/);
 assert.equal(await db.one('razas',{nombre_raza:tag+'-rollback'}),null);
 const rows=await Promise.all(Array.from({length:5},()=>add('razas',{nombre_raza:tag+'-parallel',tamano:'Grande'})));
 assert.equal(new Set(rows.map(r=>r.id_raza)).size,5);
 const race=await add('perros',{id_usuario:user.id_usuario,id_raza:breed.id_raza,nombre:tag+'-race',sexo:'Macho'});
 const results=await Promise.allSettled([db.remove('perros',{id_perro:race.id_perro}),add('ubicaciones',{id_perro:race.id_perro,latitud:0,longitud:0})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const locations=await db.find('ubicaciones',{id_perro:race.id_perro});
 if(locations.length) assert.ok(await db.one('perros',{id_perro:race.id_perro}));
 const tables=Object.fromEntries(Object.keys(db.specs).map(n=>[n==='historiales_medicos'?'historial_medico':n,[]]));
 tables.usuarios=[user];
 const input={format:'pawly-mysql-v1',tables};
 assert.equal((await importData(input)).usuarios.inserted,0);
 tables.usuarios=[{...user,nombre:'conflicting name'}];
 await assert.rejects(importData(input),/Conflicto/);
 assert.equal((await db.one('usuarios',{id_usuario:user.id_usuario})).nombre,tag);
 tables.usuarios=[];tables.perros=[{...dog,id_perro:2147483647,id_usuario:2147483647}];
 await assert.rejects(importData(input),e=>e.extensions.code==='CONFLICT');
 assert.equal(await db.one('perros',{id_perro:2147483647}),null);
 console.log('OK: referencias, rollback, IDs concurrentes, borrado concurrente e importación sin sobrescrituras ni huérfanos.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const [name,id] of created.reverse()) await db.models[name].deleteOne({[db.specs[name].id]:id});await closeMongo();});
