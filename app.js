require('dotenv').config();
const Server = require('./business/models/server');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const server = new Server();
server.listen(); 