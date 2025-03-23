const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

// Slouží statické soubory ze složky public
app.use(express.static('public'));

// Ukládáme stav uživatelů a room
let users = {}; // Klíč: socket.id, hodnota: { id, name, room }
let rooms = {}; // Klíč: room id, hodnota: { id, name, creator, members: [socket.id, ...] }

function broadcastUsers() {
  io.emit("usersUpdate", Object.values(users));
}

function broadcastRooms() {
  io.emit("roomsUpdate", Object.values(rooms));
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Přijetí nastavení jména hráče
  socket.on("setUsername", (name) => {
    users[socket.id] = { id: socket.id, name: name, room: null };
    broadcastUsers();
  });

  // Vytvoření nové roomy – room id je generováno náhodně
  socket.on("createRoom", (roomName) => {
    let roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = { id: roomId, name: roomName, creator: socket.id, members: [socket.id] };
    if (users[socket.id]) {
      users[socket.id].room = roomId;
    }
    socket.join(roomId);
    broadcastRooms();
    broadcastUsers();
    socket.emit("roomCreated", rooms[roomId]);
    console.log(`Room ${roomName} created with id ${roomId}`);
  });

  // Připojení do existující roomy
  socket.on("joinRoom", (roomId) => {
    if (rooms[roomId]) {
      if (!rooms[roomId].members.includes(socket.id)) {
        rooms[roomId].members.push(socket.id);
      }
      if (users[socket.id]) {
        users[socket.id].room = roomId;
      }
      socket.join(roomId);
      broadcastRooms();
      broadcastUsers();
      socket.emit("roomJoined", rooms[roomId]);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit("error", "Room not found");
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    delete users[socket.id];
    // Odstranit uživatele z room a případně smazat prázdné roomy
    for (const roomId in rooms) {
      let room = rooms[roomId];
      room.members = room.members.filter(memberId => memberId !== socket.id);
      if (room.members.length === 0) {
        delete rooms[roomId];
      }
    }
    broadcastUsers();
    broadcastRooms();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
