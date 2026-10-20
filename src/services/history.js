const db = require('../database/repository');
const { cachedHistory, invalidateHistory } = require('./history-cache');
const { validate } = require('../security/validation');
const { fail } = require('../security/errors');
function authenticated(context) {
    if (!context.user) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
    return context.user;
}
async function allowedDogs(context, id) {
    const user=authenticated(context);
    const filter=user.isAdmin ? {} : {id_usuario:user.id_usuario};
    if (id!=null) {validate({id_perro:id});filter.id_perro=id;}
    const dogs=(await db.find('perros',filter,{fields:['id_perro']})).map(row=>row.id_perro);
    if (id!=null && !dogs.length) fail('Mascota no disponible.','FORBIDDEN');
    return dogs;
}
function pagination(args) {
    const {limit=50,offset=0}=args;
    if (!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0) fail('Usa limit entre 1 y 100 y offset mayor o igual a 0.');
    return {limit,offset};
}
const Query={
    historialesMedicos:async (_,args,context)=> {
        const dogs=await allowedDogs(context,args.id_perro);
        const {limit,offset}=pagination(args);
        const load=()=>db.find('historiales_medicos',{id_perro:{$in:dogs}},{limit,offset});
        return args.id_perro!=null ? cachedHistory(args.id_perro,`${limit}:${offset}`,load) : load();
    },
    historialMedico:async (_,{id_historial},context)=> {
        validate({id_historial});
        return db.one('historiales_medicos',{id_historial,id_perro:{$in:await allowedDogs(context)}});
    },
    resumenHistorialMedico:async (_,args,context)=> {
        const dogs=await allowedDogs(context,args.id_perro);
        return db.models.historiales_medicos.aggregate([
            {$match:{id_perro:{$in:dogs}}},{$group:{_id:'$tipo_registro',cantidad:{$sum:1}}},
            {$project:{_id:0,tipo_registro:'$_id',cantidad:1}},{$sort:{cantidad:-1,tipo_registro:1}}
        ]);
    }
};
const required=['id_perro','tipo_registro','descripcion'];
const Mutation={
    addHistorialMedico:async (_,args,context)=> {
        const row=await db.transaction(async ()=> {
            authenticated(context);validate(args,required);await allowedDogs(context,args.id_perro);
            return db.insert('historiales_medicos',args);
        });
        await invalidateHistory(row.id_perro);return row;
    },
    updateHistorialMedico:async (_,{id_historial,...args},context)=> {
        const {row,old}=await db.transaction(async ()=> {
            authenticated(context);validate({id_historial});validate(args,required);
            const old=await db.one('historiales_medicos',{id_historial,id_perro:{$in:await allowedDogs(context)}});
            if (!old) fail('Registro no disponible.','NOT_FOUND');
            if (args.id_perro!=null) await allowedDogs(context,args.id_perro);
            return {old,row:await db.update('historiales_medicos',{id_historial},args)};
        });
        await invalidateHistory(old.id_perro);
        if (row.id_perro!==old.id_perro) await invalidateHistory(row.id_perro);
        return row;
    },
    deleteHistorialMedico:async (_,{id_historial},context)=> {
        const row=await db.transaction(async ()=> {
            authenticated(context);validate({id_historial});
            const old=await db.one('historiales_medicos',{id_historial,id_perro:{$in:await allowedDogs(context)}});
            if (!old) fail('Registro no disponible.','NOT_FOUND');
            await db.remove('historiales_medicos',{id_historial});return old;
        });
        await invalidateHistory(row.id_perro);return `Historial medico con id ${id_historial} eliminado`;
    }
};
module.exports={Query,Mutation,allowedDogs};
