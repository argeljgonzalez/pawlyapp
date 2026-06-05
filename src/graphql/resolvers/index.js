require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = require('../../database/db');

const cleanData = (data) => {
    return Object.fromEntries(
        Object.entries(data).filter(([key, value]) => value !== undefined)
    );
};

const hasData = (data) => {
    return Object.keys(data).length > 0;
};

const generateToken = (usuario) => {
    return jwt.sign(
        {
            id_usuario: usuario.id_usuario,
            correo: usuario.correo
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '1h'
        }
    );
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

    return await findOne(table, idField, idValue, selectFields);
};

const deleteById = async (table, idField, idValue, message) => {
    await db(table)
        .where({ [idField]: idValue })
        .del();

    return message;
};

const usuarioFields = [
    'id_usuario',
    'nombre',
    'apellido',
    'correo',
    'contrasena',
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

const historialMedicoFields = [
    'id_historial',
    'id_perro',
    'tipo_registro',
    'descripcion',
    db.raw("DATE_FORMAT(fecha_registro, '%Y-%m-%d') as fecha_registro"),
    'observaciones'
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
                throw new Error('No autorizado. Debes iniciar sesión.');
            }

            return await findOne(
                'usuarios',
                'id_usuario',
                context.user.id_usuario,
                usuarioFields
            );
        },

        usuarios: async () => {
            return await db('usuarios').select(usuarioFields);
        },

        usuario: async (_, { id_usuario }) => {
            return await findOne('usuarios', 'id_usuario', id_usuario, usuarioFields);
        },

        razas: async () => {
            return await db('razas').select(razaFields);
        },

        raza: async (_, { id_raza }) => {
            return await findOne('razas', 'id_raza', id_raza, razaFields);
        },

        perros: async () => {
            return await db('perros').select(perroFields);
        },

        perro: async (_, { id_perro }) => {
            return await findOne('perros', 'id_perro', id_perro, perroFields);
        },

        ubicaciones: async () => {
            return await db('ubicaciones').select(ubicacionFields);
        },

        ubicacion: async (_, { id_ubicacion }) => {
            return await findOne('ubicaciones', 'id_ubicacion', id_ubicacion, ubicacionFields);
        },

        tiposRecordatorio: async () => {
            return await db('tipos_recordatorio').select(tipoRecordatorioFields);
        },

        tipoRecordatorio: async (_, { id_tipo_recordatorio }) => {
            return await findOne('tipos_recordatorio', 'id_tipo_recordatorio', id_tipo_recordatorio, tipoRecordatorioFields);
        },

        recordatorios: async () => {
            return await db('recordatorios').select(recordatorioFields);
        },

        recordatorio: async (_, { id_recordatorio }) => {
            return await findOne('recordatorios', 'id_recordatorio', id_recordatorio, recordatorioFields);
        },

        cartillasVacunacion: async () => {
            return await db('cartillas_vacunacion').select(cartillaVacunacionFields);
        },

        cartillaVacunacion: async (_, { id_cartilla }) => {
            return await findOne('cartillas_vacunacion', 'id_cartilla', id_cartilla, cartillaVacunacionFields);
        },

        vacunas: async () => {
            return await db('vacunas').select(vacunaFields);
        },

        vacuna: async (_, { id_vacuna }) => {
            return await findOne('vacunas', 'id_vacuna', id_vacuna, vacunaFields);
        },

        cartillaDetalles: async () => {
            return await db('cartilla_detalle').select(cartillaDetalleFields);
        },

        cartillaDetalle: async (_, { id_detalle_cartilla }) => {
            return await findOne('cartilla_detalle', 'id_detalle_cartilla', id_detalle_cartilla, cartillaDetalleFields);
        },

        citasVeterinarias: async () => {
            return await db('citas_veterinarias').select(citaVeterinariaFields);
        },

        citaVeterinaria: async (_, { id_cita }) => {
            return await findOne('citas_veterinarias', 'id_cita', id_cita, citaVeterinariaFields);
        },

        historialesMedicos: async () => {
            return await db('historial_medico').select(historialMedicoFields);
        },

        historialMedico: async (_, { id_historial }) => {
            return await findOne('historial_medico', 'id_historial', id_historial, historialMedicoFields);
        },

        publicaciones: async () => {
            return await db('publicaciones').select(publicacionFields);
        },

        publicacion: async (_, { id_publicacion }) => {
            return await findOne('publicaciones', 'id_publicacion', id_publicacion, publicacionFields);
        }
    },

    Mutation: {
        login: async (_, { correo, contrasena }) => {
            const usuario = await db('usuarios')
                .select(usuarioFields)
                .where({ correo })
                .first();

            if (!usuario) {
                throw new Error('Usuario no encontrado.');
            }

            if (usuario.contrasena !== contrasena) {
                throw new Error('Contraseña incorrecta.');
            }

            const token = generateToken(usuario);

            return {
                token,
                usuario
            };
        },

        addUsuario: async (_, { nombre, apellido, correo, contrasena, telefono, estado }) => {
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

        deletePerro: async (_, { id_perro }) => {
            return await deleteById('perros', 'id_perro', id_perro, `Perro con id ${id_perro} eliminado`);
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

        addHistorialMedico: async (_, { id_perro, tipo_registro, descripcion, observaciones }) => {
            return await insertAndReturn('historial_medico', 'id_historial', {
                id_perro,
                tipo_registro,
                descripcion,
                observaciones
            }, historialMedicoFields);
        },

        updateHistorialMedico: async (_, { id_historial, id_perro, tipo_registro, descripcion, observaciones }) => {
            return await updateAndReturn('historial_medico', 'id_historial', id_historial, {
                id_perro,
                tipo_registro,
                descripcion,
                observaciones
            }, historialMedicoFields);
        },

        deleteHistorialMedico: async (_, { id_historial }) => {
            return await deleteById('historial_medico', 'id_historial', id_historial, `Historial medico con id ${id_historial} eliminado`);
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

module.exports = resolvers;