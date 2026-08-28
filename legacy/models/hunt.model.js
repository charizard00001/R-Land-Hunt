const db = require('../data/database');


class dataSet{
    constructor(clue, location, hint){
        this.clue = clue;
        this.location = location;
        this.hint = hint;
    }

}


class Hunt {
    constructor(huntname,data) {
        this.huntname = huntname;
        this.data  = data;
    }

    
    async Save(){
        await db.getDb().collection('hunts').insertOne({
            huntname: this.huntname,
            data: this.data
        });
    }

    async savehuntname(){
        await db.getDb().collection('upcominghunts').insertOne({
            huntname: this.huntname
        });
    }

    async SaveCompleteEdit() {
        await db.getDb().collection('hunts').updateOne(
            { huntname: this.huntname },
            { $set: { data: this.data } },
            { upsert: true }
        );
    }

    async SaveAddedClue() {
        const hunt = await this.getHunt();
        hunt.data = hunt.data.concat(this.data);
        console.log(hunt.data)
        await db.getDb().collection('hunts').updateOne(
            { huntname: this.huntname },
            { $set: { data: hunt.data } }
        );
    }

    async SaveDeletedHunt() {
        await db.getDb().collection('hunts').deleteOne({ huntname: this.huntname });
    }

    async SaveEditedClues() {
        await db.getDb().collection('hunts').updateOne(
            { huntname: this.huntname },
            { $set: { data: this.data } },
            { upsert: true }
        );
    }

    async getHunt() {
        return await db.getDb().collection('hunts').findOne({ huntname: this.huntname });
    }
}


module.exports = {
    Hunt: Hunt,
    dataSet: dataSet
};