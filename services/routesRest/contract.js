const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig');

const { getContracts, createPayment } = require('../../Logic/controllers/contract');

router.get('/', getContracts);
router.post('/createPayment', createPayment);

module.exports = router;