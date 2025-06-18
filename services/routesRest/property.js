const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig');

const { getProperties, createProperty, updateProperty, 
    getPropertyDetails, createFAQ, updateFAQAnswer, 
    getContracts, createPayment } = require('../../Logic/controllers/property');

router.get('/getProperties', getProperties);
router.post('/createProperty', upload.array('images', 10), createProperty);
router.put('/updateProperty', upload.array('images', 10), updateProperty);
router.get('/propertyDetails', getPropertyDetails);
router.post('/faq', createFAQ);
router.put('/answer', updateFAQAnswer);
router.get('/contracts', getContracts)
router.post('/createPayment', createPayment);

module.exports = router;