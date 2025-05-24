const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig'); // multer configurado

const { 
  login, 
  refreshToken,
  registerUser 
} = require('../../Logic/controllers/auth');

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/register', upload.single('imagen'), registerUser);

module.exports = router;
