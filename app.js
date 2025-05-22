require('dotenv').config();
const Server = require('./business/models/server');
const server = new Server();
server.listen(); 