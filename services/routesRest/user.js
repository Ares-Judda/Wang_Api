const express = require('express');
const router = express.Router();
const upload = require('../../business/helpers/multerConfig');
const verifyTokenAndRefresh = require('../../business/middleware/verifyToken'); 

const {
    registerUser,
    changePassword,
    getAllUsers,
    getUserProfile
} = require('../../Logic/controllers/user');

router.post('/register', upload.single('imagen'), registerUser);
router.post('/changePassword', changePassword);
router.get('/', verifyTokenAndRefresh, getAllUsers); 
router.get('/profile', verifyTokenAndRefresh, getUserProfile);

module.exports = router;