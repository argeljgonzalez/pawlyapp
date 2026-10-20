require('dotenv').config();
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const http = require('node:http');
const { GraphQLError } = require('graphql');
const { contextForRequest } = require('./security/auth');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { connectMongo, closeMongo, mongoose } = require('./database/mongo');
const { connectRedis, closeRedis, redisClient } = require('./database/redis');
const { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageDisabled } = require('@apollo/server/plugin/landingPage/default');

// Count expanded selections, including aliases/fragments, before executing queries.
const operationLimit = {
    async requestDidStart() {
        return {
            async didResolveOperation({ document, operation }) {
                const fragments = Object.fromEntries(document.definitions.filter(d => d.kind === 'FragmentDefinition').map(d => [d.name.value, d]));
                let fields = 0;
                function walk(set, depth = 0) {
                    if (!set) return;
                    if (depth > 10) throw new GraphQLError('Consulta demasiado profunda.', { extensions: { code: 'BAD_USER_INPUT' } });
                    for (const selection of set.selections) {
                        if (++fields > 200) throw new GraphQLError('Consulta demasiado grande.', { extensions: { code: 'BAD_USER_INPUT' } });
                        walk(selection.kind === 'FragmentSpread' ? fragments[selection.name.value]?.selectionSet : selection.selectionSet, depth + 1);
                    }
                }
                walk(operation.selectionSet);
            }
        };
    }
};
function formatError(error) {
    const code = error.extensions?.code;
    const safe = ['BAD_USER_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'CONFLICT', 'SERVICE_UNAVAILABLE'];
    if (safe.includes(code)) return { message: error.message, extensions: { code } };
    if (['GRAPHQL_PARSE_FAILED', 'GRAPHQL_VALIDATION_FAILED'].includes(code)) return { message: 'Consulta GraphQL inválida.', extensions: { code } };
    // Database details, traces and input values must never be returned to the client.
    return { message: 'No se pudo completar la operación. Revisa los datos y sus relaciones.', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
}
async function start() {
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) throw new Error('Configura JWT_SECRET con al menos 32 bytes.');
    const app = express();
    const httpServer = http.createServer(app);
    app.disable('x-powered-by');
    const sandbox = process.env.GRAPHQL_INTROSPECTION === 'true';
    app.use(helmet({ contentSecurityPolicy: sandbox ? false : undefined }));
    const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(x => x.trim());
    app.use(cors({ origin: origins }));
    app.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Inténtalo en un minuto.' } }));
    await Promise.all([connectMongo(), connectRedis()]);
    app.get('/health', async (req, res) => {
        try {
            await Promise.all([mongoose.connection.db.command({ ping: 1 }), redisClient.ping()]);
            res.json({ status: 'ok' });
        } catch { res.status(503).json({ status: 'unavailable' }); }
    });
    const server = new ApolloServer({
        typeDefs, resolvers,
        introspection: process.env.GRAPHQL_INTROSPECTION === 'true',
        includeStacktraceInErrorResponses: false,
        allowBatchedHttpRequests: false,
        formatError,
        plugins: [sandbox ? ApolloServerPluginLandingPageLocalDefault({ embed: true }) : ApolloServerPluginLandingPageDisabled(), operationLimit, ApolloServerPluginDrainHttpServer({ httpServer }), {
            async serverWillStart() { return { async drainServer() { await Promise.all([closeMongo(), closeRedis()]); } }; }
        }]
    });
    await server.start();
    app.use('/', express.json({ limit: '32kb' }), expressMiddleware(server, { context: async ({ req }) => contextForRequest(req) }));
    app.use((error, req, res, next) => {
        res.status(error.status === 413 ? 413 : 400).json({ error: 'Solicitud inválida.' });
    });
    await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(Number(process.env.PORT || 4000), '0.0.0.0', resolve);
    });
    console.log(`Pawly API lista en puerto ${process.env.PORT || 4000}`);
}
if (require.main === module) start().catch(error => { console.error(error.message); process.exit(1); });
module.exports = { start, formatError, operationLimit };
