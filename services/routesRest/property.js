const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig');

const { getProperties, createProperty, updateProperty, 
    getPropertyDetails, createFAQ, updateFAQAnswer, createReview, 
    createAppointment, updateAppointmentStatus, getAppointments } = require('../../Logic/controllers/property');

router.get('/getProperties', getProperties);
router.post('/createProperty', upload.array('images', 10), createProperty);
router.put('/updateProperty', upload.array('images', 10), updateProperty);
router.get('/propertyDetails', getPropertyDetails);
router.post('/faq', createFAQ);
router.put('/answer', updateFAQAnswer);
router.post('/createReview', createReview);
router.post('/createAppointment', createAppointment);
router.put('/updateAppointment', updateAppointmentStatus);
router.get('/getAppointments', getAppointments);

module.exports = router;