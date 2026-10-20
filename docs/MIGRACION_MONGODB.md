# Backend completo en MongoDB

Rama: `feature/backend-mongodb`. No cambia el contrato GraphQL ni la regla de que
un usuario puede registrar varias mascotas. Redis conserva caché, TTL, sesiones
JWT y logout; Neo4j conserva su demostración RBAC.

## Colecciones y relaciones

MongoDB guarda `usuarios`, `razas`, `perros`, `ubicaciones`, `tipos_recordatorio`,
`recordatorios`, `cartillas_vacunacion`, `vacunas`, `cartilla_detalle`,
`citas_veterinarias`, `publicaciones` e `historiales_medicos`.
Los identificadores siguen siendo enteros GraphQL. `counters` asigna IDs únicos;
los índices únicos evitan IDs y correos duplicados. Las referencias conservan
sus campos (`id_usuario`, `id_perro`, etc.). Mongoose valida tipos y la API
comprueba que el documento relacionado exista y sea accesible para el usuario.

Las escrituras utilizan transacciones y un documento en `integrity_locks` para
serializar cambios relacionados y evitar huérfanos. No se permiten borrados de
padres con dependientes. Este mecanismo es sencillo para el proyecto semestral,
pero serializa escrituras y no pretende resolver una carga masiva. Las escrituras
manuales externas a la API deben respetar esas mismas reglas.

MongoDB usa un replica set de un nodo `rs0`, necesario para las transacciones.
`mongo-setup` lo inicializa y termina correctamente; que aparezca como `Exited (0)`
es normal. `mongo_keyfile` guarda la clave interna, fuera de Git. No es un esquema
de alta disponibilidad. Redis se invalida después de confirmar MongoDB y mantiene
su comportamiento de recuperación existente.

## Instalación nueva

```bash
cp .env.example .env
# Configura tus propias contraseñas y JWT_SECRET.
docker compose up -d --build --wait
docker compose exec api npm run seed:demo
```

No se necesita MySQL, knex ni mysql2. La API espera a MongoDB, a la inicialización
del replica set y a Redis. La cuenta demo mantiene Luna, Max y cinco historiales.

## Importar una instalación anterior

1. Detén la API y guarda respaldos de MySQL y MongoDB antes de cambiar de versión.
2. Exporta usando la imagen anterior, que todavía contiene mysql2 y la configuración
   de MySQL. El ayudante `scripts/legacy/export-mysql.cjs` es solo de migración,
   no forma parte del backend en ejecución. Debe copiarse antes de cambiar la rama.

```bash
mkdir -p .migration-private
chmod 700 .migration-private
docker compose stop api
# En la versión anterior, con el archivo del ayudante disponible:
docker compose run --rm --no-deps -T api node < scripts/legacy/export-mysql.cjs > .migration-private/mysql-export.json
chmod 600 .migration-private/mysql-export.json
```

3. Cambia a esta rama y conserva las mismas claves Mongo/Redis en `.env`. Las variables
   MySQL antiguas dejan de usarse. Conserva sus respaldos y volumen para recuperación.

```bash
docker compose up -d --wait bda-mongodb mongo-setup bda-redis-stack
docker compose build api
docker compose run --rm --no-deps -v "$PWD/.migration-private:/migration:ro" api npm run migrate:mysql -- /migration/mysql-export.json
docker compose up -d --wait
```

La importación conserva IDs, fechas, contraseñas y los historiales ya existentes.
Valida referencias, ajusta los contadores y no sobrescribe registros diferentes.
Es repetible: omite documentos idénticos. Si detecta un conflicto, revierte toda
la transacción. Resuelve el conflicto antes de volver a ejecutar el comando.
Si falla Redis después del commit, repite la importación para invalidar la caché.
El JSON y los respaldos privados están excluidos de Git y de la imagen Docker.

No borres el volumen MySQL original durante la migración. El contenedor antiguo
puede detenerse después de verificar el resultado. No hay sincronización entre
motores: volver a la rama anterior requiere un plan de recuperación, y no incorpora
los cambios nuevos que ya se hayan guardado en MongoDB.

## Verificación

```bash
docker compose exec api npm test
docker compose exec api npm run test:integration
docker compose exec api npm run test:mongo
curl http://localhost:4000/health
```

La integración verifica los 12 módulos, permisos, bcrypt, JWT, sesiones, logout,
TTL, caché, agregaciones y aislamiento entre usuarios. `test:mongo` verifica
referencias, rollback, IDs concurrentes, carreras de borrado e importaciones.
Ambas pruebas crean y eliminan sus datos temporales; son para desarrollo.
Los archivos antiguos de evidencia del parcial corresponden a la versión anterior.
