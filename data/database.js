require('dotenv').config();
const mongodb = require('mongodb');


const MongoClient = mongodb.MongoClient;

let database;

async function connectToDatabase() {
    const client = await MongoClient.connect('mongodb://0.0.0.0:27017');
    database = client.db('hunt');
}

//atlas link

function getDb() {
    if (!database) {
        throw new Error('Connect first');
    }
    return database;
}

module.exports = {
    connectToDatabase: connectToDatabase,
    getDb: getDb
};

