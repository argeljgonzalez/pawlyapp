require('dotenv').config();

const bcrypt = require('bcryptjs');
const { hashPassword, generateToken, isHash, active, logout } = require('../../security/auth');
const { protect, limitAuth } = require('../../security/access');
const { validate } = require('../../security/validation');
const { fail } = require('../../security/errors');
const dummyHash = bcrypt.hash('invalid-login-placeholder', 12);
const db = require('../../database/db');

const cleanData = (data) => {
    return Object.fromEntries(
        Object.entries(data).filter(([key, value]) => value !== undefined)
    );
};

const hasData = (data) => {
    return Object.keys(data).length > 0;
};

const findOne = async (table, idField, idValue, selectFields = '*') => {
    return await db(table)
        .select(selectFields)
        .where({ [idField]: idValue })
        .first();
};

const insertAndReturn = async (table, idField, data, selectFields = '*') => {
    const [id] = await db(table).insert(data);
    return await findOne(table, idField, id, selectFields);
};

const updateAndReturn = async (table, idField, idValue, data, selectFields = '*') => {
    const clean = cleanData(data);

    if (hasData(clean)) {
        await db(table)
            .where({ [idField]: idValue })
            .update(clean);
    }

    const result = await findOne(table, idField, idValue, selectFields);
    if (!result) fail('Registro no disponible.', 'NOT_FOUND');
    return result;
};

const deleteById = async (table, idField, idValue, message) => {
    const deleted = await db(table).where({ [idField]: idValue }).del();
    if (!deleted) fail('Registro no disponible.', 'NOT_FOUND');

    return message;
};

const usuarioFields = [
    'id_usuario',
    'nombre',
    'apellido',
    'correo',
    'telefono',
    db.raw("DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i:%s') as fecha_registro"),
    'estado'
];

const razaFields = [
    'id_raza',
    'nombre_raza',
    'pais_origen',
    'tamano',
    'esperanza_vida',
    'temperamento',
    'descripcion'
];

const perroFields = [
    'id_perro',
    'id_usuario',
    'id_raza',
    'nombre',
    'edad',
    'sexo',
    'peso',
    'color',
    db.raw("DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') as fecha_nacimiento"),
    db.raw("DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i:%s') as fecha_registro")
];

const ubicacionFields = [
    'id_ubicacion',
    'id_perro',
    'latitud',
    'longitud',
    db.raw("DATE_FORMAT(fecha_hora, '%Y-%m-%d %H:%i:%s') as fecha_hora"),
    'estado'
];

const tipoRecordatorioFields = [
    'id_tipo_recordatorio',
    'nombre_tipo',
    'descripcion'
];

const recordatorioFields = [
    'id_recordatorio',
    'id_perro',
    'id_tipo_recordatorio',
    'titulo',
    'descripcion',
    db.raw("DATE_FORMAT(fecha_programada, '%Y-%m-%d %H:%i:%s') as fecha_programada"),
    'estado'
];

const cartillaVacunacionFields = [
    'id_cartilla',
    'id_perro',
    db.raw("DATE_FORMAT(fecha_creacion, '%Y-%m-%d') as fecha_creacion"),
    'observaciones_generales',
    'estado'
];

const vacunaFields = [
    'id_vacuna',
    'nombre_vacuna',
    'descripcion',
    'edad_recomendada',
    'requiere_refuerzo'
];

const cartillaDetalleFields = [
    'id_detalle_cartilla',
    'id_cartilla',
    'id_vacuna',
    db.raw("DATE_FORMAT(fecha_aplicacion, '%Y-%m-%d') as fecha_aplicacion"),
    db.raw("DATE_FORMAT(proxima_dosis, '%Y-%m-%d') as proxima_dosis"),
    'veterinaria',
    'veterinario',
    'lote_vacuna',
    'estado',
    'observaciones'
];

const citaVeterinariaFields = [
    'id_cita',
    'id_perro',
    db.raw("DATE_FORMAT(fecha_cita, '%Y-%m-%d %H:%i:%s') as fecha_cita"),
    'veterinaria',
    'motivo',
    'diagnostico',
    'tratamiento',
    'estado'
];

const publicacionFields = [
    'id_publicacion',
    'id_usuario',
    'titulo',
    'contenido',
    db.raw("DATE_FORMAT(fecha_publicacion, '%Y-%m-%d %H:%i:%s') as fecha_publicacion"),
    'estado'
];

const resolvers = {
    Query: {
        me: async (_, __, context) => {
            if (!context.user) {
                fail('Debes iniciar sesión.', 'UNAUTHENTICATED');
            }

            return await findOne(
                'usuarios',
                'id_usuario',
                context.user.id_usuario,
                usuarioFields
            );
        },

        // El resto de las consultas se construye con el filtro de propietario
        // y la paginación definidos en security/access.js.
    },

    Mutation: {
        logout,
        login: async (_, { correo, contrasena }, context) => {
            await limitAuth(context.ip);
            ({ correo } = validate({ correo }));
            if (Buffer.byteLength(contrasena, 'utf8') > 72) fail('Correo o contraseña incorrectos.', 'UNAUTHENTICATED');
            const usuario = await db('usuarios').select([...usuarioFields, 'contrasena']).where({ correo }).first();
            const validHash = isHash(usuario?.contrasena);
            const matches = await bcrypt.compare(contrasena, validHash ? usuario.contrasena : await dummyHash);
            if (!matches || !validHash || !active(usuario)) fail('Correo o contraseña incorrectos.', 'UNAUTHENTICATED');
            return { token: await generateToken(usuario), usuario };
        },

        addUsuario: async (_, { nombre, apellido, correo, contrasena, telefono, estado }) => {
            contrasena = await hashPassword(contrasena);
            return await insertAndReturn('usuarios', 'id_usuario', {
                nombre,
                apellido,
                correo,
                contrasena,
                telefono,
                estado
            }, usuarioFields);
        },

        updateUsuario: async (_, { id_usuario, nombre, apellido, correo, contrasena, telefono, estado }) => {
            if (contrasena !== undefined) contrasena = await hashPassword(contrasena);
            return await updateAndReturn('usuarios', 'id_usuario', id_usuario, {
                nombre,
                apellido,
                correo,
                contrasena,
                telefono,
                estado
            }, usuarioFields);
        },

        deleteUsuario: async (_, { id_usuario }) => {
            return await deleteById('usuarios', 'id_usuario', id_usuario, `Usuario con id ${id_usuario} eliminado`);
        },

        addRaza: async (_, { nombre_raza, pais_origen, tamano, esperanza_vida, temperamento, descripcion }) => {
            return await insertAndReturn('razas', 'id_raza', {
                nombre_raza,
                pais_origen,
                tamano,
                esperanza_vida,
                temperamento,
                descripcion
            }, razaFields);
        },

        updateRaza: async (_, { id_raza, nombre_raza, pais_origen, tamano, esperanza_vida, temperamento, descripcion }) => {
            return await updateAndReturn('razas', 'id_raza', id_raza, {
                nombre_raza,
                pais_origen,
                tamano,
                esperanza_vida,
                temperamento,
                descripcion
            }, razaFields);
        },

        deleteRaza: async (_, { id_raza }) => {
            return await deleteById('razas', 'id_raza', id_raza, `Raza con id ${id_raza} eliminada`);
        },

        addPerro: async (_, { id_usuario, id_raza, nombre, edad, sexo, peso, color, fecha_nacimiento }) => {
            return await insertAndReturn('perros', 'id_perro', {
                id_usuario,
                id_raza,
                nombre,
                edad,
                sexo,
                peso,
                color,
                fecha_nacimiento
            }, perroFields);
        },

        updatePerro: async (_, { id_perro, id_usuario, id_raza, nombre, edad, sexo, peso, color, fecha_nacimiento }) => {
            return await updateAndReturn('perros', 'id_perro', id_perro, {
                id_usuario,
                id_raza,
                nombre,
                edad,
                sexo,
                peso,
                color,
                fecha_nacimiento
            }, perroFields);
        },

        deletePerro: async (_, { id_perro }, context) => {
            return db.transaction(async trx => {
                await require('../../services/history').allowedDogs(context, id_perro, trx, true);
                if (await require('../../models/HistorialMedico').Historial.exists({ id_perro })) {
                    fail('La mascota tiene historial médico. Elimina primero sus registros.', 'CONFLICT');
                }
                const deleted = await trx('perros').where({ id_perro }).del();
                if (!deleted) fail('Registro no disponible.', 'NOT_FOUND');
                return `Perro con id ${id_perro} eliminado`;
            });
        },

        addUbicacion: async (_, { id_perro, latitud, longitud, estado }) => {
            return await insertAndReturn('ubicaciones', 'id_ubicacion', {
                id_perro,
                latitud,
                longitud,
                estado
            }, ubicacionFields);
        },

        updateUbicacion: async (_, { id_ubicacion, id_perro, latitud, longitud, estado }) => {
            return await updateAndReturn('ubicaciones', 'id_ubicacion', id_ubicacion, {
                id_perro,
                latitud,
                longitud,
                estado
            }, ubicacionFields);
        },

        deleteUbicacion: async (_, { id_ubicacion }) => {
            return await deleteById('ubicaciones', 'id_ubicacion', id_ubicacion, `Ubicacion con id ${id_ubicacion} eliminada`);
        },

        addTipoRecordatorio: async (_, { nombre_tipo, descripcion }) => {
            return await insertAndReturn('tipos_recordatorio', 'id_tipo_recordatorio', {
                nombre_tipo,
                descripcion
            }, tipoRecordatorioFields);
        },

        updateTipoRecordatorio: async (_, { id_tipo_recordatorio, nombre_tipo, descripcion }) => {
            return await updateAndReturn('tipos_recordatorio', 'id_tipo_recordatorio', id_tipo_recordatorio, {
                nombre_tipo,
                descripcion
            }, tipoRecordatorioFields);
        },

        deleteTipoRecordatorio: async (_, { id_tipo_recordatorio }) => {
            return await deleteById('tipos_recordatorio', 'id_tipo_recordatorio', id_tipo_recordatorio, `Tipo de recordatorio con id ${id_tipo_recordatorio} eliminado`);
        },

        addRecordatorio: async (_, { id_perro, id_tipo_recordatorio, titulo, descripcion, fecha_programada, estado }) => {
            return await insertAndReturn('recordatorios', 'id_recordatorio', {
                id_perro,
                id_tipo_recordatorio,
                titulo,
                descripcion,
                fecha_programada,
                estado
            }, recordatorioFields);
        },

        updateRecordatorio: async (_, { id_recordatorio, id_perro, id_tipo_recordatorio, titulo, descripcion, fecha_programada, estado }) => {
            return await updateAndReturn('recordatorios', 'id_recordatorio', id_recordatorio, {
                id_perro,
                id_tipo_recordatorio,
                titulo,
                descripcion,
                fecha_programada,
                estado
            }, recordatorioFields);
        },

        deleteRecordatorio: async (_, { id_recordatorio }) => {
            return await deleteById('recordatorios', 'id_recordatorio', id_recordatorio, `Recordatorio con id ${id_recordatorio} eliminado`);
        },

        addCartillaVacunacion: async (_, { id_perro, observaciones_generales, estado }) => {
            return await insertAndReturn('cartillas_vacunacion', 'id_cartilla', {
                id_perro,
                observaciones_generales,
                estado
            }, cartillaVacunacionFields);
        },

        updateCartillaVacunacion: async (_, { id_cartilla, id_perro, observaciones_generales, estado }) => {
            return await updateAndReturn('cartillas_vacunacion', 'id_cartilla', id_cartilla, {
                id_perro,
                observaciones_generales,
                estado
            }, cartillaVacunacionFields);
        },

        deleteCartillaVacunacion: async (_, { id_cartilla }) => {
            return await deleteById('cartillas_vacunacion', 'id_cartilla', id_cartilla, `Cartilla con id ${id_cartilla} eliminada`);
        },

        addVacuna: async (_, { nombre_vacuna, descripcion, edad_recomendada, requiere_refuerzo }) => {
            return await insertAndReturn('vacunas', 'id_vacuna', {
                nombre_vacuna,
                descripcion,
                edad_recomendada,
                requiere_refuerzo
            }, vacunaFields);
        },

        updateVacuna: async (_, { id_vacuna, nombre_vacuna, descripcion, edad_recomendada, requiere_refuerzo }) => {
            return await updateAndReturn('vacunas', 'id_vacuna', id_vacuna, {
                nombre_vacuna,
                descripcion,
                edad_recomendada,
                requiere_refuerzo
            }, vacunaFields);
        },

        deleteVacuna: async (_, { id_vacuna }) => {
            return await deleteById('vacunas', 'id_vacuna', id_vacuna, `Vacuna con id ${id_vacuna} eliminada`);
        },

        addCartillaDetalle: async (_, { id_cartilla, id_vacuna, fecha_aplicacion, proxima_dosis, veterinaria, veterinario, lote_vacuna, estado, observaciones }) => {
            return await insertAndReturn('cartilla_detalle', 'id_detalle_cartilla', {
                id_cartilla,
                id_vacuna,
                fecha_aplicacion,
                proxima_dosis,
                veterinaria,
                veterinario,
                lote_vacuna,
                estado,
                observaciones
            }, cartillaDetalleFields);
        },

        updateCartillaDetalle: async (_, { id_detalle_cartilla, id_cartilla, id_vacuna, fecha_aplicacion, proxima_dosis, veterinaria, veterinario, lote_vacuna, estado, observaciones }) => {
            return await updateAndReturn('cartilla_detalle', 'id_detalle_cartilla', id_detalle_cartilla, {
                id_cartilla,
                id_vacuna,
                fecha_aplicacion,
                proxima_dosis,
                veterinaria,
                veterinario,
                lote_vacuna,
                estado,
                observaciones
            }, cartillaDetalleFields);
        },

        deleteCartillaDetalle: async (_, { id_detalle_cartilla }) => {
            return await deleteById('cartilla_detalle', 'id_detalle_cartilla', id_detalle_cartilla, `Detalle de cartilla con id ${id_detalle_cartilla} eliminado`);
        },

        addCitaVeterinaria: async (_, { id_perro, fecha_cita, veterinaria, motivo, diagnostico, tratamiento, estado }) => {
            return await insertAndReturn('citas_veterinarias', 'id_cita', {
                id_perro,
                fecha_cita,
                veterinaria,
                motivo,
                diagnostico,
                tratamiento,
                estado
            }, citaVeterinariaFields);
        },

        updateCitaVeterinaria: async (_, { id_cita, id_perro, fecha_cita, veterinaria, motivo, diagnostico, tratamiento, estado }) => {
            return await updateAndReturn('citas_veterinarias', 'id_cita', id_cita, {
                id_perro,
                fecha_cita,
                veterinaria,
                motivo,
                diagnostico,
                tratamiento,
                estado
            }, citaVeterinariaFields);
        },

        deleteCitaVeterinaria: async (_, { id_cita }) => {
            return await deleteById('citas_veterinarias', 'id_cita', id_cita, `Cita veterinaria con id ${id_cita} eliminada`);
        },

        addPublicacion: async (_, { id_usuario, titulo, contenido, estado }) => {
            return await insertAndReturn('publicaciones', 'id_publicacion', {
                id_usuario,
                titulo,
                contenido,
                estado
            }, publicacionFields);
        },

        updatePublicacion: async (_, { id_publicacion, id_usuario, titulo, contenido, estado }) => {
            return await updateAndReturn('publicaciones', 'id_publicacion', id_publicacion, {
                id_usuario,
                titulo,
                contenido,
                estado
            }, publicacionFields);
        },

        deletePublicacion: async (_, { id_publicacion }) => {
            return await deleteById('publicaciones', 'id_publicacion', id_publicacion, `Publicacion con id ${id_publicacion} eliminada`);
        }
    }
};

const secured = protect(resolvers, [
    { entity: 'Usuario', list: 'usuarios', one: 'usuario', table: 'usuarios', id: 'id_usuario', fields: usuarioFields, public: false, required: ["nombre", "apellido", "correo", "contrasena"] },
    { entity: 'Raza', list: 'razas', one: 'raza', table: 'razas', id: 'id_raza', fields: razaFields, public: true, required: ["nombre_raza", "tamano"] },
    { entity: 'Perro', list: 'perros', one: 'perro', table: 'perros', id: 'id_perro', fields: perroFields, public: false, required: ["id_usuario", "id_raza", "nombre", "sexo"] },
    { entity: 'Ubicacion', list: 'ubicaciones', one: 'ubicacion', table: 'ubicaciones', id: 'id_ubicacion', fields: ubicacionFields, public: false, required: ["id_perro", "latitud", "longitud"] },
    { entity: 'TipoRecordatorio', list: 'tiposRecordatorio', one: 'tipoRecordatorio', table: 'tipos_recordatorio', id: 'id_tipo_recordatorio', fields: tipoRecordatorioFields, public: true, required: ["nombre_tipo"] },
    { entity: 'Recordatorio', list: 'recordatorios', one: 'recordatorio', table: 'recordatorios', id: 'id_recordatorio', fields: recordatorioFields, public: false, required: ["id_perro", "id_tipo_recordatorio", "titulo", "fecha_programada"] },
    { entity: 'CartillaVacunacion', list: 'cartillasVacunacion', one: 'cartillaVacunacion', table: 'cartillas_vacunacion', id: 'id_cartilla', fields: cartillaVacunacionFields, public: false, required: ["id_perro"] },
    { entity: 'Vacuna', list: 'vacunas', one: 'vacuna', table: 'vacunas', id: 'id_vacuna', fields: vacunaFields, public: true, required: ["nombre_vacuna"] },
    { entity: 'CartillaDetalle', list: 'cartillaDetalles', one: 'cartillaDetalle', table: 'cartilla_detalle', id: 'id_detalle_cartilla', fields: cartillaDetalleFields, public: false, required: ["id_cartilla", "id_vacuna"] },
    { entity: 'CitaVeterinaria', list: 'citasVeterinarias', one: 'citaVeterinaria', table: 'citas_veterinarias', id: 'id_cita', fields: citaVeterinariaFields, public: false, required: ["id_perro", "fecha_cita", "veterinaria", "motivo"] },
    { entity: 'Publicacion', list: 'publicaciones', one: 'publicacion', table: 'publicaciones', id: 'id_publicacion', fields: publicacionFields, public: false, required: ["id_usuario", "titulo", "contenido"] }
]);
// El historial usa MongoDB y verifica la propiedad de las mascotas en MySQL.
const history = require('../../services/history');
Object.assign(secured.Query, history.Query);
Object.assign(secured.Mutation, history.Mutation);
module.exports = secured;
