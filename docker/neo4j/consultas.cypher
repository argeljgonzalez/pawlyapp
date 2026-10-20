// Mostrar todo el grafo en Neo4j Browser.
MATCH p=()-[]->() RETURN p;
// Permisos directos y heredados: incluir HEREDA_DE*0.. para ambos casos.
MATCH (u:Usuario {id:'demo-admin'})-[:TIENE_ROL]->(:Rol)-[:HEREDA_DE*0..]->(:Rol)-[:TIENE_PERMISO]->(p:Permiso)-[:SOBRE]->(r:Recurso)
RETURN DISTINCT u.nombre, p.nombre, r.nombre;
// Dueño de varias mascotas.
MATCH (u:Usuario {id:'demo-ana'})-[:ES_DUENO_DE]->(m:Recurso) RETURN u.nombre, collect(m.nombre) AS mascotas;
// Combina permiso de rol y propiedad de la mascota. Cambia mascota-luna por otro ID para probar denegación.
MATCH (u:Usuario {id:'demo-ana'})-[:TIENE_ROL]->(:Rol)-[:HEREDA_DE*0..]->(:Rol)-[:TIENE_PERMISO]->(:Permiso {nombre:'leer_historial'})-[:SOBRE]->(:Recurso {id:'historiales'})-[:APLICA_A]->(m:Recurso {id:'mascota-luna'})
WHERE EXISTS { MATCH (u)-[:ES_DUENO_DE]->(m) }
RETURN count(*) > 0 AS permitido;
// Debe devolver false: el dueño no gestiona catálogos.
MATCH (:Usuario {id:'demo-ana'})-[:TIENE_ROL]->(:Rol)-[:HEREDA_DE*0..]->(:Rol)-[:TIENE_PERMISO]->(:Permiso {nombre:'gestionar_catalogos'})
RETURN count(*) > 0 AS permitido;
