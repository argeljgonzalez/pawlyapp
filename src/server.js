require('dotenv').config();

const { ApolloServer } = require('apollo-server');
const jwt = require('jsonwebtoken');

const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const db = require('./database/db');

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        let user = null;

        if (token) {
            try {
                user = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                user = null;
            }
        }

        return {
            db,
            user
        };
    }
});

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`);
});