const { GraphQLError } = require('graphql');
const fail = (message, code = 'BAD_USER_INPUT') => {
    const status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, SERVICE_UNAVAILABLE: 503 }[code];
    throw new GraphQLError(message, { extensions: { code, ...(status ? { http: { status } } : {}) } });
};
module.exports = { fail };
