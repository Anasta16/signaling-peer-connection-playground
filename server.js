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

    // a new client has joined. If there are any offers available,
    // emit them out
    if (offers.length) {
        socket.emit('availableOffers', offers);
    }

    socket.on('newOffer', (newOffer) => {
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: [],
        });
        console.log(newOffer.sdp.slice(50))
        // send out to all connected sockets except the caller
        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1));
    });

    socket.on('newAnswer', (offerObj, ackFunction) => {
        console.log(offerObj);
        // emit this answer (offerObj) back to CLIENT1
        // in order to do that, we need CLIENT1's socketId
        const socketToAnswer = connectedSockets.find(socket => socket.userName === offerObj.offererUserName);
        if (!socketToAnswer) {
            console.log('no matching socket');
            return;
        }
        // we found the matching socket so we can emit to it
        const socketIdToAnswer = socketToAnswer.socketId;
        // we find the offer to update so we can emit it
        const offerToUpdate = offers.find(offer => offer.offererUserName === offerObj.offererUserName);
        if (!offerToUpdate) {
            console.log('no offer to update');
            return;
        }
        // send back to the answerer all the ICE candidates we have already collected
        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;
        // socket has a .to() which allows emitting to a room
        // every socket has its own room
        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        if (didIOffer) {
            // this ICE is coming from the offerer. Send to the answerer
            const offerInOffers = offers.find(o => o.offererUserName === iceUserName);
            if (offerInOffers) {
                offerInOffers.offerIceCandidates.push(iceCandidate);
                // 1. When the answerer answers, all existing ICE candidates are sent
                // 2. Any candidates that come in after offer has been answered will be passed through
                if (offerInOffers.answererUserName) {
                    // pass it through to the other socket
                    const socketToSendTo = connectedSockets.find(socket => socket.userName === offerInOffers.answererUserName)
                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate)
                    } else {
                        console.log('ICE candidate received but could not find answerer')
                    }
                }
                // come back to this....
            }
        } else {
            // this ICE is coming from the answerer. Send to the offerer
            // pass it through to the other socket
            const offerInOffers = offers.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(socket => socket.userName === offerInOffers.offererUserName)
            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate)
            } else {
                console.log('ICE candidate received but could not find offerer')
            }
        }
        console.log(offers)
    })
})