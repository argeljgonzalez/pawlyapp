const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
async function connectMongo() {
    await mongoose.connect(process.env.MONGO_URI, {
        user: process.env.MONGO_USER,
        pass: process.env.MONGO_PASSWORD,
        authSource: 'pawly',
        serverSelectionTimeoutMS: 5000
    });
    const { Historial, Counter } = require('../models/HistorialMedico');
    await Promise.all([Historial.createCollection(), Counter.createCollection()]);
    await Historial.createIndexes();
}
module.exports = { mongoose, connectMongo, closeMongo: () => mongoose.disconnect() };
