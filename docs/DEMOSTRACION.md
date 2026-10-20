# Demostración de Pawly

La explicación completa de la rúbrica está en [SEGUNDO_PARCIAL.md](SEGUNDO_PARCIAL.md).
Esta guía sirve para preparar y presentar los datos ficticios sin modificar cuentas reales.

## Datos preparados

Una cuenta, **Ana Demo**, con correo `demo.parcial2@pawly.example`, es dueña de ambas mascotas:

| Mascota | Consultas | Vacunaciones | Total |
| --- | ---: | ---: | ---: |
| Luna | 2 | 1 | 3 |
| Max | 1 | 1 | 2 |
| Ambas | 3 | 2 | 5 |

MySQL guarda la cuenta y las mascotas. MongoDB guarda estos cinco eventos médicos.
Redis guarda temporalmente las consultas y las sesiones. Neo4j muestra un grafo
conceptual con Ana, sus dos mascotas y los permisos de dueño; incluye además un
administrador ficticio para explicar la herencia. Los usuarios del grafo no son
cuentas adicionales para iniciar sesión en la API.

Los IDs se asignan al crear los datos: consulta los reales, no asumas que empiezan en 1.
Las fechas de los historiales corresponden al momento de generación.

## Preparación local

Desde la carpeta del repositorio:

```bash
docker compose up -d --wait
docker compose ps
```

En esta computadora los datos ya están creados. La contraseña y los IDs se guardaron
en `.demo-credentials.txt`, en la raíz del repositorio, excluido de Git y de la imagen
Docker. Ábrelo localmente para iniciar sesión; no lo incluyas en la entrega.

En otra instalación, después de configurar `.env`, crea los datos con:

```bash
docker compose exec api npm run seed:demo
docker compose exec -T bda-neo4j sh -c 'cypher-shell -u neo4j -p "$PAWLY_NEO4J_PASSWORD" -f /scripts/rbac.cypher'
```

El seed muestra una contraseña aleatoria una sola vez. Si la cuenta ya existe,
no cambia su contraseña ni rellena o restablece sus registros. Conserva la salida
privadamente. El seed escribe en distintos motores sin una transacción global;
si falla parcialmente, revisa los datos antes de repetirlo.

## Recorrido para la presentación

Abre Apollo Sandbox en http://localhost:4000/; su configuración está en la sección
11 del documento principal. Ejecuta allí las operaciones incluidas en esa sección.

1. **Login:** usa el correo demo y su contraseña local. Copia el token al header
   `Authorization: Bearer ...`.
2. **Un usuario y varias mascotas:** ejecuta `CuentaYMascotas`. Debe mostrar Ana,
   Luna y Max. Copia el `id_perro` de cada mascota.
3. **Caché:** ejecuta `Historial` dos veces para Luna. En Variables coloca
   `{ "mascota": ID_REAL_DE_LUNA }`, sustituyendo el marcador por un número.
   Si ya estaba cacheado, espera el TTL o realiza el paso siguiente. En los logs
   muestra primero MongoDB y después Redis, junto con la latencia real.
4. **Invalidación:** crea un registro temporal con `NuevoRegistro` y conserva el
   `id_historial` devuelto. La siguiente consulta debe mostrarlo desde MongoDB;
   la posterior, desde Redis. El historial de Max no debe cambiar.
5. **Agregación:** ejecuta `Reporte` para Luna y para todas las mascotas. Inicialmente
   devuelve los conteos de la tabla. El registro temporal incrementa las consultas
   de Luna y el total en uno.
6. **Restaurar el ejemplo:** elimina únicamente el registro temporal que acabas
   de crear con la operación de abajo. El reporte debe volver a cinco eventos.
7. **Sesión:** ejecuta `me`, luego `logout` y nuevamente `me` con el mismo token.
   Debe fallar con HTTP 401. Retira el header revocado antes de otro login.
8. **Grafo:** abre Neo4j Browser y ejecuta `docker/neo4j/consultas.cypher`.
   Muestra las dos mascotas, los permisos heredados y la denegación de gestionar
   catálogos para Ana. Esta demostración conceptual es independiente de la API.

Para eliminar el evento temporal, usa su ID real como variable `registro`:

```graphql
mutation LimpiarEjemplo($registro: Int!) {
  deleteHistorialMedico(id_historial: $registro)
}
```

No elimines los cinco eventos iniciales. Las pruebas de integración crean y limpian
sus propios datos; no requieren borrar los datos demo.

## Accesos en esta computadora

| Interfaz | Dirección local |
| --- | --- |
| Apollo Sandbox | http://localhost:4000/ |
| RedisInsight | http://localhost:8002/ |
| Neo4j Browser | http://localhost:7475/ |
| Neo4j Bolt | bolt://localhost:7688 |

Estos puertos locales evitan conflictos con otros contenedores. Una instalación
nueva usa los valores de `.env.example`: RedisInsight 8001, Neo4j 7474 y Bolt 7687.
Las contraseñas de Redis y Neo4j están en el `.env` local.

## Evidencia y conservación

Se verificó por la API que existen las dos mascotas y cinco eventos. Después de
reiniciar MongoDB y Redis, los cinco eventos siguen disponibles y el token revocado
continúa rechazado con HTTP 401. Los cinco servicios quedaron saludables.

La evidencia de rendimiento está en [evidencia-parcial2.json](evidencia-parcial2.json);
la comprobación adicional de reinicio está en
[evidencia-demostracion.json](evidencia-demostracion.json).

Para detener conservando la información usa `docker compose down`. Para iniciar
usa `docker compose up -d --wait`. No añadas `-v` si quieres conservar los volúmenes.
