if(process.env.NODE_ENV!=="production"){
    require("dotenv").config();
}

let express=require("express");
let mongoose=require("mongoose");
let path=require("path");
let session=require("express-session");
let flash=require("connect-flash");
let bcrypt=require("bcrypt");
let multer=require("multer"); //To parse input[type="file"]
let {storage}=require("./cloudinary.js");
let http=require("http");   //for socket.io
let socketio=require("socket.io");

let upload = multer({ storage});

let User=require("./models/users.js");
let utils=require("./utils.js");

let app=express();
let server=http.createServer(app);
let io=socketio(server);

let sessionConfig=session({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
}),
sharedsession = require("express-socket.io-session");

app.use(sessionConfig);
io.use(sharedsession(sessionConfig));


app.use(session({secret: "issecret", resave: false, saveUninitialized: false}));
app.use(flash());

let dbUrl=process.env.DB_URL || 'mongodb://localhost:27017/chatDB';
mongoose.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(()=>{
        console.log("connection successful");
    })
    .catch((err)=>{
        console.log(err);
    })


app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next)=>{
    res.locals.password=req.flash("fail");
    res.locals.email=req.flash("fail");
    res.locals.credentials=req.flash("fail2");
    res.locals.success=req.flash("success");
    next();  
})


let users=[];
io.on("connection", socket=>{
    console.log("new WS connection");
    socket.on("login", function(user_id){
        socket.handshake.session.user_id = user_id;
        socket.handshake.session.save();
    });

    socket.on("logout", function(user_id){
        if(socket.handshake.session.user_id){
            delete socket.handshake.session.user_id;
            socket.handshake.session.save();
        }
    });
    socket.emit("user_id", socket.handshake.session.user_id);
    // console.log("xx", utils.getUserInfo(socket.handshake.session.user_id));

    console.log("socket session", socket.handshake.session.user_id);
    socket.emit("msg", utils.formatMessage("Bot", "welcome to neutron"));

    socket.broadcast.emit("msg", utils.formatMessage("Bot", "A user has joined the chat"));


    socket.on("user_connected", function(user_id){
        users[user_id]=socket.id;
        io.emit("user_connected", user_id);
    })

    //Listen for chatMsg from eventListener on main.js
    socket.on("chatMsg", (msg)=>{
        // console.log(socket.id);
        io.emit("msg", utils.formatMessage("user", msg));
    })


    socket.on("disconnect", ()=>{
        console.log("User disconnected");
        io.emit("msg", utils.formatMessage("Bot", "A user has left the chat"));
    })

})



app.set("view engine", "ejs");

let port=3000;

app.get("/login", (req, res)=>{
    res.render("login.ejs");
})

app.get("/signup", (req, res)=>{
    res.render("signup.ejs");
})

app.post("/signup", async (req, res)=>{
    let {name, email, password, dob}=req.body;
    if(utils.validateCredentials(password)!=="wrong password"){
        let {name, email, password, dob}=req.body;
        // console.log(name, email, password, dob);
        let hashed=await bcrypt.hash(password, 12);
        let user=new User({name: name, email: email, password: hashed, dob: dob, picture: {url: "https://res.cloudinary.com/dkgjhgzqp/image/upload/v1630230289/Neutron/l1fn0yfdo22d6wxrp4j9.png", filename: "Neutron/l1fn0yfdo22d6wxrp4j9"}});
        try{
            let final=await user.save();
            req.session.user_id=user._id;
            res.redirect("/home");
        }
        catch(err){
            // res.send(err.message);
            req.flash("fail", "This Email has already been entered before");
            res.redirect("/signup");
        }
        
    }
    else{
        req.flash("fail", "Password length has to be greater than 6 characters");
        res.redirect("/signup");
    }
})


app.post("/login", async (req, res)=>{
    let {email, password}=req.body;
    try{
        let user=await User.findOne({email: email});
        let validPassword=await bcrypt.compare(password, user.password);
        if(validPassword){
            req.session.user_id=user._id;
            res.redirect("/home");
        }
        else{
            req.flash("fail2", "Invalid Credentials");
            res.redirect("/login");
        }
    }
    catch(err){
        req.flash("fail2", "Invalid Credentials");
        res.redirect("/login");
    }
})

app.get("/logout", utils.requireLogin, (req, res)=>{
    req.session.user_id=null;
    res.redirect("/login");
})

app.get("/editprofile", utils.requireLogin, async (req, res)=>{
    let user=await User.findById(req.session.user_id);
    res.render("editprofile.ejs", {user: user});
})

app.post("/editprofile", utils.requireLogin, upload.single("picture"), async (req, res)=>{
    let {name, email, password, dob}=req.body;
    let user=await User.findById(req.session.user_id);
    let foundEmail=await User.findOne({email: email});
    let error=false;
    if(password.length<6 && password){
        req.flash("fail", "Password length has to be greater than 6 characters");
        error=true;
    }
    if(!foundEmail._id.equals(user._id)){
        req.flash("fail2", "This Email has already been entered before");
        error=true;
    }

    if(error){
        res.redirect("/editprofile");
    }
    else{
        if(!password && req.file){
            let path=req.file.path;
            let filename=req.file.filename;
            let user=await User.findByIdAndUpdate(req.session.user_id, {name: name, email: email, dob: dob, picture: {url: path, filename: filename}}, {new:true, runValidators: true});
            console.log(user);
            // console.log(req.file);
        }
        else if(password && req.file){
            let hashed=await bcrypt.hash(password, 12);
            let path=req.file.path;
            let filename=req.file.filename;
            let user=await User.findByIdAndUpdate(req.session.user_id, {name: name, password: hashed, email: email, dob: dob, picture: {url: path, filename: filename}}, {new:true, runValidators: true});
            // let user=await User.findByIdAndUpdate(req.session.user_id, {name: name, password: hashed, email: email, dob: dob}, {new:true, runValidators: true});
        }
        else{
            if(password){
                let password=await bcrypt.hash(password, 12);
                let user=await User.findByIdAndUpdate(req.session.user_id, {name: name, password: password, email: email, dob: dob}, {new:true, runValidators: true});
            }
            else{
                let user=await User.findById(req.session.user_id);
                let password=user.password;
                await User.findByIdAndUpdate(req.session.user_id, {name: name, password: password, email: email, dob: dob}, {new:true, runValidators: true});
            }
        }
        req.flash("success", "Successfully edited your profile");
        res.redirect("/getprofile");
    }
})

app.get("/getprofile", async (req, res)=>{
    let user=await User.findById(req.session.user_id);
    res.render("profile.ejs", {user: user});
})

app.get("/delete", utils.requireLogin, async (req, res)=>{
    let user=await User.findByIdAndDelete(req.session.user_id);
    req.session.user_id=null;
    req.flash("success", "account deleted successfully");
    res.redirect("/login");
})

app.get("/home", utils.requireLogin, async (req, res)=>{
    // console.log("express session", req.session.user_id);
    let user=await User.findById(req.session.user_id);
    res.render("home.ejs", {user: user});
})

app.get("/friends/:friend_id", utils.requireLogin, async (req, res)=>{
    let {friend_id}=req.params;
    // console.log(friend_id);
    let friend=await User.findById(friend_id).populate("picture");
    let user=await User.findById(req.session.user_id).populate("friends");
    console.log(user, friend);
    // res.send("frdoneiend");
    res.render("friends.ejs", {friend: friend, user: user});
})

app.get("/unfriend/:friend_id", utils.requireLogin, async (req, res)=>{
    let {friend_id}=req.params;
    let user=await User.findOneAndUpdate({_id: req.session.user_id}, {$pull: {friends: friend_id}});  //Removing friend from friend list
    // console.log(user);
    res.redirect("/friends");
})

app.get("/block/:friend_id", utils.requireLogin, async (req, res)=>{
    let {friend_id}=req.params;
    let user=await User.findById(req.session.user_id);
    let blocked=await User.findById(friend_id);
    user.blockList.push(blocked);
    await user.save();
    res.redirect("/friends");
})

app.get("/friends", async (req, res)=>{
    let user=await User.findById(req.session.user_id).populate("friends").populate("blockList");
    res.render("friends.ejs", {user: user});
})


app.get("/searchresults", utils.requireLogin, async (req, res)=>{
    let user=await User.findById(req.session.user_id).populate("friends").populate("blockList");
    let {search}=req.query;
    // let final="/"+search+"/";
    let results=await User.find({name: {$regex: search, $options: "i"}});
    // console.log(user);
    // console.log(results);
    res.render("search.ejs", {user: user, results: results, search: search});
})

app.get("/:user_id/:id/addfriend", async (req, res)=>{
    let {user_id, id}=req.params;
    let user=await User.findById(user_id);
    let addFriend=await User.findById(id);
    user.friends.push(addFriend);
    await user.save();
    req.flash("success", "friend successfully added!");
    res.redirect("/friends");
})


app.all("*", (req, res, next)=>{
    next(new utils.AppError("Page Not Found", 404));
})

app.use((err, req, res, next)=>{
    let {status=500}=err;
    res.status(status).render("error.ejs", {err: err});
})

server.listen(port, ()=>{
    console.log("listening on port 3000");
})