const database = require('../data/database');
const Team = require('../models/team.model');
const sessionFlash = require('../util/session-flash');

function getTeamMembers(req, res) {

    
    res.render('team_members', {inputData: sessionData});
}



async function storeData(req, res) {
    

    let data = [];
    for (let i = 0; i < req.body.Name.length; i++) {
        const participantDetails = new Team.participantDataSet(req.body.Name[i], req.body.enrollementNo[i], req.body.phonenumber[i], req.body.email[i]);
        data.push(participantDetails);
        
    }
    // console.log(req.body.Name)
    // console.log(data);
    const team = new Team.Team(req.body.teamname, data);
    
    const enteredData = {
        teamname: req.body.teamname,
        huntname: req.body.huntname,
        Name: req.body.Name,
        enrollementNo: req.body.enrollementNo,
        phonenumber: req.body.phonenumber,
        email: req.body.email
    }

    //for validations

    for(let i=0;i<enteredData.enrollementNo.length;i++){
        if(enteredData.enrollementNo[i].length != 8){
            sessionFlash.flashDataToSession(req, { error: 'Entered Enrollment Number must have 8 digits' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
    }

    for(let i=0;i<enteredData.phonenumber.length;i++){
        if(enteredData.phonenumber[i].length != 10){
            sessionFlash.flashDataToSession(req, { error: 'Entered Phone Number must have 10 digits' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
    }

    for(let i=0;i<enteredData.email.length;i++){
        if(!enteredData.email[i].includes('@')){
            sessionFlash.flashDataToSession(req, { error: 'Entered Email is not valid' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
    }


    //for no registerations

    const hunt = await database.getDb().collection('startedHunts').findOne({ huntname: enteredData.huntname });
    if(hunt && hunt.huntname){
        sessionFlash.flashDataToSession(req, { error: 'No registrations allowed' , ...enteredData }, () => {
            res.redirect('/team_members');
        });
        return;
    }
    // for teamname

    let existingTeam;
    try {
        existingTeam = await team.getTeamWithSameTeamName(enteredData.huntname, enteredData.teamname);
    } catch (err) {
        console.log(err);
    }

    if (existingTeam) {
        sessionFlash.flashDataToSession(req, { error: 'Team Name not available', ...enteredData }, () => {
            res.redirect('/team_members');
        });
        return;
    }

    // for enrollementNo
    for (let i = 0; i < enteredData.enrollementNo.length; i++) {
        let existingUser;
        try {
            existingUser = await team.getTeamWithSameEnrollementNo(enteredData.huntname,enteredData.enrollementNo[i]);
            console.log(existingUser);
        } catch (err) {
            console.log(err);
        }

        if (existingUser) {
            sessionFlash.flashDataToSession(req, { error: 'A pre-regesitered team member found' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
        else{
            console.log('not found');
        }
    }

    // for email
    for (let i = 0; i < enteredData.email.length; i++) {
        let existingUser;
        try {
            existingUser = await team.getTeamWithSameEmail(enteredData.huntname,enteredData.email[i]);
        } catch (err) {
            console.log(err);
        }

        if (existingUser) {
            sessionFlash.flashDataToSession(req, { error: 'A pre-regesitered email found' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
        else{
            console.log('not found');
        }
    }

    // for phone number
    for (let i = 0; i < enteredData.phonenumber.length; i++) {
        let existingUser;
        try {
            existingUser = await team.getTeamWithSamePhoneNo(enteredData.huntname,enteredData.phonenumber[i]);
        } catch (err) {
            console.log(err);
        }

        if (existingUser) {
            sessionFlash.flashDataToSession(req, { error: 'A pre-regesitered phone number found' , ...enteredData }, () => {
                res.redirect('/team_members');
            });
            return;
        }
        else{
            console.log('not found');
        }
    }
    // for enrollment number
    for (let i = 0; i < enteredData.enrollementNo.length; i++) {
        for (let j = i + 1; j < enteredData.enrollementNo.length; j++) {
            if (enteredData.enrollementNo[i] === enteredData.enrollementNo[j]) {
                sessionFlash.flashDataToSession(req, { error: 'Duplicate enrollement number found' , ...enteredData }, () => {
                    res.redirect('/team_members');
                });
                return;
            }
        }
    }
    
    // for phone number
    for (let i = 0; i < enteredData.phonenumber.length; i++) {
        for (let j = i + 1; j < enteredData.phonenumber.length; j++) {
            if (enteredData.phonenumber[i] === enteredData.phonenumber[j]) {
                sessionFlash.flashDataToSession(req, { error: 'Duplicate Phone Number found' , ...enteredData }, () => {
                    res.redirect('/team_members');
                });
                return;
            }
        }
    }

    // for email
    for (let i = 0; i < enteredData.email.length; i++) {
        for (let j = i + 1; j < enteredData.email.length; j++) {
            if (enteredData.email[i] === enteredData.email[j]) {
                sessionFlash.flashDataToSession(req, { error: 'Duplicate email found' , ...enteredData }, () => {
                    res.redirect('/team_members');
                });
                return;
            }
        }
    }

    
    
    
    console.log(req.body.teamname,data);
    
    team.Save(req.body.huntname).then(function () {
        res.redirect('/menu_client');
    }).catch(function (err) {
        console.log(err);
    });
}

function loadnames(req, res) {

    let sessionData = sessionFlash.getSessioData(req);

    if(!sessionData){
        sessionData = {
            teamname: '',
            huntname: ''
        };
    }

    database.getDb().collection('upcominghunts').find().toArray().then(function (hunts) {
        // console.log(hunts);
        let names = [];
        for (let hunt of hunts) {
            names.push(hunt.huntname);
        }
        res.render('team_members', {
            names: names,
            inputData: sessionData
        });
        console.log(names);
    }).catch(function (err) {
        console.log(err);
    });
}

module.exports = {
    storeData: storeData,
    loadnames: loadnames,
    getTeamMembers: getTeamMembers  
}