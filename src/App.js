import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const skinOptions = [
  { id: 1, src: '/assets/T90A.png', alt: 'T90A' },
  { id: 2, src: '/assets/T90B.png', alt: 'T90B' },
  { id: 3, src: '/assets/T90C.png', alt: 'T90C' },
  { id: 4, src: '/assets/T90D.png', alt: 'T90D' },
  { id: 5, src: '/assets/T90E.png', alt: 'T90E' },
  { id: 6, src: '/assets/T90F.png', alt: 'T90F' },
];

function SkinSelector({ selectedSkin, onSelectSkin }) {
  return (
    <div className="skin-selector">
      <h3>Vzhled</h3>
      <div className="skin-options">
        {skinOptions.map(skin => (
          <button
            key={skin.id}
            className={`skin-button ${selectedSkin === skin.id ? 'selected' : ''}`}
            onClick={() => onSelectSkin(skin.id)}
          >
            <img src={skin.src} alt={skin.alt} />
          </button>
        ))}
      </div>
      <p className="selectedSkin">{skinOptions[selectedSkin - 1].alt}</p>
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="panel left-panel">
      <div className="tank-image">
        <img src="/tank.webp" alt="Tank" />
      </div>
    </div>
  );
}

function RightPanel({ socket }) {
  const [selectedSkin, setSelectedSkin] = useState(1);
  const [username, setUsername] = useState('');
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [users, setUsers] = useState([]);

  // Odeslání update skinu na server při změně
  useEffect(() => {
    if (socket) {
      socket.emit("updateSkin", selectedSkin);
    }
  }, [selectedSkin, socket]);

  // Nastavení socket eventů pro aktualizaci seznamu uživatelů a room
  useEffect(() => {
    if (!socket) return;
    socket.on("usersUpdate", (updatedUsers) => {
      setUsers(updatedUsers);
    });
    socket.on("roomsUpdate", (updatedRooms) => {
      setRooms(updatedRooms);
    });
    return () => {
      socket.off("usersUpdate");
      socket.off("roomsUpdate");
    };
  }, [socket]);

  const handleSetUsername = () => {
    if (socket && username.trim() !== '') {
      socket.emit("setUsername", username.trim());
    }
  };

  const handleCreateRoom = () => {
    if (socket && newRoomName.trim() !== '') {
      socket.emit("createRoom", newRoomName.trim());
      setNewRoomName('');
    }
  };

  const handleJoinRoom = (roomId) => {
    if (socket) {
      socket.emit("joinRoom", roomId);
    }
  };

  return (
    <div className="panel right-panel">
      <div className="info-section">
        <div className="info-card">
          <p><strong>Jméno:</strong> {username || "Neznámý hráč"}</p>
          <p><strong>Tank:</strong> T-90</p>
          <p><strong>Level:</strong> 5</p>
          <p><strong>HP:</strong> 100</p>
        </div>
        <div className="username-input">
          <input 
            type="text" 
            placeholder="Zadej jméno hráče" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <button onClick={handleSetUsername}>Nastavit</button>
        </div>
        <SkinSelector selectedSkin={selectedSkin} onSelectSkin={setSelectedSkin} />
      </div>
      <div className="server-section">
        <h2>Roomy</h2>
        <div className="create-room">
          <input 
            type="text" 
            placeholder="Název roomy" 
            value={newRoomName} 
            onChange={(e) => setNewRoomName(e.target.value)} 
          />
          <button onClick={handleCreateRoom}>Vytvořit</button>
        </div>
        <ul className="server-list">
          {rooms.map(room => (
            <li key={room.id} onClick={() => handleJoinRoom(room.id)}>
              <span className="room-name">{room.name}</span>
              <span className="room-members">({room.members.length} hráčů)</span>
            </li>
          ))}
        </ul>
        <h2>Připojení hráči</h2>
        <ul className="user-list">
          {users.map(user => (
            <li key={user.id}>
              {user.name} {user.room ? `(Room: ${user.room})` : ''}
            </li>
          ))}
        </ul>
        <h2>Multiplayer informace</h2>
        <div className="multiplayer-info">
          <p><strong>Aktuální hra:</strong> T-90 Battle</p>
          <p><strong>Hráčů:</strong> {users.length}</p>
          <p><strong>Ping:</strong> 45 ms</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const sock = io("http://localhost:5000");
    setSocket(sock);
    sock.on("connect", () => {
      setConnectionStatus("Connected");
      console.log("Connected:", sock.id);
    });
    sock.on("disconnect", () => {
      setConnectionStatus("Disconnected");
    });
    return () => sock.close();
  }, []);

  return (
    <div className="app-container">
      <div className="background-overlay"></div>
      <div className="connection-status">
        <p>Status spojení: {connectionStatus}</p>
      </div>
      <div className="content">
        <LeftPanel />
        <RightPanel socket={socket} />
      </div>
    </div>
  );
}

export default App;
