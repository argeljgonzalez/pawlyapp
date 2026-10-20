const db = require('../database/db');
const { fail } = require('./errors');
const { validate } = require('./validation');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const authLimiter = new RateLimiterMemory({ points: 20, duration: 900 });

// Limita en SQL: los listados nunca cargan datos privados de otro dueño.
function scope(query, resource, user) {
    if (resource.public || user.isAdmin) return query;
    const owner = user.id_usuario;
    if (resource.table === 'usuarios') return query.where('id_usuario', owner);
    if (['perros', 'publicaciones'].includes(resource.table)) return query.where('id_usuario', owner);
    const dogs = db('perros').select('id_perro').where('id_usuario', owner);
    if (resource.table === 'cartilla_detalle') {
        return query.whereIn('id_cartilla', db('cartillas_vacunacion').select('id_cartilla').whereIn('id_perro', dogs));
    }
    return query.whereIn('id_perro', dogs);
}
function protect(resolvers, resources) {
    for (const r of resources) {
        for (const [name, list] of [[r.list, true], [r.one, false]]) {
            resolvers.Query[name] = async (_, args, context) => {
                if (!r.public && !context.user) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
                validate(args);
                const query = scope(db(r.table).select(r.fields), r, context.user);
                if (!list) return query.where(r.id, args[r.id]).first();
                const { limit = 50, offset = 0 } = args;
                if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) fail('Usa limit entre 1 y 100 y offset mayor o igual a 0.');
                return query.orderBy(r.id).limit(limit).offset(offset);
            };
        }
        for (const action of ['add', 'update', 'delete']) {
            const name = action + r.entity;
            const original = resolvers.Mutation[name];
            resolvers.Mutation[name] = async (parent, args, context, info) => {
                const registering = name === 'addUsuario';
                if (!registering && !context.user) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
                if (r.public && !context.user?.isAdmin) fail('Solo un administrador puede editar catálogos.', 'FORBIDDEN');
                validate(args, r.required);
                if (registering) {
                    await limitAuth(context.ip);
                    if (args.estado != null && args.estado !== 'activo') fail('El registro debe crear una cuenta activa.');
                    args.estado = 'activo';
                } else {
                    if (action !== 'add') {
                        const existing = await scope(db(r.table), r, context.user).where(r.id, args[r.id]).first();
                        if (!existing) fail('Registro no disponible.', 'NOT_FOUND');
                    }
                    if (r.table === 'usuarios' && 'estado' in args && !context.user.isAdmin) fail('Solo un administrador puede cambiar el estado de la cuenta.', 'FORBIDDEN');
                    if (args.id_usuario != null && !context.user.isAdmin && args.id_usuario !== context.user.id_usuario) fail('No puedes asignar datos a otro usuario.', 'FORBIDDEN');
                    for (const [key, table] of [['id_perro', 'perros'], ['id_cartilla', 'cartillas_vacunacion']]) {
                        if (args[key] != null && key !== r.id) {
                            const target = resources.find(item => item.table === table);
                            if (!await scope(db(table), target, context.user).where(key, args[key]).first()) fail('Registro relacionado no disponible.', 'FORBIDDEN');
                        }
                    }
                }
                if (r.table === 'usuarios' && args.estado != null && !['activo', 'inactivo'].includes(args.estado)) fail('Estado de usuario inválido.');
                try { return await original(parent, args, context, info); }
                catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') fail('Ya existe un registro con esos datos.', 'CONFLICT');
                    if (['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) fail('La operación entra en conflicto con registros relacionados.', 'CONFLICT');
                    if (['ER_DATA_TOO_LONG', 'ER_BAD_NULL_ERROR', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'].includes(error.code)) fail('Los datos no cumplen el formato requerido.');
                    throw error;
                }
            };
        }
    }
    return resolvers;
}
async function limitAuth(ip) {
    try { await authLimiter.consume(ip || 'unknown'); }
    catch { fail('Demasiados intentos. Inténtalo de nuevo en 15 minutos.', 'RATE_LIMITED'); }
}
module.exports = { protect, limitAuth };
