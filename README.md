# PawlyApp API

Backend actual de Pawly, desarrollado con Node.js, GraphQL, Apollo Server 5,
MySQL, Knex y JWT para el proyecto de Bases de Datos II. Gestiona usuarios,
perros, razas, ubicaciones, recordatorios, vacunas, citas, historiales y publicaciones.
La migración prevista a Django aún no está implementada en este repositorio.

## Ejecutar con Docker

Requisito: Docker Desktop en ejecución (o Docker Engine con el plugin Compose).
No necesitas instalar Node.js ni MySQL en tu computadora.

```bash
git clone https://github.com/argeljgonzalez/pawlyapp.git
cd pawlyapp
cp .env.example .env
docker compose up -d --build --wait
```

En PowerShell utiliza `Copy-Item .env.example .env` en lugar de `cp`.
Antes de iniciar, cambia las contraseñas y `JWT_SECRET` en `.env` por valores
propios. No subas ese archivo: está excluido de Git y del contexto de construcción.
Las plantillas de ejemplo sí se versionan.

API local: http://localhost:4000/

```bash
curl http://localhost:4000/ -H 'Content-Type: application/json' --data '{"query":"{ razas { id_raza nombre_raza } }"}'
```

Inicialmente devuelve una lista vacía. No se crean cuentas ni datos de ejemplo.
La API está publicada solo en la interfaz local de la computadora. MySQL es
accesible desde la red interna de Compose, sin publicar el puerto 3306.
Desde el emulador Android estándar, el host se alcanza mediante `10.0.2.2`;
la app actual requiere adaptar sus servicios REST para consumir esta API GraphQL.

### Servicios y configuración

- `api`: Node.js 22, construido con las versiones de `package-lock.json`.
- `db`: MySQL 8.4 con volumen persistente `mysql_data`.
- `docker/mysql/init/001-schema.sql`: crea las 12 tablas al inicializar una base vacía.

El esquema se dedujo del código GraphQL; no representa un respaldo de la base
remota. Incluye relaciones con claves foráneas, correo único y fechas por defecto.
Las dependencias deben borrarse antes que sus registros padres.

| Variable en `.env` | Uso |
| --- | --- |
| `API_PORT` | Puerto local de la API; predeterminado 4000 |
| `DB_PASSWORD` | Contraseña del usuario MySQL `pawly` |
| `MYSQL_ROOT_PASSWORD` | Contraseña administrativa de MySQL |
| `JWT_SECRET` | Clave aleatoria de al menos 32 bytes para firmar tokens |
| `ADMIN_USER_IDS` | IDs de usuarios administradores, separados por coma; vacío por defecto |
| `CORS_ORIGINS` | Orígenes web permitidos, separados por coma |
| `GRAPHQL_INTROSPECTION` | `true` solo cuando necesites explorar el esquema en desarrollo |

Compose fija el host `db`, puerto `3306`, usuario y base `pawly` para la conexión
interna. Establece `DB_SSL=false` para MySQL local. Fuera de Compose, TLS está habilitado por defecto y verifica el certificado.
Para una autoridad privada configura `DB_SSL_CA` con su certificado PEM; no se
desactiva la verificación del certificado.

La API espera a que MySQL tenga las tablas disponibles. Su comprobación de salud
consulta GraphQL y MySQL sin modificar datos, siguiendo el mecanismo de
[dependencias saludables de Compose](https://docs.docker.com/compose/how-tos/startup-order/).

### Comandos habituales

```bash
# Estado y registros
docker compose ps
docker compose logs --tail=100 api db

# Detener conservando los datos
docker compose down

# Volver a iniciar, o reconstruir después de cambiar el código
docker compose up -d --build --wait

# Consola MySQL (solicita DB_PASSWORD)
docker compose exec db mysql -u pawly -p pawly
```

Los cambios al SQL de inicio solo se aplican cuando el volumen está vacío.
Cambiar las contraseñas de `.env` tampoco cambia las de una base ya inicializada.
Para conservar datos existentes, aplica los cambios de esquema o contraseñas
explícitamente en MySQL.

**Reinicio destructivo de la base local:** solo si quieres borrar todos sus datos:

```bash
docker compose down -v
docker compose up -d --build --wait
```

Si el puerto 4000 está ocupado, cambia `API_PORT` (por ejemplo a 4001) y vuelve a
iniciar. La primera ejecución descarga imágenes y dependencias y puede tardar.

### Comprobar la instalación

```bash
docker compose exec api node docker/smoke-test.js
```

La prueba crea registros temporales para los 12 módulos, verifica login, JWT,
lecturas y actualización, y elimina sus propios registros al terminar.

## Ejecutar sin Docker

Necesitas Node.js y una base MySQL con las tablas del script SQL. Configura en
`.env`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`,
`JWT_SECRET` y opcionalmente `PORT` (4000 por defecto). Para MySQL local sin TLS,
agrega `DB_SSL=false`.

```bash
npm ci
npm start
```

`npm run dev` también inicia el servidor, sin recarga automática.

## Autenticación y permisos

El registro (`addUsuario`) y el inicio de sesión (`login`) son públicos.
Las contraseñas nuevas requieren al menos 8 caracteres y como máximo 72 bytes
UTF-8; se almacenan con bcrypt (coste 12) y nunca se exponen en GraphQL.

```graphql
mutation {
  addUsuario(nombre: "Ana", apellido: "Pérez", correo: "ana@example.com",
             contrasena: "usa-una-clave-propia") {
    id_usuario nombre correo
  }
}
```

`login(correo: ..., contrasena: ...)` devuelve el token. Para las operaciones
privadas envía `Authorization: Bearer <token>`. El JWT dura una hora y se invalida
si cambia la contraseña, se elimina la cuenta o su estado deja de ser `activo`.
No existe un endpoint de renovación automática.

- Usuarios normales consultan y modifican únicamente su cuenta y sus perros,
  ubicaciones, cartillas, recordatorios, citas, historiales y publicaciones.
- Razas, vacunas y tipos de recordatorio tienen lectura pública.
- Solo administradores pueden modificar esos catálogos, gestionar otras cuentas
  y cambiar el estado de usuarios (`activo` / `inactivo`).
- Cada lista acepta `limit` (50 por defecto, máximo 100) y `offset` (0 por defecto).
- Los errores no devuelven SQL, contraseñas ni trazas internas. Los conflictos de
  datos duplicados o relaciones se identifican con el código `CONFLICT`.

### Configurar un administrador

Registra primero una cuenta y copia su `id_usuario` devuelto por la API. Añade
ese ID a `ADMIN_USER_IDS` en tu `.env` y ejecuta:

```bash
docker compose up -d --wait
```

No hay administrador ni credenciales predeterminadas. Los permisos solo se
asignan desde la configuración del servidor, nunca desde el registro público.

### Contraseñas de una base anterior

El backend ya no acepta contraseñas guardadas en texto plano. Si conectas una
base anterior, respáldala y ejecuta explícitamente esta conversión una sola vez:

```bash
docker compose exec api npm run migrate:passwords
```

La conversión es transaccional, no muestra contraseñas y omite las que ya tienen
hash bcrypt. Las contraseñas vacías o de más de 72 bytes requieren restablecimiento
antes de migrar. No se ejecuta automáticamente contra una base remota. Los tokens
emitidos por la versión anterior requieren iniciar sesión nuevamente.

## Comprobaciones de seguridad

```bash
docker compose exec api npm test
docker compose exec api npm run test:integration
docker compose exec api npm audit --omit=dev
```

La prueba de integración inicia un servidor aislado en el puerto interno 4001 y
usa cuentas temporales para comprobar los 12 módulos, permisos entre usuarios,
hashes, tokens inválidos, cambio de contraseña, validaciones y límites. Limpia
sus registros al terminar; ejecútala en desarrollo, no contra datos de producción.

Se limitan las solicitudes HTTP (120/minuto/IP), las operaciones de login y registro
(20/15 minutos/IP), el tamaño del cuerpo (32 KB) y las selecciones GraphQL.
Los límites se mantienen en memoria por instancia y se reinician con el proceso.
No se confía automáticamente en `X-Forwarded-For`; si incorporas un proxy o varias
instancias, configura la confianza y un almacenamiento compartido de límites de
acuerdo con esa infraestructura. CORS permite por defecto React local en los
puertos 3000 y 5173. La introspección está desactivada salvo configuración explícita.

## Alcance de este entorno

Este Compose es para desarrollo local y conserva Node.js/GraphQL y los módulos
existentes. No incluye todavía Django, React ni otros motores de datos. Para una
publicación en Internet también hace falta configurar HTTPS, secretos del entorno,
respaldos y el proxy correspondiente.

Endpoint remoto documentado previamente: https://pawlyapp.onrender.com/
