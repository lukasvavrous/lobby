import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import GamePreview from './GaragePreview';
import './App.css';

const skinOptions = [
  { name: 'T90A', src: '/assets/T90A.png' },
  { name: 'T90B', src: '/assets/T90B.png' },
  { name: 'T90C', src: '/assets/T90C.png' },
  { name: 'T90D', src: '/assets/T90D.png' },
  { name: 'T90E', src: '/assets/T90E.png' },
  { name: 'T90F', src: '/assets/T90F.png' },
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
      <div className="skin-options">
        {skinOptions.map(skin => (
          <button
            key={skin.name}
            className={`skin-button ${selectedSkin === skin.name ? 'selected' : ''}`}
            onClick={() => onSelectSkin(skin.name)}
          >
            <img src={skin.src} alt={skin.name} />
          </button>
        ))}
      </div>
      <p className="selectedSkin">{selectedSkin}</p>
    </div>
  );
}

function PlayerInfo({ socket, username, selectedSkin, setSelectedSkin }) {
  useEffect(() => {
    if (socket) {
      socket.emit("updateSkin", selectedSkin);
    }
  }, [selectedSkin, socket]);

  return (
    <div className="panel">
      <div className="info-section">
        <div className="info-card">
          <p>Hráč: <strong>{username || "Neznámý hráč"}</strong></p>
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
    <div className="panel">
      <div className="server-section">
        <div className="create-room">
          <input
            type="text"
            placeholder="Název roomky"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <button className='big-button' onClick={handleCreateRoom}>Vytvořit</button>
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
              {user.name} {user.room ? `( ${user.roomName ?? 'Alone'} )` : ''}
            </li>
          ))}
        </ul>

        {rooms.map(room => {
          const playersInRoom = users.filter(u => u.room === room.id); 
          return (
            <div key={room.name} className="room">
              <h3>
                {room.name} ({playersInRoom.length})
              </h3>
              <ul>
                {playersInRoom.map(player => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            </div>
          );
        })}
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
        <div className="username-input">
          <input
            type="text"
            placeholder="Zadej jméno hráče"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button className='big-button' onClick={handleSetUsername}>Potvrdit</button>
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
        <button className='big-button' onClick={sendMessage}>Odeslat</button>
      </div>
    </div>
  );
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useUsernameController(socket);
  const [selectedSkin, setSelectedSkin] = useState("T90A");
  const [players, setPlayers] = useState([]); // Seznam hráčů z roomky
  const [currentRoom, setCurrentRoom] = useState(null);

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
    // Aktualizace hráčů (server posílá všechny uživatele)
    sock.on("usersUpdate", (updatedUsers) => {
      // Filtrovat pouze hráče, kteří jsou ve stejné místnosti jako já
      if (currentRoom) {
        setPlayers(updatedUsers.filter(u => u.room === currentRoom && u.name !== username));
      } else {
        setPlayers([]);
      }
    });
    // Při připojení do místnosti
    sock.on("roomJoined", (room) => {
      setCurrentRoom(room.id);
    });
    sock.on("roomCreated", (room) => {
      setCurrentRoom(room.id);
    });
    return () => sock.close();
  }, [username]);

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
          <GamePreview
            selectedSkin={selectedSkin}
            username={username}
            players={players || []}  // Vždy předáváme pole hráčů z aktuální místnosti
          />
          <div className="panel center-panel">
            <PlayerInfo
              socket={socket}
              username={username}
              selectedSkin={selectedSkin}
              setSelectedSkin={setSelectedSkin}
            />
            <Rooms socket={socket} />
          </div>
          <Chat socket={socket} username={username} />
        </div>
      )}
    </div>
  );
}

export default App;
