const database = require('../data/database');





function loadnames(req, res) {
    database.getDb().collection('upcominghunts').find().toArray().then(function (hunts) {
        // console.log(hunts);
        let names = [];
        for (let hunt of hunts) {
            names.push(hunt.huntname);
        }
        res.render('upcomings_client', {
            names: names
        });
        console.log(names);
    }).catch(function (err) {
        console.log(err);
    });
}



async function enterHunt(req, res) {
    let collectionName = 'enteredinto_' + req.body.huntname;
    const huntname = req.body.huntname;
    const teamname = req.body.teamname;
    console.log(teamname);

    const preEnteredTeam = await database.getDb().collection(collectionName).findOne({ teamname: req.body.teamname });
    if (preEnteredTeam) {
        res.redirect('/alregis');
        return;
    }
    else {
        await database.getDb().collection(collectionName).insertOne({
            teamname: req.body.teamname
        });
    }

    const team = await database.getDb().collection(huntname).findOne({ teamname: req.body.teamname });
    console.log(team);
    if (!team) {
        res.redirect('/unreg');
        return;
    }
    const captainMail = team.teamdata[0].email


    let clues = [];
    let hints = [];
    let locations = [];

    database.getDb().collection('hunts').findOne({ huntname: req.body.huntname }).then(function (hunt) {
        // console.log(hunt.data);

        for (let clueset of hunt.data) {
            // console.log(clueset);
            clues.push(clueset.clue);
            hints.push(clueset.hint);
            locations.push(clueset.location);

        }
        console.log(clues);
        console.log(hints);
        console.log(locations);

        res.render('clues', {
            clues: clues,
            hints: hints,
            locations: locations,
            huntname: hunt.huntname,
            teamname: teamname,
            captainMail: captainMail

        });
    }).catch(function (err) {
        console.log(err);
    });



}

module.exports = {
    loadnames: loadnames,
    enterHunt: enterHunt
};