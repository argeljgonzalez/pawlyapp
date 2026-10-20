const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
async function connectMongo() {
    await mongoose.connect(process.env.MONGO_URI, {
        user: process.env.MONGO_USER, pass: process.env.MONGO_PASSWORD,
        authSource: process.env.MONGO_AUTH_SOURCE || 'pawly', serverSelectionTimeoutMS: 15000
    });
    const {models,IntegrityLock} = require('./repository');
    const {Counter} = require('../models/HistorialMedico');
    for (const model of [...Object.values(models),Counter,IntegrityLock]) {
        await model.createCollection(); await model.createIndexes();
    }
    await IntegrityLock.updateOne({_id:'relations'},{$setOnInsert:{revision:0}},{upsert:true});
    // Fallar al iniciar, no en la primera mutación, si falta replica set.
    const hello=await mongoose.connection.db.admin().command({hello:1});
    if (!hello.setName) throw new Error('MongoDB requiere replica set para las transacciones. Inicia mongo-setup en Compose.');
}
module.exports = { mongoose, connectMongo, closeMongo: () => mongoose.disconnect() };
