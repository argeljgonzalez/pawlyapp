const admin=db.getSiblingDB('admin');
if (!admin.auth('admin',process.env.MONGO_ROOT_PASSWORD)) throw new Error('No se pudo autenticar la inicialización de MongoDB.');
try {rs.status();}
catch (error) {
    if (error.code!==94 && error.codeName!=='NotYetInitialized') throw error;
    const result=rs.initiate({_id:'rs0',members:[{_id:0,host:'bda-mongodb:27017'}]});
    if (!result.ok) throw new Error('No se pudo iniciar el replica set.');
}
for (let i=0;i<60;i++) {
    if (admin.runCommand({hello:1}).isWritablePrimary) {print('Replica set rs0 preparado.');quit(0);}
    sleep(1000);
}
throw new Error('MongoDB no eligió un primario a tiempo.');
