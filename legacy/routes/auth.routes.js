const express = require('express');
const cors = require('cors');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const bodyParser = require('body-parser');

router.use(cors({
    origin: 'http://localhost:3000',
    credentials: false,
}));
router.get('/signup', authController.getSignup);

router.get('/login', authController.getLogin);

router.post('/signup', bodyParser.urlencoded(), authController.signup);
router.post('/login', bodyParser.urlencoded(), authController.login);

router.get('/getAdmin', authController.getAdminCheck);
router.post('/chkPasswd', bodyParser.urlencoded(), authController.checkAdminPasswd);


const redirectUrl = "http://localhost:3000/callback";
const clientId = "TgzqtF7oa0cZSY6TAndwEyGty7DCaYMhFfBk7szn";
const client_secret = "2HDL3JcHx7EyTU8zemx0Wm7nIpSnFN0NfYtETKgUHI9WYZ2hBaJ5PqKUgAjUHoOIVHWyXj8w6LqFadpsqoS0z1kfOkEv3NwLuCg7F1tI6MKFiQHGyBxfvrgmBY4JQwmq";
const state = "random_string";



// router.get('/auth', (req, res) => {
//     const authorizationUrl = `http://internet.channeli.in/oauth/authorise?client_id=${clientId}&redirect_uri=${redirectUrl}&state=${state}`;
//     // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
//     // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
//     // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//     // res.setHeader('Access-Control-Allow-Credentials', 'true');
//     // res.setHeader('Content-Type', 'application/xml'); // Adjust Content-Type based on your needs

//     res.redirect(authorizationUrl);
//     // let codecomp = window.location.search;
//     // var authorisation_code = codecomp.split('$')[0].replace('?code=', '');
//     // console.log(authorisation_code);

//     // const posturl = `http://internet.channeli.in/oauth/token/?client_id=${clientId}&client_secret=${client_secret}&grant_type=authorization_code&redirect_uri=${redirectUrl}&code=${authorisation_code}`;

// });






module.exports = router;