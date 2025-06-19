const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const Server = require('../business/models/server');
chai.use(chaiHttp);

const app = new Server().app;

describe('Auth API Tests', () => {

  describe('POST /api/auth/login', () => {

    it('debe rechazar si faltan campos obligatorios', (done) => {
      chai.request(app)
        .post('/api/auth/login')
        .send({ email: 'correo@prueba.com' }) 
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('Faltan campos');
          done();
        });
    });

    it('debe rechazar formato de correo inválido', (done) => {
      chai.request(app)
        .post('/api/auth/login')
        .send({ email: 'invalido', password: 'Valida123!' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('formato del correo');
          done();
        });
    });

    it('debe rechazar credenciales inválidas', (done) => {
      chai.request(app)
        .post('/api/auth/login')
        .send({ email: 'ares.judda@gmail.com', password: 'Valida123!' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('Credenciales');
          done();
        });
    });

    it('debe iniciar sesión correctamente', (done) => {
      chai.request(app)
        .post('/api/auth/login')
        .send({ email: 'ares.judda@gmail.com', password: 'Escorpion2003*' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('accessToken');
          expect(res.body).to.have.property('refreshToken');
          done();
        });
    });

  });

});
