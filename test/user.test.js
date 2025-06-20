const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const Server = require('../business/models/server'); 
chai.use(chaiHttp);

const app = new Server().app;
 const tokenValido = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZCMDlDQ0JDLTE1MjEtNDIwMi05QjE1LTI4OERDMTUwNDQ5RiIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc1MDM3MTU0NSwiZXhwIjoxNzUwMzcyNDQ1fQ.nNXQ2ezacI6Q9lXnlopJJBtbqmHL1IviCS2Aq7apXzM';
describe('User API Tests', () => {
  
  describe('POST /api/user/register', () => {
    it('debe rechazar si faltan campos obligatorios', (done) => {
      chai.request(app)
        .post('/api/user/register')
        .send({ email: 'correo@prueba.com', password: '123456' }) 
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error');
          done();
        });
    });

    it('debe rechazar email con formato inválido', (done) => {
      chai.request(app)
        .post('/api/user/register')
        .send({ email: 'correo-mal-formato', password: '123456', name: 'A', lastname: 'B', userName: 'user1' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('correo electrónico');
          done();
        });
    });

    it('debe rechazar contraseña inválida', (done) => {
      chai.request(app)
        .post('/api/user/register')
        .send({ email: 'correo@prueba.com', password: '123', name: 'A', lastname: 'B', userName: 'user1' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('contraseña');
          done();
        });
    });

    it('debe rechazar email ya registrado', (done) => {
      chai.request(app)
        .post('/api/user/register')
        .send({ email: 'ares.juuda@gmail.com', password: '123456', name: 'A', lastname: 'B', userName: 'user2', role: 'admin' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('correo ya está registrado');
          done();
        });
    });

    it('debe registrar usuario correctamente', (done) => {
      chai.request(app)
        .post('/api/user/register')
        .send({ email: 'nuevo@correo011.com', password: '123456!', name: 'Nombre', lastname: 'Apellido', userName: 'nuevoUser011', role: 'LANDLORD' })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body.message).to.include('exitosamente');
          done();
        });
    });
  });

  describe('POST /api/user/changePassword', () => {
    
    it('debe cambiar contraseña correctamente', (done) => {
      chai.request(app)
        .post('/api/user/changePassword')
        .send({ email: 'ares.judda@gmail.com', newPassword: 'Escorpion2003*', confirmPassword: 'Escorpion2003*' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.message).to.include('actualizado');
          done();
        });
    });
  });

  describe('GET /api/user/', () => {
    it('debe rechazar sin token', (done) => {
      chai.request(app)
        .get('/api/user/')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('debe obtener lista de usuarios con token válido', (done) => {
      chai.request(app)
        .get('/api/user/')
         .set('Authorization', `Bearer ${tokenValido}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.users).to.be.an('array');
          done();
        });
    });
  });

  describe('GET /api/user/profile', () => {
    
    it('debe responder con datos de usuario', (done) => {
      chai.request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${tokenValido}`)
        .query({ email: 'ares.judda@gmail.com' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.user).to.have.property('Email');
          done();
        });
    });

    it('debe rechazar sin token', (done) => {
      chai.request(app)
        .get('/api/user/profile')
        .query({ email: 'ares.judda@gmail.com' })
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  describe('PUT /api/user/updateProfile', () => {
    it('debe rechazar campos vacíos', (done) => {
      chai.request(app)
        .put('/api/user/updateProfile')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ email: '', fullName: '', phone: '', address: '' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.error).to.include('campos vacíos');
          done();
        });
    });

    it('debe actualizar perfil correctamente', (done) => {
      chai.request(app)
        .put('/api/user/updateProfile')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ email: 'ares.judda@gmail.com', fullName: 'Ares Judda', phone: '2281972013', address: 'Francisco Hernandez de Cordoba' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.message).to.include('modificado');
          done();
        });
    });

    it('debe rechazar sin token', (done) => {
      chai.request(app)
        .put('/api/user/updateProfile')
        .send({ email: 'ares.judda@gmail.com', fullName: 'Ares Judda', phone: '2281972013', address: 'Francisco Hernandez de Cordoba' })
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

});
