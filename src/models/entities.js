const mongoose = require('mongoose');
const id = () => ({ type: Number, required: true, min: 1, max: 2147483647, validate: Number.isInteger });
const str = (required = false, maxlength = 255, extra = {}) => ({ type: String, required, maxlength, trim: true, ...extra });
const date = (required = false, current = false) => ({ type: Date, required, ...(current ? { default: Date.now } : {}), set: v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(v) ? new Date(v.slice(0,10)+'T'+(v.slice(11)||'00:00:00')+'Z') : v });
const state = value => str(false, 50, { default: value });
const specs = {
    usuarios: { id: 'id_usuario', fields: { nombre: str(true), apellido: str(true), correo: str(true,255,{ lowercase: true, unique: true }), contrasena: str(true,255,{trim:false}), telefono: str(false,50), fecha_registro: date(false,true), estado: state('activo') } },
    razas: { id: 'id_raza', fields: { nombre_raza: str(true), pais_origen: str(), tamano: str(true,50), esperanza_vida: str(false,100), temperamento: str(false,10000), descripcion: str(false,10000) } },
    perros: { id:'id_perro', refs:{id_usuario:'usuarios',id_raza:'razas'}, dates:['fecha_nacimiento'], fields:{id_usuario:id(),id_raza:id(),nombre:str(true),edad:{type:Number,min:0,validate:Number.isInteger},sexo:str(true,50),peso:{type:Number,min:0},color:str(false,100),fecha_nacimiento:date(),fecha_registro:date(false,true)} },
    ubicaciones: { id:'id_ubicacion',refs:{id_perro:'perros'},fields:{id_perro:id(),latitud:{type:Number,required:true,min:-90,max:90},longitud:{type:Number,required:true,min:-180,max:180},fecha_hora:date(false,true),estado:state('activo')} },
    tipos_recordatorio: { id:'id_tipo_recordatorio',fields:{nombre_tipo:str(true),descripcion:str(false,10000)} },
    recordatorios: { id:'id_recordatorio',refs:{id_perro:'perros',id_tipo_recordatorio:'tipos_recordatorio'},fields:{id_perro:id(),id_tipo_recordatorio:id(),titulo:str(true),descripcion:str(false,10000),fecha_programada:date(true),estado:state('pendiente')} },
    cartillas_vacunacion: { id:'id_cartilla',refs:{id_perro:'perros'},dates:['fecha_creacion'],fields:{id_perro:id(),fecha_creacion:date(false,true),observaciones_generales:str(false,10000),estado:state('activo')} },
    vacunas: { id:'id_vacuna',fields:{nombre_vacuna:str(true),descripcion:str(false,10000),edad_recomendada:str(false,100),requiere_refuerzo:{type:Boolean,default:false}} },
    cartilla_detalle: { id:'id_detalle_cartilla',refs:{id_cartilla:'cartillas_vacunacion',id_vacuna:'vacunas'},dates:['fecha_aplicacion','proxima_dosis'],fields:{id_cartilla:id(),id_vacuna:id(),fecha_aplicacion:date(),proxima_dosis:date(),veterinaria:str(),veterinario:str(),lote_vacuna:str(false,100),estado:state('pendiente'),observaciones:str(false,10000)} },
    citas_veterinarias: { id:'id_cita',refs:{id_perro:'perros'},fields:{id_perro:id(),fecha_cita:date(true),veterinaria:str(true),motivo:str(true,10000),diagnostico:str(false,10000),tratamiento:str(false,10000),estado:state('pendiente')} },
    publicaciones: { id:'id_publicacion',refs:{id_usuario:'usuarios'},fields:{id_usuario:id(),titulo:str(true),contenido:str(true,10000),fecha_publicacion:date(false,true),estado:state('activo')} }
};
const models = {};
for (const [name,spec] of Object.entries(specs)) {
    const schema = new mongoose.Schema({[spec.id]:{...id(),unique:true},...spec.fields},{collection:name,versionKey:false,strict:'throw',autoCreate:false,autoIndex:false});
    for (const field of Object.keys(spec.refs || {})) schema.index({[field]:1,[spec.id]:1});
    models[name] = mongoose.model(name,schema);
}
const { Historial } = require('./HistorialMedico');
models.historiales_medicos = Historial;
specs.historiales_medicos = {id:'id_historial',refs:{id_perro:'perros'},dates:['fecha_registro'],counter:'historial'};
function serialize(name, row) {
    if (!row) return null;
    const {_id,__v,...data} = row.toObject ? row.toObject() : row;
    for (const [key,value] of Object.entries(data)) {
        if (value instanceof Date) data[key] = specs[name].dates?.includes(key) ? value.toISOString().slice(0,10) : value.toISOString().slice(0,19).replace('T',' ');
    }
    return data;
}
module.exports = {models,specs,serialize};
