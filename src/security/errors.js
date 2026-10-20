const { GraphQLError } = require('graphql');
const fail = (message, code = 'BAD_USER_INPUT') => {
    throw new GraphQLError(message, { extensions: { code } });
};
module.exports = { fail };
