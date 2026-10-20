// Dataset ficticio: una cuenta, dos mascotas y cinco registros, en una transacción.
require('dotenv').config();
const {randomBytes}=require('node:crypto');
const db=require('../src/database/repository');
const {connectMongo,closeMongo}=require('../src/database/mongo');
const {connectRedis,closeRedis}=require('../src/database/redis');
const {hashPassword}=require('../src/security/auth');
const {invalidateHistory}=require('../src/services/history-cache');
(async()=>{
    await Promise.all([connectMongo(),connectRedis()]);
    const correo='demo.parcial2@pawly.example';
    const password=randomBytes(16).toString('hex');
    const hash=await hashPassword(password);
    const result=await db.transaction(async()=>{
        if (await db.one('usuarios',{correo})) return null;
        const {id_usuario}=await db.insert('usuarios',{nombre:'Ana',apellido:'Demo',correo,contrasena:hash,estado:'activo'});
        const {id_raza}=await db.insert('razas',{nombre_raza:'Mestizo demo parcial 2',tamano:'Mediano'});
        const dogs=[];
        for (const nombre of ['Luna','Max']) {
            const {id_perro}=await db.insert('perros',{id_usuario,id_raza,nombre,sexo:'Sin especificar',edad:3});
            dogs.push({id_perro,nombre});
            for (const tipo_registro of ['Consulta','Vacunación',...(nombre==='Luna'?['Consulta']:[])]) {
                await db.insert('historiales_medicos',{id_perro,tipo_registro,descripcion:`Ejemplo académico de ${tipo_registro.toLowerCase()} para ${nombre}.`,observaciones:'Datos ficticios para el parcial.'});
            }
        }
        return {id_usuario,dogs};
    });
    if (!result) {console.log('La cuenta demo ya existe; no se modificaron sus datos ni su contraseña.');return;}
    for (const dog of result.dogs) await invalidateHistory(dog.id_perro);
    console.log(JSON.stringify({correo,contrasena:password,...result},null,2));
    console.log('Guarda esta contraseña localmente; no incluyas la salida en Git.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>Promise.all([closeMongo(),closeRedis()]));
