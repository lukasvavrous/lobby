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

function useUsernameController(socket) {
  const [username, setUsername] = useState(sessionStorage.getItem("username") || "");

  useEffect(() => {
    if (username) {
      sessionStorage.setItem("username", username);
      if (socket) {
        socket.emit("setUsername", username);
      }
    }
  }, [username, socket]);

  return [username, setUsername];
}

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

function GamePreview() {
  return (
    <div className="panel game-preview">
      <div className="tank-image">
        <img src="/tank.webp" alt="Tank" />
      </div>
    </div>
  );
}

function PlayerInfo({ socket, username }) {
  const [selectedSkin, setSelectedSkin] = useState(1);

  // Odeslání update skinu na server při změně
  useEffect(() => {
    if (socket) {
      socket.emit("updateSkin", selectedSkin);
    }
  }, [selectedSkin, socket]);

  // Nastavení socket eventů pro aktualizaci seznamu uživatelů a room
  return (
    <div className="panel right-panel">
      <div className="info-section">
        <div className="info-card">
          <p><strong>Jméno:</strong> {username || "Neznámý hráč"}</p>
          <p><strong>Tank:</strong> T-90</p>
        </div>
       
        <SkinSelector selectedSkin={selectedSkin} onSelectSkin={setSelectedSkin} />
      </div>
    </div>
  );
}


function Rooms({ socket }) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [users, setUsers] = useState([]);

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
      <div className="server-section">
        <h2>Rooms</h2>
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
        <h2>Připojení hráči: {users.length}</h2>
        <ul className="user-list">
          {users.map(user => (
            <li key={user.id}>
              {user.name} {user.room ? `(Room: ${user.room})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const NameElement = ({ setUsername }) => {
  const [inputValue, setInputValue] = useState("");

  const handleSetUsername = () => {
    if (inputValue.trim() !== "") {
      setUsername(inputValue.trim());
    }
  };

  return (
    <div className="loginWrapper">
      <div className="loginContent">
        <p>Zvolte si jméno</p>
        <div className="username-input">
          <input
            type="text"
            placeholder="Zadej jméno hráče"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button onClick={handleSetUsername}>Nastavit</button>
        </div>
      </div>
    </div>
  );
};

function Chat({ socket, username }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket) return;
    socket.on("chatMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      socket.off("chatMessage");
    };
  }, [socket]);

  const sendMessage = () => {
    if (socket && message.trim() !== '') {
      // Odesíláme zprávu jako objekt { user, text }
      socket.emit("chatMessage", { user: username, text: message.trim() });
      setMessage('');
    }
  };

  return (
    <div className="panel chat-panel">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chat-message">
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Napište zprávu..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Odeslat</button>
      </div>
    </div>
  );
}


function App() {
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useUsernameController(socket);

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
      {!username ? (
        <NameElement setUsername={setUsername} />
      ) : (
        <div className="content">
          <GamePreview />
          <PlayerInfo socket={socket} username={username} />
          <Rooms socket={socket} />
          <Chat socket={socket} username={username} />
        </div>
      )}
    </div>
  );
}
export default App;