const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');
const db = require('./database');

// Override console.log to include timestamp
const originalLog = console.log;
console.log = function(...args) {
  originalLog(`[${new Date().toLocaleString()}]`, ...args);
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const sessions = {}; // sessionId -> { role, timeoutId, count }

const getDefaultModules = () => ({
  turns: { 
    enabled: true,
    orderType: 'clockwise',
    customOrder: [],
    countRounds: false,
    autoRound: false,
    maxRounds: 0,
    showModeratorPanel: true,
    firstPlayer: 'random'
  },
  timer: {
    enabled: false,
    type: 'turn',
    seconds: 60,
    autoStart: false,
    autoPass: false,
    allowPlayerControls: true
  },
  dice: { 
    enabled: true, 
    count: 2, 
    faces: 6, 
    allowOutOfTurn: false,
    specialRolls: [{ type: 'single', value: 20 }]
  },
  score: { 
    enabled: false,
    mode: 'individual',
    initialScore: 0,
    winCondition: 'highest',
    endCondition: { type: 'none', value: 0 },
    teams: {}
  },
  voting: { enabled: false, mode: 'yes_no', customOptions: [], dynamicCustomOptions: false, showVotesOnReveal: false },
  hiddenRoles: { enabled: false, roleDeck: [], hostSeesAll: false }
});

const gameState = {
  status: 'LOBBY', // 'LOBBY', 'PLAYING'
  host: null, // role of the host
  players: { Norte: null, Sur: null, Este: null, Oeste: null },
  colors: { Norte: null, Sur: null, Este: null, Oeste: null },
  names: { Norte: 'Norte', Sur: 'Sur', Este: 'Este', Oeste: 'Oeste' },
  profiles: { Norte: null, Sur: null, Este: null, Oeste: null }, // Stores the profile ID
  ready: { Norte: false, Sur: false, Este: false, Oeste: false },
  activePreset: null,
  turnOrder: [],
  turnIndex: 0,
  turn: null,
  showStats: false,
  activeStatsTab: 'leaderboard',
  winner: null,
  
  // Modules configuration
  modules: getDefaultModules(),
  
  // Dynamic module state
  moduleStates: {
    dice: { lastRoll: { values: [], total: 0, player: null, specialIndices: [], isTotalSpecial: false } },
    score: { 
      Norte: 0, Sur: 0, Este: 0, Oeste: 0,
      global: 0,
      team1: 0, team2: 0, team3: 0, team4: 0
    },
    turns: { currentRound: 1, deadPlayers: [] },
    timer: { timeLeft: 60, isRunning: false, isExpired: false },
    voting: { active: false, question: '', options: [], votes: {}, resultsRevealed: false },
    hiddenRoles: { rolesDistributed: false }
  },
  winner: null,
  showStats: false
};

  function saveGameResultToDb(winnerRole) {
    try {
      const winnerProfileId = gameState.profiles[winnerRole] || null;
      const scoresData = {};
      Object.keys(gameState.colors).filter(r => gameState.colors[r]).forEach(r => {
        scoresData[gameState.names[r] || r] = gameState.moduleStates.score[r] || 0;
      });
      db.saveGameResult(gameState.activePreset, winnerProfileId, scoresData);
      io.emit('statsUpdated');
      console.log('Game result saved to database.');
    } catch(err) {
      console.error('Error saving game result:', err);
    }
  }

  function getActivePlayers() {
    return Object.keys(gameState.colors).filter(r => 
      gameState.colors[r] && 
      gameState.colors[r] !== 'moderator' && 
      !gameState.moduleStates.turns.deadPlayers?.includes(r)
    );
  }

  function calculateWinner() {
    let winner = null;
    let bestScore = gameState.modules.score.winCondition === 'lowest' ? Infinity : -Infinity;
    const targets = gameState.modules.score.mode === 'individual' ? getActivePlayers() : 
                    gameState.modules.score.mode === 'teams' ? Object.keys(gameState.modules.score.teams) : ['global'];
    
    targets.forEach(t => {
      const s = gameState.moduleStates.score[t] || 0;
      if (gameState.modules.score.winCondition === 'lowest') {
        if (s < bestScore) { bestScore = s; winner = t; }
      } else {
        if (s > bestScore) { bestScore = s; winner = t; }
      }
    });
    return { winner, bestScore };
  }

  function advanceTurnServerSide() {
    if (!gameState.modules.turns.enabled) return;
    
    // Check rounds logic
    if (gameState.turnIndex === gameState.turnOrder.length - 1) {
      if (gameState.modules.turns.countRounds && gameState.modules.turns.autoRound) {
        gameState.moduleStates.turns.currentRound++;
        
        // Check if game ends by round limit
        if (gameState.modules.score.enabled && gameState.modules.score.endCondition?.type === 'rounds') {
          const limit = gameState.modules.score.endCondition.value;
          if (limit > 0 && gameState.moduleStates.turns.currentRound > limit) {
            gameState.status = 'FINISHED';
            const { winner, bestScore } = calculateWinner();
            gameState.winner = winner;
            console.log(`Game Finished by Rounds limit! Winner: ${winner} with score ${bestScore}`);
            saveGameResultToDb(winner);
            io.emit('gameState', gameState);
            return;
          }
        }
      }
    }

    let nextIndex = (gameState.turnIndex + 1) % gameState.turnOrder.length;
    let loopCount = 0;
    while (
      gameState.moduleStates.turns.deadPlayers?.includes(gameState.turnOrder[nextIndex]) &&
      loopCount < gameState.turnOrder.length
    ) {
      nextIndex = (nextIndex + 1) % gameState.turnOrder.length;
      loopCount++;
    }

    if (loopCount < gameState.turnOrder.length) {
      gameState.turnIndex = nextIndex;
      gameState.turn = gameState.turnOrder[gameState.turnIndex];
    } else {
      gameState.turn = null; // Everyone is dead
    }

    if (gameState.modules.timer.enabled && gameState.modules.timer.type === 'turn') {
      gameState.moduleStates.timer.timeLeft = gameState.modules.timer.seconds;
      gameState.moduleStates.timer.isRunning = gameState.modules.timer.autoStart;
      gameState.moduleStates.timer.isExpired = false;
    }

    console.log(`Turn ended. New turn: ${gameState.turn}`);
    io.emit('gameState', gameState);
  }

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  const sessionId = socket.handshake.auth.sessionId;
  socket.sessionId = sessionId;

  if (sessionId) {
    if (!sessions[sessionId]) {
      sessions[sessionId] = { role: null, timeoutId: null, count: 0 };
    }
    
    const session = sessions[sessionId];
    session.count++;

    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
      console.log(`Timeout cleared for session ${sessionId}`);
    }
    
    if (session.role) {
      socket.role = session.role;
      gameState.players[session.role] = socket.id;
      socket.emit('sessionRestored', session.role);
      console.log(`Session restored for ${session.role} on socket ${socket.id}`);
    }
  }

  // Send initial state to the new client
  socket.emit('gameState', gameState);
  socket.emit('serverInfo', { localIp: getLocalIp() });
  socket.emit('presetsData', db.getAllPresets());

  // Handle Profiles
  socket.on('checkProfile', (name, callback) => {
    const profile = db.getProfileByName(name);
    if (callback) callback({ exists: !!profile, profile });
  });

  socket.on('createProfile', (name, callback) => {
    try {
      const profile = db.createProfile(name);
      if (callback) callback({ success: true, profile });
    } catch(err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Handle player joining a role
  socket.on('joinRole', ({ role, profileId, name }) => {
    if (gameState.players[role] === null || gameState.players[role] === socket.id) {
      gameState.players[role] = socket.id;
      socket.role = role;
      if (profileId) {
        gameState.profiles[role] = profileId;
        gameState.names[role] = name;
      } else if (name) {
        const p = db.getProfileByName(name);
        if (p) {
          gameState.profiles[role] = p.id;
          gameState.names[role] = p.name;
        } else {
          gameState.names[role] = name;
        }
      }
      
      if (socket.sessionId && sessions[socket.sessionId]) {
        sessions[socket.sessionId].role = role;
      }
      
      if (gameState.host === null) {
        gameState.host = role;
        console.log(`Socket ${socket.id} is now the Host (${role})`);
      }
      
      console.log(`Socket ${socket.id} joined as ${role}`);
      io.emit('gameState', gameState);
    } else {
      socket.emit('errorMsg', `Role ${role} is already taken.`);
    }
  });

  // Handle player selecting a color
  socket.on('selectColor', (colorId) => {
    if (!socket.role) return;
    
    // Moderator check
    if (colorId === 'moderator') {
      if (gameState.host === socket.role) {
        gameState.colors[socket.role] = 'moderator';
        console.log(`Socket ${socket.id} (${socket.role}) joined as moderator`);
        gameState.ready[socket.role] = false;
        io.emit('gameState', gameState);
      } else {
        socket.emit('errorMsg', `Solo el host puede ser moderador.`);
      }
      return;
    }

    if (colorId === null) {
      gameState.colors[socket.role] = null;
      gameState.ready[socket.role] = false;
      io.emit('gameState', gameState);
      return;
    }

    const isTaken = Object.values(gameState.colors).includes(colorId);
    if (!isTaken) {
      gameState.colors[socket.role] = colorId;
      console.log(`Socket ${socket.id} (${socket.role}) selected color ${colorId}`);
      // Reset ready state if they change color
      gameState.ready[socket.role] = false;
      io.emit('gameState', gameState);
    } else {
      socket.emit('errorMsg', `El color ya está en uso.`);
    }
  });

  // Handle player ready toggle
  socket.on('setReady', (isReady) => {
    if (!socket.role) return;
    // Default to toggling if no parameter is provided for backwards compatibility, or just use the boolean.
    gameState.ready[socket.role] = typeof isReady === 'boolean' ? isReady : !gameState.ready[socket.role];
    
    // Auto-start if everyone connected is ready
    const activeRoles = getActivePlayers();
    if (activeRoles.length >= 1) {
      const allReady = activeRoles.every(r => gameState.ready[r]);
      if (allReady && gameState.status === 'LOBBY') {
        startGame();
      }
    }
    
    io.emit('gameState', gameState);
  });

  // Host manual start
  socket.on('startGame', () => {
    if (gameState.status !== 'LOBBY') return;
    console.log("updateModules CALLED by socket.role:", socket.role, "host is:", gameState.host); if (socket.role !== gameState.host) return;
    
    const activeRoles = getActivePlayers();
    if (activeRoles.length > 0) {
      startGame();
      io.emit('gameState', gameState);
    }
  });

  // Host return to lobby
  socket.on('returnToLobby', () => {
    if (gameState.status === 'LOBBY') return;
    console.log("updateModules CALLED by socket.role:", socket.role, "host is:", gameState.host); if (socket.role !== gameState.host) return;
    
    gameState.status = 'LOBBY';
    Object.keys(gameState.ready).forEach(r => gameState.ready[r] = false);
    gameState.moduleStates.dice.lastRoll = { values: [], total: 0, player: null, specialIndices: [], isTotalSpecial: false };
    
    console.log('Returned to LOBBY');
    io.emit('gameState', gameState);
  });

  function startGame() {
    gameState.status = 'PLAYING';
    gameState.winner = null;
    const activeRoles = getActivePlayers();
    
    if (gameState.modules.turns.orderType === 'custom' && gameState.modules.turns.customOrder.length > 0) {
      gameState.turnOrder = [...gameState.modules.turns.customOrder];
    } else {
      const shuffledRoles = [...activeRoles].sort(() => Math.random() - 0.5);
      if (gameState.modules.turns.orderType === 'counterclockwise') {
        gameState.turnOrder = shuffledRoles.reverse(); // Simplified counterclockwise for now, ideally it respects seating
      } else {
        gameState.turnOrder = shuffledRoles;
      }
    }
    
    if (gameState.modules.turns.firstPlayer && gameState.modules.turns.firstPlayer !== 'random') {
      const firstIndex = gameState.turnOrder.indexOf(gameState.modules.turns.firstPlayer);
      if (firstIndex > 0) {
        // Rotate the array so firstPlayer is at the start
        gameState.turnOrder = [
          ...gameState.turnOrder.slice(firstIndex),
          ...gameState.turnOrder.slice(0, firstIndex)
        ];
      }
    }
    
    gameState.turnIndex = 0;
    gameState.turn = gameState.turnOrder.length > 0 ? gameState.turnOrder[0] : null;
    
    // Reset module states
    gameState.moduleStates.dice.lastRoll = { values: [], total: 0, player: null, specialIndices: [], isTotalSpecial: false };
    gameState.moduleStates.turns.currentRound = 1;
    if (gameState.modules.timer.enabled) {
      gameState.moduleStates.timer.timeLeft = gameState.modules.timer.seconds;
      gameState.moduleStates.timer.isRunning = gameState.modules.timer.autoStart;
      gameState.moduleStates.timer.isExpired = false;
    }
    
    if (gameState.modules.score.enabled) {
      const initScore = gameState.modules.score.initialScore || 0;
      activeRoles.forEach(r => gameState.moduleStates.score[r] = initScore);
      if (gameState.modules.score.mode === 'teams') {
        Object.keys(gameState.modules.score.teams).forEach(t => gameState.moduleStates.score[t] = initScore);
      }
      gameState.moduleStates.score.global = initScore;
    }
    
    gameState.moduleStates.voting = { active: false, question: '', options: [], votes: {}, resultsRevealed: false };
    gameState.moduleStates.hiddenRoles = { rolesDistributed: false, playerRoles: {} };
    
    console.log(`Game started with ${activeRoles.length} players. First turn: ${gameState.turn}`);
  }

  // Admin API
  socket.on('getAdminData', (callback) => {
    if (!socket.isAdmin) return callback({ error: 'No autorizado' });
    try {
      const profiles = db.getAllProfiles();
      const presets = db.getAllPresets();
      callback({ profiles, presets });
    } catch(err) {
      callback({ error: err.message });
    }
  });
  
  // Game Name API
  socket.on('updateGameName', (name) => {
    if (gameState.status === 'FINISHED') {
      try {
        db.updateLastGameName(name);
        io.emit('statsUpdated');
      } catch (err) {
        console.error('Error updating game name:', err);
      }
    }
  });

  // Handle player changing name
  socket.on('changeName', (newName) => {
    if (!socket.role) return;
    if (newName && newName.trim().length > 0) {
      gameState.names[socket.role] = newName.substring(0, 15).trim();
      console.log(`Socket ${socket.id} (${socket.role}) changed name to ${gameState.names[socket.role]}`);
      io.emit('gameState', gameState);
    }
  });

  socket.on('changeProfile', (profileId) => {
    if (!socket.role) return;
    gameState.profiles[socket.role] = profileId;
    io.emit('gameState', gameState);
  });

  // Handle module toggling (Host only)
  socket.on('updateModules', (newModules) => {
    console.log("updateModules CALLED by socket.role:", socket.role, "host is:", gameState.host); if (socket.role !== gameState.host) return;
    
    // Check for newly enabled modules if we are already playing
    if (gameState.status === 'PLAYING') {
      const activeRoles = getActivePlayers();
      
      // Timer initialization
      if (newModules.timer && newModules.timer.enabled && !gameState.modules.timer.enabled) {
        gameState.moduleStates.timer.timeLeft = newModules.timer.seconds || gameState.modules.timer.seconds;
        gameState.moduleStates.timer.isRunning = newModules.timer.autoStart || gameState.modules.timer.autoStart;
        gameState.moduleStates.timer.isExpired = false;
      }
      
      // Score initialization
      if (newModules.score && newModules.score.enabled && !gameState.modules.score.enabled) {
        const initScore = newModules.score.initialScore || gameState.modules.score.initialScore || 0;
        activeRoles.forEach(r => {
          if (gameState.moduleStates.score[r] === undefined) {
            gameState.moduleStates.score[r] = initScore;
          }
        });
        if (gameState.moduleStates.score.global === undefined) {
          gameState.moduleStates.score.global = initScore;
        }
      }
      
      // Dice initialization
      if (newModules.dice && newModules.dice.enabled && !gameState.modules.dice.enabled) {
        if (!gameState.moduleStates.dice.lastRoll) {
          gameState.moduleStates.dice.lastRoll = { values: [], total: 0, player: null, specialIndices: [], isTotalSpecial: false };
        }
      }
      
      // Voting initialization
      if (newModules.voting && newModules.voting.enabled && !gameState.modules.voting.enabled) {
        if (!gameState.moduleStates.voting) {
          gameState.moduleStates.voting = { active: false, question: '', options: [], votes: {}, resultsRevealed: false };
        }
      }
      
      // Hidden Roles initialization
      if (newModules.hiddenRoles && newModules.hiddenRoles.enabled && !gameState.modules.hiddenRoles.enabled) {
        if (!gameState.moduleStates.hiddenRoles) {
          gameState.moduleStates.hiddenRoles = { rolesDistributed: false, playerRoles: {} };
        }
      }
    }
    
    gameState.modules = { ...gameState.modules, ...newModules };
    gameState.activePreset = null; // Custom changes break the preset
    console.log(`Modules updated by host:`, gameState.modules);
    io.emit('gameState', gameState);
  });

  // Presets
  socket.on('loadPreset', (presetName) => {
    if (gameState.status !== 'LOBBY' || socket.role !== gameState.host) return;
    const presets = db.getAllPresets();
    const preset = presets.find(p => p.name === presetName);
    if (preset) {
      const loadedModules = JSON.parse(JSON.stringify(preset.modulesConfig));
      gameState.modules = { ...getDefaultModules(), ...loadedModules };
      gameState.activePreset = preset.name;
      console.log(`Preset ${preset.name} loaded by host.`);
      io.emit('gameState', gameState);
    }
  });

  socket.on('savePreset', (presetName) => {
    console.log("updateModules CALLED by socket.role:", socket.role, "host is:", gameState.host); if (socket.role !== gameState.host) return;
    try {
      db.savePreset(presetName, gameState.modules);
      gameState.activePreset = presetName;
      io.emit('presetsData', db.getAllPresets());
      io.emit('gameState', gameState);
    } catch(err) {
      socket.emit('errorMsg', err.message);
    }
  });

  // Stats
  socket.on('getStats', (callback) => {
    try {
      const leaderboard = db.getLeaderboard();
      const history = db.getGameHistory();
      const profiles = db.getAllProfiles();
      if (callback) callback({ leaderboard, history, profiles });
    } catch(err) {
      if (callback) callback({ error: err.message });
    }
  });

  // Handle Score module updates
  socket.on('updateScore', ({ target, delta }) => {
    // target can be 'Norte', 'global', or 'team1'
    if (gameState.status !== 'PLAYING') return;
    if (!gameState.modules.score.enabled) return;
    
    gameState.moduleStates.score[target] = (gameState.moduleStates.score[target] || 0) + delta;
    
    // Check win condition
    const endCondition = gameState.modules.score.endCondition;
    if (endCondition && endCondition.type === 'points') {
      const newScore = gameState.moduleStates.score[target];
      if (
        ((endCondition.direction === 'above' || endCondition.direction === 'asc') && newScore >= endCondition.value) || 
        ((endCondition.direction === 'below' || endCondition.direction === 'desc') && newScore <= endCondition.value) ||
        (!endCondition.direction && newScore >= endCondition.value) // Default to >=
      ) {
        gameState.status = 'FINISHED';
        // Calculate winner based on winCondition ('highest' or 'lowest')
        let winner = null;
        let bestScore = gameState.modules.score.winCondition === 'lowest' ? Infinity : -Infinity;
        
        const targets = gameState.modules.score.mode === 'individual' ? getActivePlayers() : 
                       gameState.modules.score.mode === 'teams' ? Object.keys(gameState.modules.score.teams) : ['global'];
        
        targets.forEach(t => {
          const s = gameState.moduleStates.score[t] || 0;
          if (gameState.modules.score.winCondition === 'lowest') {
            if (s < bestScore) { bestScore = s; winner = t; }
          } else {
            if (s > bestScore) { bestScore = s; winner = t; }
          }
        });
        
        gameState.winner = winner;
        console.log(`Game Finished! Winner: ${winner} with score ${bestScore}`);
        saveGameResultToDb(winner);
      }
    }

    io.emit('gameState', gameState);
  });

  socket.on('updateTeam', ({ teamId, name, colorRole }) => {
    if (gameState.modules.score.teams[teamId]) {
      if (name) gameState.modules.score.teams[teamId].name = name;
      if (colorRole) gameState.modules.score.teams[teamId].colorRole = colorRole;
      io.emit('gameState', gameState);
    }
  });

  // Handle dice roll from a mobile device
  socket.on('rollDice', () => {
    if (gameState.status !== 'PLAYING') return;
    if (!gameState.modules.dice.enabled) return;
    
    if (gameState.modules.turns.enabled && !gameState.modules.dice.allowOutOfTurn) {
      if (gameState.turn !== socket.role) return;
    }

    const count = Math.max(1, Math.min(10, gameState.modules.dice.count));
    const faces = Math.max(2, Math.min(100, gameState.modules.dice.faces));
    const values = [];
    let total = 0;
    
    const specialIndices = [];
    let isTotalSpecial = false;

    for (let i = 0; i < count; i++) {
      const val = Math.floor(Math.random() * faces) + 1;
      values.push(val);
      total += val;
      
      // Evaluate golden condition
      if (gameState.modules.dice.goldenEnabled && gameState.modules.dice.goldenConditions) {
        gameState.modules.dice.goldenConditions.forEach(cond => {
          if (cond.type.startsWith('single_')) {
            if (cond.type === 'single_exact' && val === cond.value) { if (!specialIndices.includes(i)) specialIndices.push(i); }
            if (cond.type === 'single_min' && val >= cond.value) { if (!specialIndices.includes(i)) specialIndices.push(i); }
            if (cond.type === 'single_max' && val <= cond.value) { if (!specialIndices.includes(i)) specialIndices.push(i); }
          }
        });
      }
    }
    
    // Evaluate sum-based golden conditions
    if (gameState.modules.dice.goldenEnabled && gameState.modules.dice.goldenConditions) {
      gameState.modules.dice.goldenConditions.forEach(cond => {
        if (cond.type.startsWith('sum_')) {
          if (cond.type === 'sum_exact' && total === cond.value) isTotalSpecial = true;
          if (cond.type === 'sum_min' && total >= cond.value) isTotalSpecial = true;
          if (cond.type === 'sum_max' && total <= cond.value) isTotalSpecial = true;
        }
      });
    }

    gameState.moduleStates.dice.lastRoll = {
      values,
      total,
      player: socket.role,
      specialIndices,
      isTotalSpecial
    };
    
    console.log(`Dice rolled: [${values.join(',')}] (Total: ${total}) by ${socket.role}`);
    io.emit('diceRolled', gameState.moduleStates.dice.lastRoll);
    io.emit('gameState', gameState);
  });

  socket.on('endTurn', () => {
    if (gameState.status !== 'PLAYING') return;
    if (!gameState.modules.turns.enabled) return;
    if (gameState.turn !== socket.role) return;

    advanceTurnServerSide();
  });

  socket.on('advanceTurn', () => {
    if (gameState.host !== socket.role && gameState.turn !== socket.role) return;
    advanceTurnServerSide();
  });

  socket.on('togglePlayerDead', (roleToToggle) => {
    if (gameState.host !== socket.role) return;
    if (!gameState.moduleStates.turns.deadPlayers) {
      gameState.moduleStates.turns.deadPlayers = [];
    }
    const isDead = gameState.moduleStates.turns.deadPlayers.includes(roleToToggle);
    if (isDead) {
      gameState.moduleStates.turns.deadPlayers = gameState.moduleStates.turns.deadPlayers.filter(r => r !== roleToToggle);
      console.log(`Player ${roleToToggle} revived by host.`);
    } else {
      gameState.moduleStates.turns.deadPlayers.push(roleToToggle);
      console.log(`Player ${roleToToggle} marked dead by host.`);
      // If it's their turn right now, skip them!
      if (gameState.turn === roleToToggle) {
        advanceTurnServerSide();
        // Return early since advanceTurnServerSide broadcasts state
        return; 
      }
    }
    io.emit('gameState', gameState);
  });

  // --- VOTING MODULE ---
  socket.on('startVote', (question, options) => {
    if (gameState.host !== socket.role) return;
    gameState.moduleStates.voting.active = true;
    gameState.moduleStates.voting.question = question || '¿Votación General?';
    
    if (gameState.modules.voting.mode === 'players') {
      gameState.moduleStates.voting.options = getActivePlayers().map(p => gameState.names[p] || p);
    } else if (gameState.modules.voting.mode === 'custom') {
      gameState.moduleStates.voting.options = (options && options.length > 0) ? options : (gameState.modules.voting.customOptions && gameState.modules.voting.customOptions.length > 0 ? gameState.modules.voting.customOptions : ['Sí', 'No']);
    } else {
      gameState.moduleStates.voting.options = ['Sí (A favor)', 'No (En contra)'];
    }
    
    gameState.moduleStates.voting.votes = {};
    gameState.moduleStates.voting.resultsRevealed = false;
    io.emit('gameState', gameState);
  });

  socket.on('submitVote', (option) => {
    if (!socket.role) return;
    if (gameState.moduleStates.voting.active && !gameState.moduleStates.voting.resultsRevealed) {
      gameState.moduleStates.voting.votes[socket.role] = option;
      io.emit('gameState', gameState);
    }
  });

  socket.on('closeVote', () => {
    if (gameState.host !== socket.role) return;
    gameState.moduleStates.voting.active = false;
    gameState.moduleStates.voting.resultsRevealed = false;
    io.emit('gameState', gameState);
  });

  socket.on('revealVote', () => {
    if (gameState.host !== socket.role) return;
    gameState.moduleStates.voting.active = false;
    gameState.moduleStates.voting.resultsRevealed = true;
    io.emit('gameState', gameState);
  });

  // --- HIDDEN ROLES MODULE ---
  socket.on('distributeHiddenRoles', (roles) => {
    if (gameState.host !== socket.role) return;
    
    // roles is an array of strings e.g. ["Lobo", "Lobo", "Aldeano", "Vidente"]
    const activePlayers = getActivePlayers();
    
    // We shuffle the roles using Fisher-Yates algorithm for fair distribution
    const shuffledRoles = [...roles];
    for (let i = shuffledRoles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledRoles[i], shuffledRoles[j]] = [shuffledRoles[j], shuffledRoles[i]];
    }
    
    const assignedRolesMap = {};

    // Assign one by one
    activePlayers.forEach((playerRole, idx) => {
      const assignedRole = shuffledRoles[idx] || 'Sin Rol';
      assignedRolesMap[playerRole] = assignedRole;
      const playerSocketId = gameState.players[playerRole];
      if (playerSocketId) {
        io.to(playerSocketId).emit('secretRole', assignedRole);
      }
    });

    if (gameState.modules.hiddenRoles.hostSeesAll && gameState.host && gameState.players[gameState.host]) {
      io.to(gameState.players[gameState.host]).emit('allSecretRoles', assignedRolesMap);
    }

    gameState.moduleStates.hiddenRoles.rolesDistributed = true;
    io.emit('gameState', gameState);
  });

  socket.on('clearHiddenRoles', () => {
    if (gameState.host !== socket.role) return;
    gameState.moduleStates.hiddenRoles.rolesDistributed = false;
    // Notify all players to clear their roles
    io.emit('clearSecretRole');
    io.emit('gameState', gameState);
  });

  socket.on('advanceRound', () => {
    if (gameState.status !== 'PLAYING') return;
    console.log("updateModules CALLED by socket.role:", socket.role, "host is:", gameState.host); if (socket.role !== gameState.host) return;
    gameState.moduleStates.turns.currentRound++;
    io.emit('gameState', gameState);
  });

  // Timer controls
  socket.on('startTimer', () => {
    if (gameState.status === 'PLAYING') {
      gameState.moduleStates.timer.isRunning = true;
      gameState.moduleStates.timer.isExpired = false;
      io.emit('gameState', gameState);
    }
  });

  socket.on('pauseTimer', () => {
    if (gameState.status === 'PLAYING') {
      gameState.moduleStates.timer.isRunning = false;
      io.emit('gameState', gameState);
    }
  });

  socket.on('resetTimer', () => {
    if (gameState.status === 'PLAYING') {
      gameState.moduleStates.timer.timeLeft = gameState.modules.timer.seconds;
      gameState.moduleStates.timer.isRunning = false;
      gameState.moduleStates.timer.isExpired = false;
      io.emit('gameState', gameState);
    }
  });


  // ========== Admin & Stats Controls ==========
  socket.on('toggleStatsView', (show) => {
    gameState.showStats = show;
    io.emit('gameState', gameState);
  });

  socket.on('setStatsTab', (tab) => {
    gameState.activeStatsTab = tab;
    io.emit('gameState', gameState);
  });

  socket.on('adminLogin', (password, callback) => {
    if (password === '1234') {
      socket.isAdmin = true;
      callback({ success: true });
    } else {
      callback({ success: false, error: 'Contraseña incorrecta' });
    }
  });

  socket.on('deleteProfile', (id, callback) => {
    if (!socket.isAdmin) return callback({ success: false, error: 'No autorizado' });
    try {
      db.deleteProfile(id);
      callback({ success: true });
    } catch(err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('deletePreset', (id, callback) => {
    if (!socket.isAdmin) return callback({ success: false, error: 'No autorizado' });
    try {
      db.deletePreset(id);
      io.emit('presetsData', db.getAllPresets());
      callback({ success: true });
    } catch(err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('addManualRecord', (data, callback) => {
    if (!socket.isAdmin && socket.role !== gameState.host) {
      return callback({ success: false, error: 'No autorizado' });
    }
    try {
      let winnerProfileId = null;
      if (data.winnerName && data.winnerName !== 'Empate') {
        const profile = db.getProfileByName(data.winnerName);
        if (profile) {
          winnerProfileId = profile.id;
        }
      }
      db.saveGameResult(
        data.presetName || 'Manual Record', 
        winnerProfileId, 
        data.scores || {}
      );
      io.emit('statsUpdated');
      callback({ success: true });
    } catch(err) {
      callback({ success: false, error: err.message });
    }
  });
  // ============================================

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const sId = socket.sessionId;
    
    if (sId && sessions[sId]) {
      sessions[sId].count--;
      
      if (sessions[sId].count <= 0 && socket.role) {
        const roleToFree = socket.role;
        console.log(`Starting 5 min timeout for role: ${roleToFree}`);
        
        const timeoutId = setTimeout(() => {
          if (gameState.players[roleToFree]) {
            gameState.players[roleToFree] = null;
            gameState.colors[roleToFree] = null;
            gameState.names[roleToFree] = roleToFree; // Reset to default
            gameState.profiles[roleToFree] = null; // Free profile
            gameState.ready[roleToFree] = false;
            
            // Reassign host if the host disconnected
            if (gameState.host === roleToFree) {
              const remainingPlayers = Object.keys(gameState.players).filter(r => gameState.players[r] !== null);
              gameState.host = remainingPlayers.length > 0 ? remainingPlayers[0] : null;
              if (gameState.host) {
                console.log(`Host reassigned to ${gameState.host}`);
              } else {
                console.log(`No players left, host is null.`);
              }
            }
            
            delete sessions[sId];
            io.emit('gameState', gameState);
            console.log(`Session expired and freed for ${roleToFree}`);
          }
        }, 5 * 60 * 1000); // 5 minutos
        
        sessions[sId].timeoutId = timeoutId;
      }
    }
  });
});

// Global Timer Loop
setInterval(() => {
  if (gameState.status === 'PLAYING' && gameState.modules.timer.enabled && gameState.moduleStates.timer.isRunning) {
    if (gameState.moduleStates.timer.timeLeft > 0) {
      gameState.moduleStates.timer.timeLeft--;
      if (gameState.moduleStates.timer.timeLeft === 0) {
        gameState.moduleStates.timer.isRunning = false;
        gameState.moduleStates.timer.isExpired = true;
        io.emit('timerExpired', gameState.turn);
        io.emit('timerTick', 0);
        io.emit('gameState', gameState);
        
        if (gameState.modules.timer.autoPass) {
          setTimeout(() => {
            advanceTurnServerSide();
          }, 1000); // 1 second delay to let UI see 0
        }
      } else {
        io.emit('timerTick', gameState.moduleStates.timer.timeLeft);
      }
    }
  }
}, 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
