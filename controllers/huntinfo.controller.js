const Hunt = require('../models/hunt.model');
const sessionFlash = require('../util/session-flash');


async function storeData(req, res) {
    let data = [];
    if (Array.isArray(req.body.Clue)) {
        for (let i = 0; i < req.body.Clue.length; i++) {
            const dataSet = new Hunt.dataSet(req.body.Clue[i], req.body.Location[i], req.body.Hint[i]);
            data.push(dataSet);
        }
    } else {
        const dataSet = new Hunt.dataSet(req.body.Clue, req.body.Location, req.body.Hint);
        data.push(dataSet);
    }
    console.log(req.body.huntname,data);
    const route = req.body.route;
    
    const hunt = new Hunt.Hunt(req.body.huntname, data);

    if (route === '/editing') {
        await hunt.SaveCompleteEdit();
        res.redirect('/menu');
    } else if (route === '/appending') {
        await hunt.SaveAddedClue();
        res.redirect('/menu');
    } else if (route === '/deleting') {
        await hunt.Save();
        await hunt.SaveDeletedHunt();
        res.redirect('/menu');
    } else if (route === '/modifying') {
        res.redirect('/menu');
        await hunt.SaveEditedClues();
    } else {
        await hunt.savehuntname();
        await hunt.Save();
        res.redirect('/menu');
    }
    
}


module.exports = {
    storeData: storeData
}