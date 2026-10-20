const { AsyncLocalStorage } = require('node:async_hooks');
const mongoose = require('mongoose');
const {models,specs,serialize} = require('../models/entities');
const {Counter} = require('../models/HistorialMedico');
const {fail} = require('../security/errors');
const sessions = new AsyncLocalStorage();
const session = () => sessions.getStore();
const options = () => session() ? {session:session()} : {};
const lockSchema = new mongoose.Schema({_id:String,revision:Number},{versionKey:false,autoCreate:false,autoIndex:false,collection:'integrity_locks'});
const IntegrityLock = mongoose.model('IntegrityLock',lockSchema);
function mapError(error) {
    if (error.code===11000) fail('Ya existe un registro con esos datos.','CONFLICT');
    if (['ValidationError','CastError','StrictModeError'].includes(error.name)) fail('Los datos no cumplen el formato requerido.');
    throw error;
}
async function transaction(fn) {
    if (session()) return fn();
    const s = await mongoose.startSession();
    try {
        return await s.withTransaction(() => sessions.run(s, async () => {
            // Serializa las escrituras del laboratorio. Evita huérfanos y carreras
            // entre cambios de propietario, autorizaciones y borrados relacionados.
            await IntegrityLock.updateOne({_id:'relations'},{$inc:{revision:1}},{session:s});
            return fn();
        }), {readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});
    } catch (error) { return mapError(error); }
    finally { await s.endSession(); }
}
const clean = data => Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined));
async function find(name,filter={}, {fields,limit,offset=0}={}) {
    let q=models[name].find(filter,fields && fields!=='*' ? fields.join(' ') : null,options()).sort({[specs[name].id]:1}).skip(offset);
    if (limit!=null) q=q.limit(limit);
    return (await q.lean()).map(row=>serialize(name,row));
}
async function one(name,filter={},fields) {
    return serialize(name,await models[name].findOne(filter,fields && fields!=='*' ? fields.join(' ') : null,options()).lean());
}
async function references(name,data) {
    for (const [field,target] of Object.entries(specs[name].refs || {})) {
        if (!await one(target,{[specs[target].id]:data[field]})) fail('La operación entra en conflicto con registros relacionados.','CONFLICT');
    }
}
async function insert(name,data) {
    return transaction(async () => {
        data=clean(data); await references(name,data);
        const seq=await Counter.findOneAndUpdate({_id:specs[name].counter || name},{$inc:{seq:1}},{...options(),upsert:true,returnDocument:'after'});
        if (seq.seq>2147483647) fail('Se agotaron los identificadores GraphQL Int.','CONFLICT');
        const [row]=await models[name].create([{...data,[specs[name].id]:seq.seq}],options());
        return serialize(name,row);
    });
}
async function update(name,filter,data) {
    return transaction(async () => {
        const old=await one(name,filter);
        if (!old) fail('Registro no disponible.','NOT_FOUND');
        const values=clean(data); await references(name,{...old,...values});
        if (!Object.keys(values).length) return old;
        return serialize(name,await models[name].findOneAndUpdate(filter,{$set:values},{...options(),returnDocument:'after',runValidators:true}));
    });
}
async function remove(name,filter) {
    return transaction(async () => {
        const old=await one(name,filter);
        if (!old) fail('Registro no disponible.','NOT_FOUND');
        for (const [child,spec] of Object.entries(specs)) for (const [field,target] of Object.entries(spec.refs||{})) {
            if (target===name && await one(child,{[field]:old[specs[name].id]})) fail('La operación entra en conflicto con registros relacionados.','CONFLICT');
        }
        await models[name].deleteOne({[specs[name].id]:old[specs[name].id]},options());
        return true;
    });
}
module.exports={find,one,insert,update,remove,transaction,session,options,models,specs,serialize,IntegrityLock,mapError,references};
