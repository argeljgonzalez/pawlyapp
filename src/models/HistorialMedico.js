const mongoose = require('mongoose');
const positiveId = { type: Number, required: true, min: 1, max: 2147483647, validate: Number.isInteger };
const schema = new mongoose.Schema({
    id_historial: { ...positiveId, unique: true },
    id_perro: positiveId,
    tipo_registro: { type: String, required: true, trim: true, maxlength: 100 },
    descripcion: { type: String, required: true, trim: true, maxlength: 10000 },
    fecha_registro: { type: Date, default: Date.now, required: true },
    observaciones: { type: String, maxlength: 10000, default: null }
}, { autoCreate: false, autoIndex: false, versionKey: false, collection: 'historiales_medicos', strict: 'throw' });
schema.index({ id_perro: 1, id_historial: 1 });
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false, autoCreate: false, autoIndex: false });
const Historial = mongoose.model('HistorialMedico', schema);
const Counter = mongoose.model('Counter', counterSchema);
function serialize(row) {
    if (!row) return null;
    const { _id, ...data } = row.toObject ? row.toObject() : row;
    return { ...data, fecha_registro: new Date(data.fecha_registro).toISOString().slice(0, 10) };
}
module.exports = { Historial, Counter, serialize };
