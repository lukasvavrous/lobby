const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

// Slouží statické soubory ze složky public
app.use(express.static('public'));

// Udržujeme stav uživatelů a room
let users = {}; // Klíč: socket.id, hodnota: { id, name, room, skin }
let rooms = {}; // Klíč: room id, hodnota: { id, name, creator, members: [socket.id, ...] }

function broadcastUsers() {
  io.emit("usersUpdate", Object.values(users));
}

function broadcastRooms() {
  io.emit("roomsUpdate", Object.values(rooms));
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Nastavení jména hráče
  socket.on("setUsername", (name) => {
    users[socket.id] = { id: socket.id, name: name, room: null, skin: null };
    broadcastUsers();
  });

  // Aktualizace skinu
  socket.on("updateSkin", (skinId) => {
    if (users[socket.id]) {
      users[socket.id].skin = skinId;
      broadcastUsers();
      console.log(`User ${socket.id} updated skin to ${skinId}`);
    }
  });


// chatMessage
  socket.on("chatMessage", (msg) => {
    // Přepošleme zprávu všem klientům
    io.emit("chatMessage", msg);
    console.log(`Chat message from ${socket.id}:`, msg);
  });


  // Vytvoření nové roomy
  socket.on("createRoom", (roomName) => {
    // Pokud uživatel je v jiné roomce, odebereme ho
    if (users[socket.id] && users[socket.id].room) {
      const prevRoom = users[socket.id].room;
      if (rooms[prevRoom]) {
        rooms[prevRoom].members = rooms[prevRoom].members.filter(id => id !== socket.id);
        socket.leave(prevRoom);
        if (rooms[prevRoom].members.length === 0) {
          delete rooms[prevRoom];
        }
      }
    }
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
      // Pokud uživatel je v jiné roomce, odebereme ho nejdřív
      if (users[socket.id] && users[socket.id].room && users[socket.id].room !== roomId) {
        let prevRoom = users[socket.id].room;
        if (rooms[prevRoom]) {
          rooms[prevRoom].members = rooms[prevRoom].members.filter(id => id !== socket.id);
          socket.leave(prevRoom);
          if (rooms[prevRoom].members.length === 0) {
            delete rooms[prevRoom];
          }
        }
      }
      if (users[socket.id]) {
        users[socket.id].room = roomId;
      }
      if (!rooms[roomId].members.includes(socket.id)) {
        rooms[roomId].members.push(socket.id);
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

  // Při odpojení odstraníme uživatele a z room
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (users[socket.id] && users[socket.id].room) {
      let roomId = users[socket.id].room;
      if (rooms[roomId]) {
        rooms[roomId].members = rooms[roomId].members.filter(id => id !== socket.id);
        socket.leave(roomId);
        if (rooms[roomId].members.length === 0) {
          delete rooms[roomId];
        }
      }
    }
    delete users[socket.id];
    broadcastUsers();
    broadcastRooms();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
