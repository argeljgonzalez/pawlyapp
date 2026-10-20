-- Esquema local derivado de los tipos y resolvers GraphQL.
-- No es una copia del esquema remoto. Sin datos personales ni credenciales.
-- Las claves foráneas usan RESTRICT para evitar borrados implícitos de dependencias.
CREATE TABLE usuarios (
 id_usuario INT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(255) NOT NULL, apellido VARCHAR(255) NOT NULL,
 correo VARCHAR(255) NOT NULL UNIQUE, contrasena VARCHAR(255) NOT NULL,
 telefono VARCHAR(50), fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
 estado VARCHAR(50) DEFAULT 'activo'
);
CREATE TABLE razas (
 id_raza INT AUTO_INCREMENT PRIMARY KEY, nombre_raza VARCHAR(255) NOT NULL,
 pais_origen VARCHAR(255), tamano VARCHAR(50) NOT NULL,
 esperanza_vida VARCHAR(100), temperamento TEXT, descripcion TEXT
);
CREATE TABLE perros (
 id_perro INT AUTO_INCREMENT PRIMARY KEY,
 id_usuario INT NOT NULL, id_raza INT NOT NULL, nombre VARCHAR(255) NOT NULL,
 edad INT, sexo VARCHAR(50) NOT NULL, peso DOUBLE, color VARCHAR(100),
 fecha_nacimiento DATE, fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
 FOREIGN KEY (id_raza) REFERENCES razas(id_raza)
);
CREATE TABLE ubicaciones (
 id_ubicacion INT AUTO_INCREMENT PRIMARY KEY, id_perro INT NOT NULL,
 latitud DOUBLE NOT NULL, longitud DOUBLE NOT NULL,
 fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP, estado VARCHAR(50) DEFAULT 'activo',
 FOREIGN KEY (id_perro) REFERENCES perros(id_perro)
);
CREATE TABLE tipos_recordatorio (
 id_tipo_recordatorio INT AUTO_INCREMENT PRIMARY KEY,
 nombre_tipo VARCHAR(255) NOT NULL, descripcion TEXT
);
CREATE TABLE recordatorios (
 id_recordatorio INT AUTO_INCREMENT PRIMARY KEY,
 id_perro INT NOT NULL, id_tipo_recordatorio INT NOT NULL,
 titulo VARCHAR(255) NOT NULL, descripcion TEXT, fecha_programada DATETIME NOT NULL,
 estado VARCHAR(50) DEFAULT 'pendiente',
 FOREIGN KEY (id_perro) REFERENCES perros(id_perro),
 FOREIGN KEY (id_tipo_recordatorio) REFERENCES tipos_recordatorio(id_tipo_recordatorio)
);
CREATE TABLE cartillas_vacunacion (
 id_cartilla INT AUTO_INCREMENT PRIMARY KEY, id_perro INT NOT NULL,
 fecha_creacion DATE DEFAULT (CURRENT_DATE), observaciones_generales TEXT,
 estado VARCHAR(50) DEFAULT 'activo',
 FOREIGN KEY (id_perro) REFERENCES perros(id_perro)
);
CREATE TABLE vacunas (
 id_vacuna INT AUTO_INCREMENT PRIMARY KEY, nombre_vacuna VARCHAR(255) NOT NULL,
 descripcion TEXT, edad_recomendada VARCHAR(100), requiere_refuerzo BOOLEAN DEFAULT FALSE
);
CREATE TABLE cartilla_detalle (
 id_detalle_cartilla INT AUTO_INCREMENT PRIMARY KEY,
 id_cartilla INT NOT NULL, id_vacuna INT NOT NULL,
 fecha_aplicacion DATE, proxima_dosis DATE, veterinaria VARCHAR(255),
 veterinario VARCHAR(255), lote_vacuna VARCHAR(100),
 estado VARCHAR(50) DEFAULT 'pendiente', observaciones TEXT,
 FOREIGN KEY (id_cartilla) REFERENCES cartillas_vacunacion(id_cartilla),
 FOREIGN KEY (id_vacuna) REFERENCES vacunas(id_vacuna)
);
CREATE TABLE citas_veterinarias (
 id_cita INT AUTO_INCREMENT PRIMARY KEY, id_perro INT NOT NULL,
 fecha_cita DATETIME NOT NULL, veterinaria VARCHAR(255) NOT NULL,
 motivo TEXT NOT NULL, diagnostico TEXT, tratamiento TEXT,
 estado VARCHAR(50) DEFAULT 'pendiente',
 FOREIGN KEY (id_perro) REFERENCES perros(id_perro)
);
CREATE TABLE historial_medico (
 id_historial INT AUTO_INCREMENT PRIMARY KEY, id_perro INT NOT NULL,
 tipo_registro VARCHAR(100) NOT NULL, descripcion TEXT NOT NULL,
 fecha_registro DATE DEFAULT (CURRENT_DATE), observaciones TEXT,
 FOREIGN KEY (id_perro) REFERENCES perros(id_perro)
);
CREATE TABLE publicaciones (
 id_publicacion INT AUTO_INCREMENT PRIMARY KEY, id_usuario INT NOT NULL,
 titulo VARCHAR(255) NOT NULL, contenido TEXT NOT NULL,
 fecha_publicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
 estado VARCHAR(50) DEFAULT 'activo',
 FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);
