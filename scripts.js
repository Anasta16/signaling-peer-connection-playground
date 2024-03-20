const userName = "Andrew-"+Math.floor(Math.random() * 100000)
const password = "x"
document.querySelector('#user-name').innerHTML = userName;

const socket = io.connect('https://localhost:8181/', {
    auth: {
        userName,
        password
    }
});

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; // var to hold the local video stream
let remoteStream; // var to hold the remote video stream
let peerConnection; // the peerConnection that the two clients use to talk
let didIOffer = false;

let peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

// when a client initiates a call
const call = async (e) => {
    await fetchUserMedia();

    // peerConnection is all set with our STUN servers sent over
    await createPeerConnection();

    // create offer time
    try {
        console.log('creating offer');
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', offer); // send offer to signaling server
    } catch (error) {
        console.log(error);
    }
};

const answerOffer = async (offerObj) => {
    await fetchUserMedia();
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({}); // just to make the docs happy
    await peerConnection.setLocalDescription(answer); // this is CLIENT2, and CLIENT2 uses the answer as the local description
    console.log(offerObj);
    console.log(answer);
    // console.log(peerConnection.signalingState) // should be 'have-local-pranswer' because CLIENT2 has set its local description to its answer (but it won't be because of bug in Chrome)
    // add the answer to the offerObj so the server knows which offer this is related to
    offerObj.answer = answer;
    // emit the answer to the signaling server so it can emit to CLIENT1
    // expect a response from the server with the already existing ICE candidates
    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
    offerIceCandidates.forEach(candidate => {
        peerConnection.addIceCandidate(candidate);
        console.log('========Added ICE candidate ===============')
    })
    console.log(offerIceCandidates);
};

const addAnswer = async (offerObj) => {
    // addAnswer is called in socketListeners.js when an answerResponse is emitted
    // at this point, the offer and answer have been exchanged
    // now CLIENT1 needs to set remote description
    await peerConnection.setRemoteDescription(offerObj.answer);
    // console.log(peerConnection.signalingState);
}

const fetchUserMedia = () => {
    return new Promise(async(resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                // audio: true
            });
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve();
        } catch (error) {
            console.log(error);
            reject();
        }
    })
}

const createPeerConnection = (offerObj) => {
    return new Promise(async (resolve, reject) => {
        // RTCPeerConnection is the thing that creates the connection
        // we can pass a config object and that config object can contain STUN servers
        // which will fetch us ICE candidates 
        peerConnection = await new RTCPeerConnection(peerConfiguration);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.addEventListener('signalingstatechange', (event) => {
            console.log(event);
            console.log(peerConnection.signalingState);
        });

        peerConnection.addEventListener('icecandidate', (e) => {
            console.log('.......Ice candidate found.....');
            console.log(e);
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.iceCandidate,
                    iceUserName: userName,
                    didIOffer,
                });
            };
        });
        if (offerObj) {
            // this won't be set when called from call();
            // will be set when called from answerOffer();
            // console.log(peerConnection.signalingState) // should be stable because no set description has been run yet
            await peerConnection.setRemoteDescription(offerObj.offer);
            // console.log(peerConnection.signalingState) // should have remote offer because CLIENT2 has set remote description on the offer
        }
        resolve();
    })
}

const addNewIceCandidate = (iceCandidate) => {
    peerConnection.addIceCandidate(iceCandidate);
    console.log('========Added ICE candidate ===============')
}

document.querySelector('#call').addEventListener('click', call);