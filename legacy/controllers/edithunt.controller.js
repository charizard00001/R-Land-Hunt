const database = require('../data/database');
const sessionFlash = require('../util/session-flash');
function loadnames(req, res) {
    database.getDb().collection('upcominghunts').find().toArray().then(function (hunts) {
        // console.log(hunts);
        let names = [];
        for (let hunt of hunts) {
            names.push(hunt.huntname);
        }
        res.render('editadrights', {
            names: names
        });
        console.log(names);
    }).catch(function (err) {
        console.log(err);
    });
}



function loadhunt(req, res) {
    let huntname = req.body.huntname;
    console.log(huntname);
    database.getDb().collection('hunts').findOne({
        huntname: huntname
    }).then(function (hunt) {
        console.log(hunt);
        res.render('edit_options', {
            hunt: hunt
        });
    }).catch(function (err) {
        console.log(err);
    });
}

function completeEdit(req, res) {
    const huntname = req.body.huntname;
    database.getDb().collection('hunts').findOne({
        huntname: huntname
    }).then(function (hunt) {
        console.log(hunt);
        res.render('huntinfo', {
            hunt: hunt,
            huntNames:''
        });
    }).catch(function (err) {
        console.log(err);
    });
}

function addClues(req, res) {
    const huntname = req.body.huntname;
    console.log(huntname);
    database.getDb().collection('hunts').findOne({
        huntname: huntname
    }).then(function (hunt) {
        console.log(hunt);
        res.render('addclues', {
            hunt: hunt
        });
    }).catch(function (err) {
        console.log(err);
    });
}

function deleteClues(req, res) {
    const huntname = req.body.huntname;
    console.log(huntname);
    database.getDb().collection('hunts').findOne({
        huntname: huntname
    }).then(function (hunt) {
        console.log(hunt);
        res.render('deleteclues', {
            hunt: hunt
        });
    }).catch(function (err) {
        console.log(err);
    });
}


function deleteHunt(req,res){
    const huntname = req.body.huntname;
    console.log(huntname);
    database.getDb().collection('startedHunts').findOne({huntname:huntname}).then(function(hunt){
        if(hunt){
            res.render('menu')
        }
        else{
            database.getDb().collection('hunts').deleteOne({huntname:huntname}).then(function(){
                console.log('done');    
            }).catch(function(err){
                console.log(err);
            });

            database.getDb().collection('upcominghunts').deleteOne({huntname:huntname}).then(function(){
                console.log('done');
            }).catch(function(err){
                console.log(err);
            });

            database.getDb().collection(huntname).drop().then(function(){
                console.log('done');
            }).catch(function(err){
                console.log(err);
            });

            database.getDb().collection('enteredinto_'+huntname).drop().then(function(){
                console.log('done');
            }).catch(function(err){
                console.log(err);
            });

            res.redirect('/menu');
        }
    }).catch(function(err){
        console.log(err);
    }
    );
}

function modify(req, res) {
    const huntname = req.body.huntname;
    console.log(huntname);
    database.getDb().collection('hunts').findOne({
        huntname: huntname
    }).then(function (hunt) {
        console.log(hunt);
        res.render('modify', {
            hunt: hunt
        });
    }).catch(function (err) {
        console.log(err);
    });
}

module.exports = {
    loadnames: loadnames,
    loadhunt: loadhunt,
    completeEdit: completeEdit,
    addClues: addClues,
    deleteClues: deleteClues,
    modify: modify,
    deleteHunt: deleteHunt
};