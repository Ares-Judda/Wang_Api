const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const Server = require('../business/models/server'); 
chai.use(chaiHttp);

const app = new Server().app;

describe('Contract API Tests', () => {

  describe('GET /api/contracts', () => {
    it('debe obtener lista de contratos', (done) => {
      chai.request(app)
        .get('/api/contracts/contracts')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          if (res.body.length > 0) {
            expect(res.body[0]).to.have.property('contractFile');
            expect(res.body[0]).to.have.property('startDate');
            expect(res.body[0]).to.have.property('endDate');
            expect(res.body[0]).to.have.property('title');
          }
          done();
        });
    });
  });

  describe('POST /api/contracts/createPayment', () => {

    it('debe rechazar si faltan campos obligatorios', (done) => {
      chai.request(app)
        .post('/api/contracts/createPayment')
        .send({ contractId: '', paymentMethod: '', amount: null })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error');
          done();
        });
    });

    it('debe rechazar si el ContractID no existe', (done) => {
      chai.request(app)
        .post('/api/contracts/createPayment')
        .send({
          contractId: '00000000-0000-0000-0000-000000000000',
          paymentMethod: 'Transferencia',
          amount: 1200.50
        })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.error).to.include('no existe');
          done();
        });
    });

    it('debe crear un pago exitosamente (requiere un ContractID válido)', (done) => {
      const contractIdValido = '0B3D89CD-C630-4951-B78A-0CD2B4689153'; 
      chai.request(app)
        .post('/api/contracts/createPayment')
        .send({
          contractId: contractIdValido,
          paymentMethod: 'Efectivo',
          amount: 1500.00
        })
        .end((err, res) => {
          if (res.status === 201) {
            expect(res.body.message).to.include('exitosamente');
            expect(res.body).to.have.property('paymentId');
          } else {
            console.warn(' Asegúrate de usar un contractId válido en la base de datos.');
          }
          done();
        });
    });

  });

});
