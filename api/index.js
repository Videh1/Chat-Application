const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrpyt = require('bcryptjs')
const User = require("./models/User");
const Message = require('./models/Message')
const cookieParser = require('cookie-parser');
const ws = require('ws');





dotenv.config();
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrpyt.genSaltSync(10);





const app = express();
app.use(express.json());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL
}));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;

        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) {
                    throw err; // Properly reject the promise in case of an error
                } else {
                    resolve(userData); // Resolve the promise with user data
                }
            });
        } else {
            reject("No Token"); // Properly reject the promise if no token is found
        }
    });
}

app.get('/test', (req, res) => {
    res.json("test ok");
});

app.get("/messages/:userId", async (req,res) => {
    const { userId } = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
     

    const messages = await Message.find({
        sender : {$in : [userId,ourUserId]},
        recipient : {$in : [userId,ourUserId]},
    }).sort({ createdAt : 1});
     

    res.json(messages);
})

app.get('/people' , async(req,res) => {
    const users = await User.find({},{'_id' : 1, username : 1});
    res.json(users);
});


app.get("/profile", (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) throw err;
            
            res.json(userData);
        })
    }
    else {
        res.status(401).json("no token");
    }
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
      
        const passOk = bcrpyt.compareSync(password, foundUser.password);
        if (passOk) {
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, (err, token) => {
                res.cookie('token', token, { sameSite: 'none', secure: true }).json({
                    id: foundUser._id,
                })
            });
        }
    }
})

app.post("/logout", async(re,res) => {
    res.cookie('token','', {sameSite : 'none' , secure : true}).json('ok');
})
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashPassword = bcrpyt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username,
            password: hashPassword
        });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, (err, token) => {
            if (err) {
                return res.status(500).json({ error: 'Error generating token' });
            }
            res.cookie('token', token, { sameSite: "none", secure: true }).status(201).json({ id: createdUser._id });
        });
    } catch (err) {
        res.status(500).json({ error: 'Error creating user' });
    }

});

const server = app.listen(4000);


const wss = new ws.WebSocket.Server({ server });
wss.on('connection', (connection, req) => {
    //read username and id from the cookie for this connection
    
    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online : [...wss.clients].map(c => ({ userId : c.userId , username : c.username}))
            }
            ))
        })
    
    }
    connection.isAlive = true;
    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval();
            connection.terminate();
            notifyAboutOnlinePeople();
            
        },1000);
    },5000);

    connection.on('pong' , () => {
        clearTimeout(connection.deathTimer);
    } )
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                })
            }
        }
    }

    // notify everyone about online people when someone connects



    connection.on('message', async (message ) => {
      
            const  messageData = JSON.parse(message.toString());
        
            const { recipient , text} = messageData.message;
           
           
            if(recipient && text)
                {
                    const messageDoc = await Message.create({
                        sender : connection.userId,
                        recipient,
                        text,
                    });
                     [...wss.clients]
                     .filter( c => c.userId === recipient)
                     .forEach( c => c.send(JSON.stringify({
                        text , 
                        sender : connection.userId,
                        recipient,
                        _id : messageDoc._id
                    })));
                }
        
            })
            notifyAboutOnlinePeople();
})

wss.on('close', data => {
    console.log("I got disconnected");
})






