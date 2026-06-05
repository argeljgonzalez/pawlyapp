const { gql } = require('apollo-server');

const typeDefs = gql`
    type Usuario {
        id_usuario: Int!
        nombre: String
        apellido: String
        correo: String
        contrasena: String
        telefono: String
        fecha_registro: String
        estado: String
    }

    type Raza {
        id_raza: Int!
        nombre_raza: String
        pais_origen: String
        tamano: String
        esperanza_vida: String
        temperamento: String
        descripcion: String
    }

    type Perro {
        id_perro: Int!
        id_usuario: Int
        id_raza: Int
        nombre: String
        edad: Int
        sexo: String
        peso: Float
        color: String
        fecha_nacimiento: String
        fecha_registro: String
    }

    type Ubicacion {
        id_ubicacion: Int!
        id_perro: Int
        latitud: Float
        longitud: Float
        fecha_hora: String
        estado: String
    }

    type TipoRecordatorio {
        id_tipo_recordatorio: Int!
        nombre_tipo: String
        descripcion: String
    }

    type Recordatorio {
        id_recordatorio: Int!
        id_perro: Int
        id_tipo_recordatorio: Int
        titulo: String
        descripcion: String
        fecha_programada: String
        estado: String
    }

    type CartillaVacunacion {
        id_cartilla: Int!
        id_perro: Int
        fecha_creacion: String
        observaciones_generales: String
        estado: String
    }

    type Vacuna {
        id_vacuna: Int!
        nombre_vacuna: String
        descripcion: String
        edad_recomendada: String
        requiere_refuerzo: Boolean
    }

    type CartillaDetalle {
        id_detalle_cartilla: Int!
        id_cartilla: Int
        id_vacuna: Int
        fecha_aplicacion: String
        proxima_dosis: String
        veterinaria: String
        veterinario: String
        lote_vacuna: String
        estado: String
        observaciones: String
    }

    type CitaVeterinaria {
        id_cita: Int!
        id_perro: Int
        fecha_cita: String
        veterinaria: String
        motivo: String
        diagnostico: String
        tratamiento: String
        estado: String
    }

    type HistorialMedico {
        id_historial: Int!
        id_perro: Int
        tipo_registro: String
        descripcion: String
        fecha_registro: String
        observaciones: String
    }

    type Publicacion {
        id_publicacion: Int!
        id_usuario: Int
        titulo: String
        contenido: String
        fecha_publicacion: String
        estado: String
    }

    type Query {
        usuarios: [Usuario]
        usuario(id_usuario: Int!): Usuario

        razas: [Raza]
        raza(id_raza: Int!): Raza

        perros: [Perro]
        perro(id_perro: Int!): Perro

        ubicaciones: [Ubicacion]
        ubicacion(id_ubicacion: Int!): Ubicacion

        tiposRecordatorio: [TipoRecordatorio]
        tipoRecordatorio(id_tipo_recordatorio: Int!): TipoRecordatorio

        recordatorios: [Recordatorio]
        recordatorio(id_recordatorio: Int!): Recordatorio

        cartillasVacunacion: [CartillaVacunacion]
        cartillaVacunacion(id_cartilla: Int!): CartillaVacunacion

        vacunas: [Vacuna]
        vacuna(id_vacuna: Int!): Vacuna

        cartillaDetalles: [CartillaDetalle]
        cartillaDetalle(id_detalle_cartilla: Int!): CartillaDetalle

        citasVeterinarias: [CitaVeterinaria]
        citaVeterinaria(id_cita: Int!): CitaVeterinaria

        historialesMedicos: [HistorialMedico]
        historialMedico(id_historial: Int!): HistorialMedico

        publicaciones: [Publicacion]
        publicacion(id_publicacion: Int!): Publicacion
    }

    type Mutation {
        addUsuario(
            nombre: String!,
            apellido: String!,
            correo: String!,
            contrasena: String!,
            telefono: String,
            estado: String
        ): Usuario!

        updateUsuario(
            id_usuario: Int!,
            nombre: String,
            apellido: String,
            correo: String,
            contrasena: String,
            telefono: String,
            estado: String
        ): Usuario!

        deleteUsuario(id_usuario: Int!): String!


        addRaza(
            nombre_raza: String!,
            pais_origen: String,
            tamano: String!,
            esperanza_vida: String,
            temperamento: String,
            descripcion: String
        ): Raza!

        updateRaza(
            id_raza: Int!,
            nombre_raza: String,
            pais_origen: String,
            tamano: String,
            esperanza_vida: String,
            temperamento: String,
            descripcion: String
        ): Raza!

        deleteRaza(id_raza: Int!): String!


        addPerro(
            id_usuario: Int!,
            id_raza: Int!,
            nombre: String!,
            edad: Int,
            sexo: String!,
            peso: Float,
            color: String,
            fecha_nacimiento: String
        ): Perro!

        updatePerro(
            id_perro: Int!,
            id_usuario: Int,
            id_raza: Int,
            nombre: String,
            edad: Int,
            sexo: String,
            peso: Float,
            color: String,
            fecha_nacimiento: String
        ): Perro!

        deletePerro(id_perro: Int!): String!


        addUbicacion(
            id_perro: Int!,
            latitud: Float!,
            longitud: Float!,
            estado: String
        ): Ubicacion!

        updateUbicacion(
            id_ubicacion: Int!,
            id_perro: Int,
            latitud: Float,
            longitud: Float,
            estado: String
        ): Ubicacion!

        deleteUbicacion(id_ubicacion: Int!): String!


        addTipoRecordatorio(
            nombre_tipo: String!,
            descripcion: String
        ): TipoRecordatorio!

        updateTipoRecordatorio(
            id_tipo_recordatorio: Int!,
            nombre_tipo: String,
            descripcion: String
        ): TipoRecordatorio!

        deleteTipoRecordatorio(id_tipo_recordatorio: Int!): String!


        addRecordatorio(
            id_perro: Int!,
            id_tipo_recordatorio: Int!,
            titulo: String!,
            descripcion: String,
            fecha_programada: String!,
            estado: String
        ): Recordatorio!

        updateRecordatorio(
            id_recordatorio: Int!,
            id_perro: Int,
            id_tipo_recordatorio: Int,
            titulo: String,
            descripcion: String,
            fecha_programada: String,
            estado: String
        ): Recordatorio!

        deleteRecordatorio(id_recordatorio: Int!): String!


        addCartillaVacunacion(
            id_perro: Int!,
            observaciones_generales: String,
            estado: String
        ): CartillaVacunacion!

        updateCartillaVacunacion(
            id_cartilla: Int!,
            id_perro: Int,
            observaciones_generales: String,
            estado: String
        ): CartillaVacunacion!

        deleteCartillaVacunacion(id_cartilla: Int!): String!


        addVacuna(
            nombre_vacuna: String!,
            descripcion: String,
            edad_recomendada: String,
            requiere_refuerzo: Boolean
        ): Vacuna!

        updateVacuna(
            id_vacuna: Int!,
            nombre_vacuna: String,
            descripcion: String,
            edad_recomendada: String,
            requiere_refuerzo: Boolean
        ): Vacuna!

        deleteVacuna(id_vacuna: Int!): String!


        addCartillaDetalle(
            id_cartilla: Int!,
            id_vacuna: Int!,
            fecha_aplicacion: String,
            proxima_dosis: String,
            veterinaria: String,
            veterinario: String,
            lote_vacuna: String,
            estado: String,
            observaciones: String
        ): CartillaDetalle!

        updateCartillaDetalle(
            id_detalle_cartilla: Int!,
            id_cartilla: Int,
            id_vacuna: Int,
            fecha_aplicacion: String,
            proxima_dosis: String,
            veterinaria: String,
            veterinario: String,
            lote_vacuna: String,
            estado: String,
            observaciones: String
        ): CartillaDetalle!

        deleteCartillaDetalle(id_detalle_cartilla: Int!): String!


        addCitaVeterinaria(
            id_perro: Int!,
            fecha_cita: String!,
            veterinaria: String!,
            motivo: String!,
            diagnostico: String,
            tratamiento: String,
            estado: String
        ): CitaVeterinaria!

        updateCitaVeterinaria(
            id_cita: Int!,
            id_perro: Int,
            fecha_cita: String,
            veterinaria: String,
            motivo: String,
            diagnostico: String,
            tratamiento: String,
            estado: String
        ): CitaVeterinaria!

        deleteCitaVeterinaria(id_cita: Int!): String!


        addHistorialMedico(
            id_perro: Int!,
            tipo_registro: String!,
            descripcion: String!,
            observaciones: String
        ): HistorialMedico!

        updateHistorialMedico(
            id_historial: Int!,
            id_perro: Int,
            tipo_registro: String,
            descripcion: String,
            observaciones: String
        ): HistorialMedico!

        deleteHistorialMedico(id_historial: Int!): String!


        addPublicacion(
            id_usuario: Int!,
            titulo: String!,
            contenido: String!,
            estado: String
        ): Publicacion!

        updatePublicacion(
            id_publicacion: Int!,
            id_usuario: Int,
            titulo: String,
            contenido: String,
            estado: String
        ): Publicacion!

        deletePublicacion(id_publicacion: Int!): String!
    }
`;

module.exports = typeDefs;