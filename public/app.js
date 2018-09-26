const nickname = prompt('Please enter a nickname.');
const room = prompt('Enter a room name to join or create.');

document.addEventListener('DOMContentLoaded', function(event) {
  const localVideo = document.querySelector('#localVideo');
  const endStream = document.querySelector('#endStream');
  const mediaConstraints = {
    audio: true,
    video: true
  };

  const remoteVideo = document.querySelector('#remoteVideo');
  const msgSubmit = document.querySelector('#msgSubmit');
  const msgInput = document.querySelector('#msgInput');
  const messages = document.querySelector('.messages');
  const callBtn = document.querySelector('#callBtn');
  const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };
  const socket = io();
  let localStream;
  let pc;

  function newMessage(msg) {
    let newMsg = document.createElement('LI');
    newMsg.innerText = msg;
    messages.appendChild(newMsg);
    messages.scrollTop = messages.scrollHeight;
  }

  function sendToServer(dataObj) {
    socket.emit('send-data', { dataObj, room });
  }

  function setup(isCaller = true) {
    pc = new RTCPeerConnection(ICE_SERVERS);
    window.myPeerConnection = pc;
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStream;

    localStream.getTracks().forEach(track => {
      console.log('adding local tracks', track);
      pc.addTrack(track, localStream);
    });

    if (isCaller) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() =>
          sendToServer({
            nickname,
            type: 'video-offer',
            sdp: pc.localDescription
          })
        )
        .catch(err => console.log(err));
    }
  }

  function handleIceCandidate(event) {
    if (event.candidate != null) {
      sendToServer({
        ice: event.candidate
      });
    }
  }

  function handleRemoteStream(event) {
    console.log('handleRemoteStream', event);
    remoteVideo.srcObject = event.streams[0];
  }

  // transmits nickname to server
  socket.emit('setSocketId', { name: nickname, room: room });

  socket.on('messages', function(msg) {
    newMessage(msg);
  });

  socket.on('receive-data', function(data) {
    if (!pc) {
      setup(false);
    }

    console.log('data from peer', data);
    if (data.sdp) {
      const remoteSDP = new RTCSessionDescription(data.sdp);
      pc.setRemoteDescription(remoteSDP).then(function() {
        if (pc.remoteDescription.type == 'offer') {
          pc.createAnswer()
            .then(answer => pc.setLocalDescription(answer))
            .then(() =>
              sendToServer({
                nickname,
                type: 'video-answer',
                sdp: pc.localDescription
              })
            )
            .catch(err => console.log(err));
        }
      });
    } else if (data.ice) {
      console.log('addIceCandidate', data.ice);
      let iceCandidate = new RTCIceCandidate(data.ice);
      pc.addIceCandidate(iceCandidate).catch(err => console.log(err));
    }
  });

  socket.on('too-many-users', function(data) {
    console.log(data.error);
    callBtn.disabled = true;
  });

  callBtn.addEventListener('click', function() {
    setup();
  });

  function handleMessage(event) {
    if (msgInput.value === '') return;
    const msg = `${nickname}: ${msgInput.value}`;
    msgInput.value = '';
    newMessage(msg);
    socket.emit('messages', { msg, room });
  }

  msgInput.addEventListener('keypress', function(e) {
    if (e.key == 'Enter') {
      handleMessage(e);
    }
  });

  // Create Local Video/Audio Stream

  navigator.mediaDevices
    .getUserMedia(mediaConstraints)
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
    })
    .catch(err => console.log(err));

  // End Local Stream

  endStream.addEventListener('click', function() {
    let stream = localVideo.srcObject;
    let tracks = stream.getTracks();

    tracks.forEach(function(track) {
      track.stop();
    });

    localVideo.srcObject = null;
  });
});
