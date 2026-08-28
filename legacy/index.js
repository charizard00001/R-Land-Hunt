require('dotenv').config();
const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const csrf = require('csurf');
const geolaocation = require('geolocation');
const expressSession = require('express-session');
const nodemailer = require('nodemailer');
const authRoutes = require('./routes/auth.routes');
const app = express();

const http = require('http');
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

const db = require('./data/database');
const huntinfoController = require('./controllers/huntinfo.controller');
const upcomingsController = require('./controllers/upcomings.controller');
const addCsrfTokenMiddleware = require('./middlewares/csrf-token');
const createSessionConfig = require('./config/session');
const errorHandler = require('./middlewares/error-handler');
const checkAuthStatus = require('./middlewares/check-auth');
const team_membersController = require('./controllers/team.controller');
const authController = require('./controllers/auth.controller');
const startHuntController = require('./controllers/starthunt.controller');
const enterHuntController = require('./controllers/enterhunt.controller');
const editHuntController = require('./controllers/edithunt.controller');
const Oauthroutes = require('./routes/Oauth.routes');


app.use(cors({
    // origin: utils.allowedDomains(),
    origin: false,
    referer: "*",
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Access-Control-Allow-Origin"
    ]
}));



const sessionConfig = createSessionConfig();
app.use(expressSession(sessionConfig));

app.use(authRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public'));

app.post('/sendMail', bodyParser.json(), (req, res) => {
    const mailOptions = req.body;
    console.log(mailOptions);
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'kacoder2@gmail.com',
            pass: 'guup ogjx azxs xurd'
        }
    })

    transporter.sendMail(mailOptions, function (err, data) {
        if (err) {
            console.log('Error Occurs ' + err);
        } else {
            console.log('Email sent!!!');
        }
    });
});

app.post('/rm_strtd_hunt_data', (req, res) => {
    console.log(req.body.huntname);
    db.getDb().collection('startedHunts').drop().then(function () {
        console.log('done');
    }).catch(function (err) {
        console.log(err);
    });

    db.getDb().collection('upcominghunts').deleteOne({ huntname: req.body.huntname })
        .then(() => {
            console.log('also done')
        })
        .catch((err) => {
            console.log(err);
        })
});

app.use(csrf());

app.use(addCsrfTokenMiddleware);
app.use(express.urlencoded({ extended: true }));

app.use(checkAuthStatus);

app.use(Oauthroutes);
app.get('/', (req, res) => {
    if (res.locals.isAuth) {
        res.redirect('/identity');
    } else {
        res.redirect('/index');
    }
});

app.get('/index', (req, res) => {
    res.render('index');
});
// app.get('/admin', (req, res) => {
//     let inputData = req.session.inputData || {}; // Get inputData from the session
//     res.render('admin', { inputData: inputData }); // Pass inputData to the EJS template
// });
app.get('/identity', (req, res) => {
    res.render('Identity');
});


app.get('/menu', (req, res) => {
    if (res.locals.isAuth) {
        res.render('menu');
    } else {
        res.redirect('/index');
    }
});
app.get('/huntinfo', (req, res) => {
    if (res.locals.isAuth) {
        db.getDb().collection('hunts').find().toArray().then(function (hunts) {
            const huntNames = hunts.map(hunt => hunt.huntname);
            console.log(huntNames);
            res.render('huntinfo', {
                hunt: {
                    huntname: '',
                    data: []
                },
                huntNames: huntNames // This is the array of hunt names
            });
        });
    } else {
        res.redirect('/index');
    }
});

app.get('/starter', bodyParser.urlencoded(), startHuntController.loadnames);
app.get('/starter2', bodyParser.urlencoded(), enterHuntController.loadnames);


app.post('/strthunt', bodyParser.urlencoded(), startHuntController.loadHunt);
app.post('/strthunt2', bodyParser.urlencoded(), enterHuntController.enterHunt);

app.post('/savehunt', bodyParser.urlencoded(), huntinfoController.storeData);

app.post('/registerteam', bodyParser.urlencoded(), team_membersController.storeData);

app.get('/upcomings', bodyParser.urlencoded(), upcomingsController.showhunts);
app.get('/upcomings_adrights', bodyParser.urlencoded(), upcomingsController.showhunts2);

app.post('/starthunt', bodyParser.urlencoded(), startHuntController.startHunt);

app.get('/start', (req, res) => {
    res.render('start');
});
app.get('/bstart', (req, res) => {
    res.render('beforestart1');
});

app.post('/logout', authController.logout);




app.get('/menu_client', (req, res) => {
    if (res.locals.isAuth) {
        res.render('menu_client');
    } else {
        res.redirect('/index');
    }

});

app.get('/edit', bodyParser.urlencoded(), editHuntController.loadnames);
app.post('/edthunt', bodyParser.urlencoded(), editHuntController.loadhunt);
app.post('/editing', bodyParser.urlencoded(), editHuntController.completeEdit);
app.post('/appending', bodyParser.urlencoded(), editHuntController.addClues);
app.post('/deleting', bodyParser.urlencoded(), editHuntController.deleteClues);
app.post('/deleting2', bodyParser.urlencoded(), editHuntController.deleteHunt);
app.post('/modifying', bodyParser.urlencoded(), editHuntController.modify);

app.get('/addClues', (req, res) => {
    if (res.locals.isAuth) {
        res.render('addClues');
    } else {
        res.redirect('/index');
    }
});

app.get('/deleteClues', (req, res) => {
    if (res.locals.isAuth) {
        res.render('deleteClues');
    } else {
        res.redirect('/index');
    }
});

app.get('/modify', (req, res) => {
    if (res.locals.isAuth) {
        res.render('modify');
    } else {
        res.redirect('/index');
    }
});

app.get('/hunt2', (req, res) => {
    if (res.locals.isAuth) {
        res.render('hunt2');
    } else {
        res.redirect('/index');
    }
});

app.get('/clues', (req, res) => {
    if (res.locals.isAuth) {
        res.render('clues');
    } else {
        res.redirect('/index');
    }
});

app.get('/alregis', (req, res) => {

    if (res.locals.isAuth) {
        res.render('already_registered');
    } else {
        res.redirect('/index');
    }
});

app.get('/unreg', (req, res) => {
    if (res.locals.isAuth) {
        res.render('unregistered');
    }
    else {
        res.redirect('/index');
    }
});

app.post('/endHunt', (req, res) => {
    db.collection('startedHunts').drop()
        .then(() => {
            res.send('Collection dropped successfully');
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Error dropping collection');
        });
});

app.get('/team_members', bodyParser.urlencoded(), team_membersController.loadnames);

app.get('/upcomings_client', bodyParser.urlencoded(), upcomingsController.showhunts3);
app.use(errorHandler);

db.connectToDatabase().then(function () {
    server.listen(3000, () => {
        console.log('App listening on port 3000!');
    });
})
    .catch(function (err) {
        console.log("Error connecting to database" + err);
    });

let lastMessage = null;
let isStarted;
let isFinished;
let scores = [];
let adminScores = [];

wss.on('connection', (ws) => {
    console.log('A user connected');
    ws.send('Welcome new client');

    if (isStarted == true && isFinished == false) {
        ws.send(lastMessage);
    }

    ws.on('message', (message) => {

        console.log(`Received message: ${message}`);
        if (message != 'requestLeaderboard' && message != 'requestLeaderboardForAdmin' && message != 'endHunt' && message != 'resume' && message != 'pause') {

            message = JSON.parse(message);
        }
        // console.log(message[1]);
        if (message[0] == 'Serve') {
            console.log('Starting admin pages');
            // Broadcast a message to all clients to start serving admin pages
            wss.clients.forEach((client) => {
                console.log('client')
                let data = ['startedAdminPages', message[1]];
                client.send(JSON.stringify(data));
                lastMessage = JSON.stringify(data);
                isStarted = true;
                isFinished = false;

            });
        }
        if (message == 'requestLeaderboard') {
            console.log('requesting leaderboard');
            // Broadcast a message to all clients to start serving admin pages
            wss.clients.forEach((client) => {
                console.log('client')
                client.send('giveScores');

            });
        }
        if (message == 'endHunt') {
            console.log('ending hunt');
            isFinished = true;
            wss.clients.forEach((client) => {
                console.log('client')
                client.send('endHunt');

            });
        }
        if (message == 'resume') {
            console.log('resuming hunt');
            wss.clients.forEach((client) => {
                console.log('client')
                client.send('resume');

            });
        }
        if (message == 'pause') {
            console.log('pausing hunt');
            wss.clients.forEach((client) => {
                console.log('client')
                client.send('pause');

            });
        }
        if (message == 'requestLeaderboardForAdmin') {
            console.log('requesting leaderboard');
            // Broadcast a message to all clients to start serving admin pages
            wss.clients.forEach((client) => {
                console.log('client')
                client.send('giveScoresToAdmin');

            });
        }
        if (message[0] == 'Score') {
            console.log('Scores found');
            scores.push([message[1], message[2]]);


            if (scores.length == wss.clients.size) {
                scores.sort((a, b) => b[0] - a[0]);
                console.log(scores);
                console.log('All scores received, sending scores to all clients');
                wss.clients.forEach((client) => {
                    let data = ['scores', scores];
                    client.send(JSON.stringify(data));
                });
                scores = [];

            }
        }
        if (message[0] == 'AdminScore') {
            console.log('Admin Scores found');
            adminScores.push([message[1], message[2]]);


            if (adminScores.length == wss.clients.size) {
                adminScores.sort((a, b) => b[0] - a[0]);
                console.log(adminScores);
                console.log('All scores received, sending scores to all clients');
                wss.clients.forEach((client) => {
                    let data = ['Adminscores', adminScores];
                    client.send(JSON.stringify(data));
                });
                adminScores = [];

            }
        }

    });



    ws.on('close', () => {
        console.log('User disconnected');
        wss.clients.forEach((client) => {
            client.send('stoppedAdminPages');
            // lastMessage = '';
        });
    });
});

// channel i authentication   // edit hunt
