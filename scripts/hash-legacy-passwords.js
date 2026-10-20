require('dotenv').config();
const bcrypt=require('bcryptjs');
const db=require('../src/database/repository');
const {connectMongo,closeMongo}=require('../src/database/mongo');
const {isHash}=require('../src/security/auth');
(async()=>{
    await connectMongo();
    const count=await db.transaction(async()=>{
        let updated=0;
        for (const user of await db.find('usuarios')) {
            if (isHash(user.contrasena)) continue;
            if (!user.contrasena || Buffer.byteLength(user.contrasena)>72) throw new Error(`El usuario ${user.id_usuario} requiere restablecer su contraseña.`);
            await db.update('usuarios',{id_usuario:user.id_usuario},{contrasena:await bcrypt.hash(user.contrasena,12)});updated++;
        }
        return updated;
    });
    console.log(`Contraseñas convertidas: ${count}.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(closeMongo);
