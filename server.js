const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname))

// we need a key and cert to run https
// we generated them with two mkcert terminal commands
// $ mkcert create-ca
// $ mkcert create-cert
const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

// changed our express setup so we can use https
// pass the key and cert to createServer on https
const expressServer = https.createServer({key, cert}, app);
// create our socket.io server.... it will listen to our express port
const io = socketio(expressServer);

expressServer.listen(8181);

// offers will contain objects {}
const offers = [
    // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
];
const connectedSockets = [
    // userName, socketId
]

io.on('connection', (socket) => {
    // console.log('Someone has connected');
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== 'x') {
        socket.disconnect(true);
        return;
    }
    connectedSockets.push({
        socketId: socket.id,
        userName
    })

    socket.on('newOffer', (newOffer) => {
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: [],
        });
        // send out to all connected sockets except the caller
        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1));
    })
})