// La API solo tiene permisos sobre la base pawly, no sobre otras bases.
db = db.getSiblingDB('pawly');
db.createUser({ user: 'pawly', pwd: process.env.MONGO_PASSWORD, roles: [{ role: 'readWrite', db: 'pawly' }] });
