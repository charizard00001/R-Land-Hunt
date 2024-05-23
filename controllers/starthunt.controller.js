const database  = require('../data/database');


function loadnames(req, res) {
    database.getDb().collection('upcominghunts').find().toArray().then(function (hunts) {
        // console.log(hunts);
        let names = [];
        for (let hunt of hunts) {
            names.push(hunt.huntname);
        }
        res.render('upcomings_adrights', {
            names: names
        });
        console.log(names);
    }).catch(function (err) {
        console.log(err);
    });
}

function loadHunt(req,res){
    console.log(req.body.huntname);
    database.getDb().collection('hunts').findOne({huntname : req.body.huntname}).then(function (hunt) {
        console.log(hunt);
        res.render('start',{
            hunt : hunt
        });
    }).catch(function (err) {
        console.log(err);
    });
        
}

async function startHunt(req,res){
    
    await database.getDb().collection('startedHunts').insertOne({huntname : req.body.huntname}).then(function (hunt) {
        console.log("saved started hunt")
    }).catch(function (err) {
        console.log(err);
    });

    let startedHunt = req.body.huntname;
    console.log(startedHunt);
    console.log('Hunt started');
    res.render('hunt2',{
        startedHunt : startedHunt
    
    })
}

function endHunt(req,res){
    // some code to end the hunt
}
module.exports = {
    loadnames: loadnames,
    loadHunt : loadHunt,
    startHunt : startHunt,
    endHunt : endHunt
};