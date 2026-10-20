const { fail } = require('./errors');
const textFields = new Set(['descripcion', 'contenido', 'motivo', 'diagnostico', 'tratamiento', 'observaciones', 'observaciones_generales', 'temperamento']);
function validate(args, required = []) {
    for (const key of required) {
        if (key in args && (args[key] === null || (typeof args[key] === 'string' && !args[key].trim()))) fail(`${key} no puede estar vacío.`);
    }
    for (const [key, value] of Object.entries(args)) {
        if (value === null || value === undefined) continue;
        if (key.startsWith('id_') && (!Number.isInteger(value) || value <= 0)) fail(`${key} debe ser un identificador positivo.`);
        if (['edad', 'peso'].includes(key) && value < 0) fail(`${key} no puede ser negativo.`);
        if (key === 'latitud' && Math.abs(value) > 90) fail('Latitud fuera de rango.');
        if (key === 'longitud' && Math.abs(value) > 180) fail('Longitud fuera de rango.');
        if (typeof value === 'string' && key !== 'contrasena') {
            const max = textFields.has(key) ? 10000 : 255;
            if (value.length > max) fail(`${key} excede la longitud permitida.`);
            args[key] = value.trim();
        }
        if (key === 'correo') {
            args[key] = value.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args[key])) fail('Correo inválido.');
        }
        if (key.startsWith('fecha_') || key === 'proxima_dosis') {
            const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/.exec(value);
            const date = match && new Date(`${match[1]}T${match[2] || '00:00:00'}Z`);
            if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== `${match[1]}T${match[2] || '00:00:00'}`) fail(`${key} debe ser una fecha válida (AAAA-MM-DD o AAAA-MM-DD HH:mm:ss).`);
        }
    }
    return args;
}
module.exports = { validate };
