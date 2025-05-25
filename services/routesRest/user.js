const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig'); 

const {
    registerUser,
} = require('../../Logic/controllers/user');

router.post('/register', upload.single('imagen'), registerUser);

module.exports = router;