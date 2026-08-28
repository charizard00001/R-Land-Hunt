const db = require('../data/database');


class Team{
    constructor(teamname, teamdata){
        this.teamname = teamname;
        this.teamdata = teamdata;
    }

    async Save(huntname){
        await db.getDb().collection(huntname).insertOne({
            teamname: this.teamname,
            teamdata: this.teamdata
        });
    }

    getTeamWithSameTeamName(huntname , teamname){
        return db.getDb().collection(huntname).findOne({teamname: teamname});
    }

    getTeamWithSameEnrollementNo(huntname , enrollementNo){
    
        return db.getDb().collection(huntname).findOne({teamdata: {$elemMatch: {enrollentNo: enrollementNo}}}).then(function (team){
            console.log(team);

            if (team) {
                return true;
            } else {
                return false;
            }
        });
    }

    getTeamWithSameEmail(huntname , email){
        
        return db.getDb().collection(huntname).findOne({teamdata: {$elemMatch: {email: email}}}).then(function (team){
            console.log(team);
            if (team) {
                return true;
            } else {
                return false;
            }
        });
    }

    getTeamWithSamePhoneNo(huntname , phoneNo){
        
    
        return db.getDb().collection(huntname).findOne({teamdata: {$elemMatch: {phoneNo: phoneNo}}}).then(function (team){
            console.log(team);
            if (team) {
                return true;
            } else {
                return false;
            }
        });
    }
}

class participantDataSet{
    constructor(name,enrollentNo,phoneNo,email){
        this.name = name;
        this.enrollentNo = enrollentNo;
        this.phoneNo = phoneNo;
        this.email = email;
    }
}

module.exports = {
    Team: Team,
    participantDataSet: participantDataSet
}