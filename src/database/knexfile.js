require('dotenv').config();

module.exports = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: Number(process.env.DB_PORT),
        // Docker local desactiva TLS; las conexiones remotas verifican el certificado.
        ssl: process.env.DB_SSL === 'false' ? false : {
            rejectUnauthorized: true,
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {})
        }
    }
};