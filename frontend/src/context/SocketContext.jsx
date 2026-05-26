import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

// Typically you'd dynamically set this to window.location.hostname for local network
// e.g. `http://${window.location.hostname}:3001`
const serverUrl = `http://${window.location.hostname}:3001`;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [role, setRole] = useState(null);
  const [presetsData, setPresetsData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let sessionId = localStorage.getItem('catan_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('catan_session_id', sessionId);
    }

    const newSocket = io(serverUrl, {
      auth: { sessionId }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('gameState', (state) => {
      setGameState(state);
    });

    newSocket.on('timerTick', (timeLeft) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          moduleStates: {
            ...prev.moduleStates,
            timer: {
              ...prev.moduleStates.timer,
              timeLeft
            }
          }
        };
      });
    });

    newSocket.on('serverInfo', (info) => {
      setServerIp(info.localIp);
    });

    newSocket.on('sessionRestored', (restoredRole) => {
      setRole(restoredRole);
    });

    newSocket.on('presetsData', (data) => {
      setPresetsData(data);
    });

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, gameState, serverIp, role, setRole, presetsData, isAdmin, setIsAdmin }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
