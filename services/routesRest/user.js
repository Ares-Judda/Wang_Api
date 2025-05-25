const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig'); 

const {
    registerUser,
    changePassword,
} = require('../../Logic/controllers/user');

router.post('/register', upload.single('imagen'), registerUser);
router.post('/changePassword', changePassword);

module.exports = router;