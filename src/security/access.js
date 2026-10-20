const db = require('../database/repository');
const { fail } = require('./errors');
const { validate } = require('./validation');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const authLimiter = new RateLimiterMemory({ points: 20, duration: 900 });

// Filtra en MongoDB antes de devolver cualquier documento privado.
async function scope(resource, user) {
    if (resource.public || user.isAdmin) return {};
    const owner=user.id_usuario;
    if (['usuarios','perros','publicaciones'].includes(resource.table)) return {id_usuario:owner};
    const dogs=(await db.find('perros',{id_usuario:owner},{fields:['id_perro']})).map(row=>row.id_perro);
    if (resource.table==='cartilla_detalle') {
        const cards=await db.find('cartillas_vacunacion',{id_perro:{$in:dogs}},{fields:['id_cartilla']});
        return {id_cartilla:{$in:cards.map(row=>row.id_cartilla)}};
    }
    return {id_perro:{$in:dogs}};
}
function protect(resolvers, resources) {
    for (const r of resources) {
        for (const [name, list] of [[r.list, true], [r.one, false]]) {
            resolvers.Query[name] = async (_, args, context) => {
                if (!r.public && !context.user) fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
                validate(args);
                const filter = await scope(r, context.user);
                if (!list) return db.one(r.table, {$and:[filter,{[r.id]:args[r.id]}]}, r.fields);
                const { limit = 50, offset = 0 } = args;
                if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) fail('Usa limit entre 1 y 100 y offset mayor o igual a 0.');
                return db.find(r.table,filter,{fields:r.fields,limit,offset});
            };
        }
        for (const action of ['add', 'update', 'delete']) {
            const name = action + r.entity;
            const original = resolvers.Mutation[name];
            resolvers.Mutation[name] = async (parent, args, context, info) => db.transaction(async () => {
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
                        const existing = await db.one(r.table, {$and:[await scope(r,context.user),{[r.id]:args[r.id]}]});
                        if (!existing) fail('Registro no disponible.', 'NOT_FOUND');
                    }
                    if (r.table === 'usuarios' && 'estado' in args && !context.user.isAdmin) fail('Solo un administrador puede cambiar el estado de la cuenta.', 'FORBIDDEN');
                    if (args.id_usuario != null && !context.user.isAdmin && args.id_usuario !== context.user.id_usuario) fail('No puedes asignar datos a otro usuario.', 'FORBIDDEN');
                    for (const [key, table] of [['id_perro', 'perros'], ['id_cartilla', 'cartillas_vacunacion']]) {
                        if (args[key] != null && key !== r.id) {
                            const target = resources.find(item => item.table === table);
                            if (!await db.one(table, {$and:[await scope(target,context.user),{[key]:args[key]}]})) fail('Registro relacionado no disponible.', 'FORBIDDEN');
                        }
                    }
                }
                if (r.table === 'usuarios' && args.estado != null && !['activo', 'inactivo'].includes(args.estado)) fail('Estado de usuario inválido.');
                return original(parent,args,context,info);
            });
        }
    }
    return resolvers;
}
async function limitAuth(ip) {
    try { await authLimiter.consume(ip || 'unknown'); }
    catch { fail('Demasiados intentos. Inténtalo de nuevo en 15 minutos.', 'RATE_LIMITED'); }
}
module.exports = { protect, limitAuth };
