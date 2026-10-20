// La ruta comprueba las conexiones activas a MongoDB y Redis.
fetch('http://127.0.0.1:4000/health', { signal: AbortSignal.timeout(4000) })
    .then(async response => {
        const body = await response.json();
        if (!response.ok || body.status !== 'ok') process.exit(1);
    }).catch(() => process.exit(1));
