# PawlyApp API

Backend de Pawly con Node.js, Apollo Server 5 y GraphQL. **Un usuario puede registrar
varias mascotas**, cada una con su historial médico. MySQL conserva usuarios,
mascotas y catálogos; MongoDB almacena los historiales; Redis Stack gestiona caché
y sesiones. Neo4j contiene el modelo RBAC conceptual del Segundo Parcial.

La documentación del examen, diagramas, puertos, Cypher, SDL, agregación y guía de
defensa están en **[docs/SEGUNDO_PARCIAL.md](docs/SEGUNDO_PARCIAL.md)**.

## Inicio con Docker

Requisito: Docker Desktop o Docker Engine con Compose en ejecución.

```bash
git clone https://github.com/argeljgonzalez/pawlyapp.git
cd pawlyapp
# Selecciona la rama del parcial cuando esté publicada.
git switch feature/parcial2-nosql-sesiones
cp .env.example .env
# Cambia las contraseñas y JWT_SECRET por valores propios.
docker compose up -d --build --wait
```

En PowerShell usa `Copy-Item .env.example .env`.
API: http://localhost:4000/. La introspección está desactivada por defecto;
consulta la guía del parcial para habilitar Apollo Sandbox local.

```bash
curl http://localhost:4000/ -H 'Content-Type: application/json' --data '{"query":"{ razas(limit: 5) { id_raza nombre_raza } }"}'
```

Los servicios están en la red `pawly_privada`. Los puertos publicados se enlazan
solo a localhost. Si ya tienes contenedores de clase ocupando puertos, cambia
`MONGO_PORT`, `REDIS_PORT`, `REDISINSIGHT_PORT`, `NEO4J_HTTP_PORT` y
`NEO4J_BOLT_PORT` en `.env`. Mantén los puertos internos del Compose.

## Preparar la demostración

Consulta [docs/DEMOSTRACION.md](docs/DEMOSTRACION.md) para el recorrido y los datos esperados.

```bash
# Crea el grafo de ejemplo sin duplicarlo si se repite.
docker compose exec -T bda-neo4j sh -c 'cypher-shell -u neo4j -p "$PAWLY_NEO4J_PASSWORD" -f /scripts/rbac.cypher'

# Crea una cuenta con Luna y Max; muestra una contraseña aleatoria una sola vez.
docker compose exec api npm run seed:demo
```

No hay contraseñas ni administradores predeterminados. Guarda la salida del seed
localmente, nunca en Git. La repetición no reinicia ni duplica una cuenta demo.

## Configuración principal

| Variable | Uso |
| --- | --- |
| `API_PORT` | Puerto local de la API (4000) |
| `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` | Acceso MySQL local |
| `MONGO_PASSWORD`, `MONGO_ROOT_PASSWORD` | Usuario de aplicación y administrador MongoDB |
| `REDIS_PASSWORD` | Contraseña Redis; usa una clave alfanumérica larga sin espacios |
| `NEO4J_PASSWORD` | Contraseña de `neo4j` |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 bytes |
| `ADMIN_USER_IDS` | IDs administradores, separados por coma; vacío por defecto |
| `SESSION_TTL` | Vigencia de sesión y JWT en segundos (3600) |
| `HISTORY_CACHE_TTL` | TTL de caché del historial (60) |
| `CORS_ORIGINS` | Orígenes web permitidos, separados por coma |
| `GRAPHQL_INTROSPECTION` | `true` para la demostración local de Sandbox |

Los TTL aceptan de 1 a 86400 segundos. Las contraseñas de bases ya inicializadas
no cambian por modificar `.env`; deben cambiarse también dentro del motor.
Las credenciales no forman parte de Git ni de la imagen Docker.

## Autenticación y acceso

`addUsuario` y `login` son públicos. Las contraseñas se guardan con bcrypt, mínimo
8 caracteres y máximo 72 bytes. No existe un campo de contraseña consultable.
Cada petición privada usa `Authorization: Bearer <token>` y comprueba la sesión
en Redis, la cuenta activa y la vigencia de la contraseña. `logout` revoca la
sesión actual inmediatamente. Los tokens anteriores a Redis requieren un nuevo login.
Quita un token revocado del header antes de volver a iniciar sesión.

Un usuario administra sus mascotas y sus registros. La lectura de razas, vacunas
y tipos de recordatorio es pública; su escritura exige administrador. Para dar
ese permiso, registra una cuenta, agrega su ID a `ADMIN_USER_IDS` y ejecuta
`docker compose up -d --wait`. No puede asignarse desde el registro público.

Las listas aceptan `limit` (1 a 100, predeterminado 50) y `offset` (desde 0).
El historial admite `id_perro` para consultar y cachear una mascota. El reporte
`resumenHistorialMedico` agrupa por tipo de registro, para una o todas las mascotas.

## Pruebas y mantenimiento

```bash
docker compose exec api npm test
docker compose exec api npm run test:integration
docker compose exec api npm audit --omit=dev
docker compose logs --tail=100 api
docker compose ps
```

Las pruebas de integración usan datos temporales y un servidor aislado interno.
Ejecuta solo contra el entorno de desarrollo. Consulta `docs/evidencia-parcial2.json`
para las mediciones registradas de esta entrega.

```bash
# Detener conservando los datos.
docker compose down
# Aplicar cambios de código y volver a iniciar.
docker compose up -d --build --wait
```

`docker compose down -v` **borra todos los volúmenes del proyecto**; no lo uses si
quieres conservar los datos. Los scripts de inicialización SQL/Mongo se ejecutan
solo sobre volúmenes nuevos.

Para una base anterior, respalda primero y sigue las instrucciones de
`npm run migrate:passwords` (contraseñas SQL en texto plano) y
`npm run migrate:history` (historial SQL a MongoDB) en la guía del parcial.
La importación no borra el origen ni se ejecuta automáticamente.

## Ejecución sin Docker

Necesitas Node.js 22+, MySQL, MongoDB y Redis. Configura `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `MONGO_URI`, `MONGO_USER`, `MONGO_PASSWORD`,
`REDIS_URL`, `REDIS_PASSWORD`, `JWT_SECRET` y opcionalmente `PORT`.
Para MongoDB se usa la base/autenticación `pawly`. MySQL remoto verifica TLS;
usa `DB_SSL_CA` si necesitas una CA privada. `DB_SSL=false` es para MySQL local.

```bash
npm ci
npm start
```

Se conservan los controles de seguridad, límites HTTP y errores sin trazas.
Los límites de solicitudes son por instancia y no confían automáticamente en
`X-Forwarded-For`. Este entorno es local: una publicación requiere HTTPS,
respaldos, secretos propios y configuración del proxy. La migración futura a
Django y los clientes React/Android no forman parte de este parcial.
