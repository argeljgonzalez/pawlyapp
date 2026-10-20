const db = require('../database/db');
const { Historial, nextHistoryId, serialize } = require('../models/HistorialMedico');
const { cachedHistory, invalidateHistory } = require('./history-cache');
const { validate } = require('../security/validation');
const { fail } = require('../security/errors');
function authenticated(context) {
    if (!context.user) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
    return context.user;
}
async function allowedDogs(context, id, connection = db, lock = false) {
    const user = authenticated(context);
    let query = connection('perros').select('id_perro').orderBy('id_perro');
    if (!user.isAdmin) query = query.where('id_usuario', user.id_usuario);
    if (id != null) { validate({ id_perro: id }); query = query.where('id_perro', id); }
    if (lock) query = query.forUpdate();
    const dogs = (await query).map(row => row.id_perro);
    if (id != null && !dogs.length) fail('Mascota no disponible.', 'FORBIDDEN');
    return dogs;
}
function pagination(args) {
    const { limit = 50, offset = 0 } = args;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) fail('Usa limit entre 1 y 100 y offset mayor o igual a 0.');
    return { limit, offset };
}
const Query = {
    historialesMedicos: async (_, args, context) => {
        const dogs = await allowedDogs(context, args.id_perro);
        const { limit, offset } = pagination(args);
        const load = async () => (await Historial.find({ id_perro: { $in: dogs } }).sort({ id_historial: 1 }).skip(offset).limit(limit).lean()).map(serialize);
        // La autorización se comprueba antes de leer Redis, incluso en un cache hit.
        return args.id_perro != null ? cachedHistory(args.id_perro, `${limit}:${offset}`, load) : load();
    },
    historialMedico: async (_, { id_historial }, context) => {
        validate({ id_historial });
        const dogs = await allowedDogs(context);
        return serialize(await Historial.findOne({ id_historial, id_perro: { $in: dogs } }).lean());
    },
    resumenHistorialMedico: async (_, args, context) => {
        const dogs = await allowedDogs(context, args.id_perro);
        return Historial.aggregate([
            { $match: { id_perro: { $in: dogs } } },
            { $group: { _id: '$tipo_registro', cantidad: { $sum: 1 } } },
            { $project: { _id: 0, tipo_registro: '$_id', cantidad: 1 } },
            { $sort: { cantidad: -1, tipo_registro: 1 } }
        ]);
    }
};
const required = ['id_perro', 'tipo_registro', 'descripcion'];
const Mutation = {
    addHistorialMedico: async (_, args, context) => {
        authenticated(context); validate(args, required);
        return db.transaction(async trx => {
            await allowedDogs(context, args.id_perro, trx, true);
            const id_historial = await nextHistoryId();
            const row = await Historial.create({ ...args, id_historial });
            await invalidateHistory(args.id_perro);
            return serialize(row);
        });
    },
    updateHistorialMedico: async (_, { id_historial, ...args }, context) => {
        authenticated(context); validate({ id_historial }); validate(args, required);
        const old = await Historial.findOne({ id_historial }).lean();
        if (!old) fail('Registro no disponible.', 'NOT_FOUND');
        // Coincide con el comportamiento anterior: otro dueño no ve el registro.
        const dogs = await allowedDogs(context);
        if (!dogs.includes(old.id_perro)) fail('Registro no disponible.', 'NOT_FOUND');
        return db.transaction(async trx => {
            for (const id of [...new Set([old.id_perro, args.id_perro ?? old.id_perro])].sort((a,b) => a-b)) await allowedDogs(context, id, trx, true);
            const data = Object.fromEntries(Object.entries(args).filter(([,v]) => v !== undefined));
            const row = Object.keys(data).length
                ? await Historial.findOneAndUpdate({ id_historial, id_perro: old.id_perro }, { $set: data }, { returnDocument: 'after', runValidators: true })
                : await Historial.findOne({ id_historial, id_perro: old.id_perro });
            if (!row) fail('Registro modificado por otra operación. Vuelve a consultar.', 'CONFLICT');
            await invalidateHistory(old.id_perro);
            if (row.id_perro !== old.id_perro) await invalidateHistory(row.id_perro);
            return serialize(row);
        });
    },
    deleteHistorialMedico: async (_, { id_historial }, context) => {
        authenticated(context); validate({ id_historial });
        const dogs = await allowedDogs(context);
        const row = await Historial.findOne({ id_historial, id_perro: { $in: dogs } }).lean();
        if (!row) fail('Registro no disponible.', 'NOT_FOUND');
        return db.transaction(async trx => {
            await allowedDogs(context, row.id_perro, trx, true);
            const result = await Historial.deleteOne({ id_historial, id_perro: row.id_perro });
            if (!result.deletedCount) fail('Registro no disponible.', 'NOT_FOUND');
            await invalidateHistory(row.id_perro);
            return `Historial medico con id ${id_historial} eliminado`;
        });
    }
};
module.exports = { Query, Mutation, allowedDogs };
