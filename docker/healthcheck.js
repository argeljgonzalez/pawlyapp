// Comprueba tanto GraphQL como la conexión a MySQL sin modificar datos.
fetch('http://127.0.0.1:4000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ razas(limit: 1) { id_raza } }' }),
    signal: AbortSignal.timeout(4000)
}).then(async (response) => {
    const body = await response.json();
    if (!response.ok || body.errors || !body.data) process.exit(1);
}).catch(() => process.exit(1));
