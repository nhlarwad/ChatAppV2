let moment=require("moment");

let mongoose=require("mongoose");
let dbUrl=process.env.DB_URL || 'mongodb://localhost:27017/chatDB';
mongoose.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(()=>{
        console.log("connection successful");
    })
    .catch((err)=>{
        console.log(err);
    })

let User=require("./models/users.js");

function validateCredentials(password){
    if(password && password.length<6){
        return "wrong password";
    }
}

class AppError extends Error{
    constructor(message, status){
        super();
        this.message=message;
        this.status=status;
    }
}

function requireLogin(req, res, next){
    if(!req.session.user_id){
        next(new AppError("You need to log in or sign up", 404));
    }
    else{
        next();
    }
}

function formatMessage(username, text){
    return {
        username: username, 
        text: text,
        time: moment().format("h:mm a")
    };
}

async function getUserInfo(user_id){
    console.log('id from utils', user_id);
    let user=await User.findById(user_id);
    console.log(user.name);
    // return {
    //     id: user._id,
    //     name: user.name,
    //     email: user.email,
    //     friends: user.friends
    // };
}


module.exports.validateCredentials=validateCredentials;
module.exports.AppError=AppError;
module.exports.requireLogin=requireLogin;
module.exports.formatMessage=formatMessage;
module.exports.getUserInfo=getUserInfo;
