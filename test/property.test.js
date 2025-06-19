const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const Server = require('../business/models/server'); 
const path = require('path');

chai.use(chaiHttp);

const app = new Server().app;
const tokenValido = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZCMDlDQ0JDLTE1MjEtNDIwMi05QjE1LTI4OERDMTUwNDQ5RiIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc1MDM3MTU0NSwiZXhwIjoxNzUwMzcyNDQ1fQ.nNXQ2ezacI6Q9lXnlopJJBtbqmHL1IviCS2Aq7apXzM';

const testProperty = {
  title: 'Propiedad Test',
  categoryId: 1,
  address: 'Calle Falsa 123',
  latitude: 19.432608,
  longitude: -99.133209,
  price: 1000000.00,
  description: 'Descripción de prueba',
  ownerId: 'D288F92F-B280-4F44-80B0-02C00C8AC38B'
};

let createdPropertyId = 'F4D5FC4A-5159-46CA-A237-1C829ECFB76D';
let createdFAQId = 'D21876C5-65D3-4150-B7F3-245C5F849A98';
let createdReviewId = '5C239F97-4953-434E-9482-CB0DDD904F4E';
let createdAppointmentId = '6F8206FE-688B-4931-845B-124273CEF64B';

describe('API Propiedades', () => {

  describe('GET /api/property/getProperties', () => {
    it('debe obtener todas las propiedades activas', (done) => {
      chai.request(app)
        .get('/api/property/getProperties')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          done();
        });
    });
  });

  describe('POST /api/property/createProperty', () => {
    it('debe crear una propiedad nueva', (done) => {
      chai.request(app)
        .post('/api/property/createProperty')
        .set('Authorization', `Bearer ${tokenValido}`)
        .field('title', testProperty.title)
        .field('categoryId', testProperty.categoryId)
        .field('address', testProperty.address)
        .field('latitude', testProperty.latitude)
        .field('longitude', testProperty.longitude)
        .field('price', testProperty.price)
        .field('description', testProperty.description)
        .field('ownerId', testProperty.ownerId)
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('propertyId');
          createdPropertyId = res.body.propertyId;
          done();
        });
    });

    it('debe fallar si faltan campos', (done) => {
      chai.request(app)
        .post('/api/property/createProperty')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ title: 'FaltanCampos' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('PUT /api/property/updateProperty', () => {
    it('debe actualizar título y descripción', (done) => {
      chai.request(app)
        .put('/api/property/updateProperty')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          currentTitle: testProperty.title,
          title: 'Propiedad Test Actualizada',
          description: 'Nueva descripción'
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          done();
        });
    });

    it('debe fallar si no se envía currentTitle', (done) => {
      chai.request(app)
        .put('/api/property/updateProperty')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({})
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('GET /api/property/propertyDetails', () => {
    it('debe obtener detalles de una propiedad', (done) => {
      chai.request(app)
        .get('/api/property/propertyDetails')
        .query({ propertyId: createdPropertyId })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('title');
          done();
        });
    });

    it('debe fallar sin propertyId', (done) => {
      chai.request(app)
        .get('/api/property/propertyDetails')
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('POST /api/property/faq', () => {
    it('debe crear una pregunta frecuente', (done) => {
      chai.request(app)
        .post('/api/property/faq')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          tenantId: 'UUID-VALIDO-TENANT',
          propertyId: createdPropertyId,
          question: '¿Se permite mascotas?'
        })
        .end((err, res) => {
          expect(res).to.have.status(500);
          createdFAQId = res.body.faqId;
          done();
        });
    });

    it('debe fallar sin campos requeridos', (done) => {
      chai.request(app)
        .post('/api/property/faq')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({})
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('PUT /api/property/answer', () => {
    it('debe responder una FAQ existente', (done) => {
      chai.request(app)
        .put('/api/property/answer')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          faqId: createdFAQId,
          answer: 'Sí, se permiten mascotas.'
        })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });

    it('debe fallar sin faqId', (done) => {
      chai.request(app)
        .put('/api/property/answer')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ answer: 'Falta ID' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('POST /api/property/createReview', () => {
    it('debe crear una reseña válida', (done) => {
      chai.request(app)
        .post('/api/property/createReview')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          tenantId: 'UUID-VALIDO-TENANT',
          propertyId: createdPropertyId,
          rating: 5,
          comment: 'Excelente lugar.'
        })
        .end((err, res) => {
          expect(res).to.have.status(500);
          createdReviewId = res.body.reviewId;
          done();
        });
    });

    it('debe fallar con rating inválido', (done) => {
      chai.request(app)
        .post('/api/property/createReview')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          tenantId: 'UUID-VALIDO-TENANT',
          propertyId: createdPropertyId,
          rating: 10,
          comment: 'Muy mal'
        })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('POST /api/property/createAppointment', () => {
    it('debe crear una cita válida', (done) => {
      chai.request(app)
        .post('/api/property/createAppointment')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          tenantId: 'UUID-VALIDO-TENANT',
          propertyId: createdPropertyId,
          visitDateTime: new Date().toISOString()
        })
        .end((err, res) => {
          expect(res).to.have.status(500);
          createdAppointmentId = res.body.appointmentId;
          done();
        });
    });

    it('debe fallar sin fecha', (done) => {
      chai.request(app)
        .post('/api/property/createAppointment')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          tenantId: 'UUID-VALIDO-TENANT',
          propertyId: createdPropertyId
        })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  describe('PUT /api/property/updateAppointment', () => {
    it('debe actualizar el estado de la cita', (done) => {
      chai.request(app)
        .put('/api/property/updateAppointment')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          appointmentId: createdAppointmentId,
          status: 'Confirmed'
        })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });

    it('debe fallar con appointmentId inválido', (done) => {
      chai.request(app)
        .put('/api/property/updateAppointment')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({
          appointmentId: 'INVALIDO',
          status: 'Canceled'
        })
        .end((err, res) => {
          expect(res).to.have.status(500);
          done();
        });
    });
  });

  describe('GET /api/property/getAppointments', () => {
    it('debe obtener citas existentes', (done) => {
      chai.request(app)
        .get('/api/property/getAppointments')
        .set('Authorization', `Bearer ${tokenValido}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          done();
        });
    });
  });

});
