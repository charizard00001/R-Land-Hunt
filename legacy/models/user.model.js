const db = require('../data/database');
const bcrypt = require('bcryptjs');
class User{
    constructor(enrollementNo, password){
        this.enrollementNo = enrollementNo;
        this.password = password;
    }

    getUserWithSameEnrollementNo(){
        console.log("this.enrollementno "+this.enrollementNo);
        return db.getDb().collection('users').findOne({enrollementNo: this.enrollementNo})
    }

    async hasMatchingPassword(hassedPassword){
       //how to use bcrypt to compare password
        console.log(hassedPassword)
        const isMatch = await bcrypt.compare(this.password, hassedPassword);
        return isMatch; 
    }

    async signup(){
        const hashedPassword = await bcrypt.hash(this.password, 12);
        
        await db.getDb().collection('users').insertOne({
            enrollementNo: this.enrollementNo,
            password: hashedPassword
        });
    }
}


module.exports = User;