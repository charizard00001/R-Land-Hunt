const User = require('../models/user.model');
const authUtil = require('../util/authentication');
const sessionFlash = require('../util/session-flash');


function getSignup(req, res) {
    let sessionData = sessionFlash.getSessioData(req);

    if (!sessionData) {
        sessionData = {
            enrollementNo: '',
            password: '',
            confirmPassword: '',
        };
    }
    res.render('register', {inputData: sessionData});
}

async function signup(req, res) {
    // console.log(req.body);
    const user = new User(req.body.enrollementNo, req.body.password);
    const enteredData = {
        enrollementNo: req.body.enrollementNo,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
    }
    let existingUser;
    try {
        existingUser = await user.getUserWithSameEnrollementNo();
    }catch(err){
        console.log(err);
    }
    console.log(existingUser);
    if (existingUser) {
        sessionFlash.flashDataToSession(req, { error: 'User already exists', ...enteredData}, () => {
            res.redirect('/signup');
        });
        return;
    }

    if (req.body.password !== req.body.confirmPassword) {
        sessionFlash.flashDataToSession(req, { error: 'Passwords do not match', ...enteredData }, () => {
            res.redirect('/signup');
        });
        return;
    }
    user.signup().then(function () {
        res.redirect('/');
    }).catch(function (err) {
        console.log(err);
    });
}

function getLogin(req, res) {
    let sessionData = sessionFlash.getSessioData(req);

    if (!sessionData) {
        sessionData = {
            enrollementNo: '',
            password: '',
        };
    }
    res.render('login' , {inputData: sessionData});
}

async function login(req, res) {
    const user = new User(req.body.enrollementNo, req.body.password);
    const enteredData ={
        enrollementNo: req.body.enrollementNo,
        password: req.body.password
    }
    // console.log(req.body);
    const existingUser = await user.getUserWithSameEnrollementNo();
    // console.log(existingUser);

    if (!existingUser) {
        sessionFlash.flashDataToSession(req, { error: 'Invalid Username', ...enteredData }, () => {
            res.redirect('/login');
        });
        return;
    }

    const isPasswordCorrect = await user.hasMatchingPassword(existingUser.password);

    if (!isPasswordCorrect) {
        sessionFlash.flashDataToSession(req, { error: 'Invalid Password', ...enteredData }, () => {
            res.redirect('/login');
        });
        return;
    }

    authUtil.createUserSession(req, existingUser,()=>{
        res.redirect('/identity');
    });
}

function logout(req,res){
    authUtil.destroyUserAuthSession(req);
    res.redirect('/index');
     
}


function checkAdminPasswd(req,res){
    let passwd = req.body.passwd;
    const enteredData ={
        passwd: req.body.passwd
    }
    if (!passwd || passwd == null || passwd == undefined) {
        sessionFlash.flashDataToSession(req, { error: 'Invalid Password', ...enteredData }, () => {
            res.redirect('/admin');
        });
        return;
    }

    if(passwd === 'MDGSOC23'){
        res.redirect('/menu');
    }
    else{
        sessionFlash.flashDataToSession(req, { error: 'Invalid Password', ...enteredData }, () => {

            res.redirect('/getAdmin');
        });
        return;
    }
}   

function getAdminCheck(req, res) {
    let sessionData = sessionFlash.getSessioData(req);
    console.log(sessionData);

    if (!sessionData) {
        sessionData = {
            passwd: '',
        };
    }
    
    res.render('admin' , {inputData: sessionData});
    // res.render('admin');
}


module.exports = {
    getSignup: getSignup,
    getLogin: getLogin,
    login: login,
    signup: signup,
    logout:logout,
    checkAdminPasswd:checkAdminPasswd,
    getAdminCheck:getAdminCheck
};


