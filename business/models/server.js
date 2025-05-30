const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connection = require('../../business/models/database');
const path = require('path');


class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT;
        this.middlewares();
        this.routes();
        this.setupSwagger();
      
    }

    middlewares() {
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }));
        this.app.use(express.json());
        this.app.use(express.static('public'));
        this.app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
    }

    routes() {
        
    }

    setupSwagger() {
        
    }

    listen() {
    const { poolConnect } = require('../../business/models/database');

    poolConnect
        .then(() => {
            console.log(' Conexión exitosa a la base de datos');
            this.app.listen(this.port, () => {
                console.log(` Server listening on port ${this.port}`);
                console.log(` Swagger en: http://localhost:${this.port}/api-docs`);
            });
        })
        .catch(err => {
            console.error('❌ Error de conexión a la base de datos:', err);
            process.exit(1); 
        });
    }

}

module.exports = Server;