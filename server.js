const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const users = {};
const rooms = {};

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/users', function(req, res) {
  res.send(users);
});

app.get('/rooms', function(req, res) {
  res.send(rooms);
});

app.get('/rooms/:id', function(req, res) {
  const room = req.params.id;
  if (rooms[room]) res.send(rooms[room]);
  else res.send('No Such Room Exists');
});

io.on('connection', function(socket) {
  socket.on('setSocketId', function(data) {
    if (rooms[data.room] && rooms[data.room].length >= 2) {
      socket.emit('too-many-users', { error: 'Too many users' });
      socket.disconnect(true);
      return;
    }
    console.log(`User - ${socket.id} - connected to - ${data.room} -`);
    const userId = socket.id;
    if (!rooms[data.room]) rooms[data.room] = [];
    rooms[data.room].push(socket.id);
    users[userId] = { name: data.name, room: data.room };
  });

  socket.on('messages', function(data) {
    rooms[data.room].forEach(id => {
      if (id !== socket.id) socket.to(id).emit('messages', data.msg);
    });
  });

  socket.on('send-data', function(data) {
    data.dataObj['callerId'] = socket.id;
    rooms[data.room].forEach(id => {
      if (socket.id !== id) socket.to(id).emit('receive-data', data.dataObj);
    });
  });

  socket.on('disconnect', function() {
    if (!users[socket.id]) return;
    console.log(`a user disconnected : ${socket.id}`);
    rooms[users[socket.id].room] = rooms[users[socket.id].room].filter(
      id => id !== socket.id
    );
    delete users[socket.id];
  });
});
const port = process.env.PORT || 8080;

http.listen(port, () => console.log(`server running on port ${port}`));
