/* ============================================================
   SOCKET.IO MULTIPLAYER CLIENT - FULLY UPDATED WITH CHAT INTEGRATION & IMPROVEMENTS
   Host = Player 1 (Seat 0), Others = Players 2,3,4 clockwise
   ============================================================ */

const socket = io("https://thousanaire-server.onrender.com");

let roomId = null;
let mySeat = null;
let isApplyingRemote = false;

/* ============================================================
   AUDIO AUTOPLAY FIX (Voiceover unlock)
   ============================================================ */

document.addEventListener(
  "click",
  () => {
    const voice = document.getElementById("introVoice");
    if (voice && voice.paused) {
      voice.play().catch(() => {});
    }
  },
  { once: true }
);

/* ============================================================
   ROOM CONTROLS (Create / Join)
   ============================================================ */

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn   = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");

if (createRoomBtn) {
  createRoomBtn.addEventListener("click", () => {
    socket.emit("createRoom");
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener("click", () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      alert("Please enter a room code");
      return;
    }
    socket.emit("joinRoom", { roomId: code });
  });
}

/* ============================================================
   SOCKET EVENTS FOR ROOM FLOW - FIXED WITH CHAT INTEGRATION
   ============================================================ */

// Host receives room code after Create Room (becomes Player 1)
socket.on("roomCreated", ({ roomId: id }) => {
  roomId = id;
  document.getElementById("roomCodeDisplay").textContent = id;
  document.getElementById("roomInfo").style.display = "block";
  alert(`Room created! Code: ${id}\nShare this code with players 2,3,4 to join.\n\nTap OK to enter your name/avatar as Player 1.`);
  hideIntroOverlay();
});

// Players 2,3,4 receive this when entering valid code
socket.on("roomJoined", ({ roomId: id }) => {
  roomId = id;
  document.getElementById("roomCodeDisplay").textContent = id;
  document.getElementById("roomInfo").style.display = "block";
  hideIntroOverlay();
});

// All players receive seat assignment after clicking "Join Game"
socket.on("joinedRoom", ({ roomId: id, seat }) => {
  roomId = id;
  mySeat = seat;
  
  // Visual feedback for seat assignment
  const seatNames = ["Player 1 (Host)", "Player 2", "Player 3", "Player 4"];
  document.getElementById("joinTitle").textContent = `Join as ${seatNames[seat]}`;
  
  disableJoinInputs();
  showGame();
});

socket.on("errorMessage", (msg) => {
  alert(msg);
});

/* ============================================================
   JOIN GAME (Name / Avatar / Color)
   ============================================================ */

const joinBtn = document.getElementById("joinBtn");

if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    if (!roomId) {
      alert("Create or join a room first.");
      return;
    }

    const nameInput    = document.getElementById("nameInput");
    const avatarSelect = document.getElementById("avatarSelect");
    const colorSelect  = document.getElementById("colorSelect");

    const name   = nameInput.value.trim();
    const avatar = avatarSelect.value;
    const color  = colorSelect.value;

    if (!name) {
      alert("Please enter your name");
      return;
    }

    socket.emit("joinSeat", {
      roomId,
      name,
      avatar,
      color
    });
  });
}

function disableJoinInputs() {
  const inputs = ["nameInput", "avatarSelect", "colorSelect", "joinBtn"].map(id => 
    document.getElementById(id)
  );
  
  inputs.forEach(input => {
    if (input) input.disabled = true;
  });
}

function hideIntroOverlay() {
  const overlay = document.getElementById("introOverlay");
  if (!overlay) return;

  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  setTimeout(() => (overlay.style.display = "none"), 300);
  document.getElementById("joinGame").style.display = "block";
}

function showGame() {
  document.getElementById("joinGame").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("rightColumn").style.display = "block";
}

/* ============================================================
   GAME STATE (CLIENT-SIDE VIEW ONLY)
   ============================================================ */

let players       = [null, null, null, null];
let chips         = [0, 0, 0, 0];
let avatars       = [null, null, null, null];
let colors        = [null, null, null, null];
let eliminated    = [false, false, false, false];
let danger        = [false, false, false, false];
let centerPot     = 0;
let currentPlayer = 0;
let gameStarted   = false;

const logicalPositions = ["top", "right", "bottom", "left"];
let domSeatForLogical  = [0, 1, 2, 3];

let idleDiceInterval;

/* ============================================================
   SEAT MAPPING - Player 1(top), 2(right), 3(bottom), 4(left)
   ============================================================ */

function initSeatMapping() {
  const playerDivs = document.querySelectorAll(".player");
  logicalPositions.forEach((pos, logicalIndex) => {
    playerDivs.forEach((div, domIndex) => {
      if (div.classList.contains(pos)) {
        domSeatForLogical[logicalIndex] = domIndex;
      }
    });
  });
}

/* ============================================================
   AUDIO
   ============================================================ */

function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

/* ============================================================
   ROLL / RESET / PLAY AGAIN
   ============================================================ */

const rollBtn      = document.getElementById("rollBtn");
const resetBtn     = document.getElementById("resetBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

if (rollBtn) {
  rollBtn.addEventListener("click", () => {
    if (!roomId || mySeat === null) {
      alert("Join a seat first.");
      return;
    }
    if (mySeat !== currentPlayer) {
      playSound("sndNope");
      return;
    }
    socket.emit("rollDice", { roomId });
    playSound("sndRoll");
    rollBtn.disabled = true;
  });
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (!roomId) return;
    socket.emit("resetGame", { roomId });
  });
}

if (playAgainBtn) {
  playAgainBtn.addEventListener("click", () => {
    if (!roomId) return;
    hideGameOver();
    socket.emit("resetGame", { roomId });
  });
}

/* ============================================================
   SERVER → CLIENT: STATE UPDATES (WITH CHAT INTEGRATION)
   ============================================================ */

socket.on("stateUpdate", (state) => {
  isApplyingRemote = true;

  players       = state.players       || players;
  chips         = state.chips         || chips;
  avatars       = state.avatars       || avatars;
  colors        = state.colors        || colors;
  eliminated    = state.eliminated    || eliminated;
  danger        = state.danger        || danger;
  centerPot     = state.centerPot     ?? centerPot;
  currentPlayer = state.currentPlayer ?? currentPlayer;
  gameStarted   = state.gameStarted   ?? gameStarted;

  // 🔗 CHAT INTEGRATION: Update chat name when players array changes
  if (mySeat !== null && players[mySeat]) {
    window.myPlayerName = players[mySeat];
  }

  updateTable();

  // Roll button management
  if (rollBtn) {
    rollBtn.disabled = !gameStarted || mySeat !== currentPlayer || eliminated[mySeat];
    if (!rollBtn.disabled) rollBtn.disabled = false;
  }

  if (gameStarted) {
    if (idleDiceInterval) {
      clearInterval(idleDiceInterval);
      idleDiceInterval = null;
    }
  } else {
    if (!idleDiceInterval) {
      idleDiceInterval = setInterval(showRandomDice, 1500);
    }
  }

  isApplyingRemote = false;
});

/* ============================================================
   NEW SERVER EVENTS - GRACE PERIOD & ELIMINATION
   ============================================================ */

socket.on("graceWarning", ({ seat, message }) => {
  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    resultsEl.textContent = message;
    resultsEl.style.color = "#ff9800"; // Orange warning
    resultsEl.style.fontWeight = "bold";
    setTimeout(() => {
      if (resultsEl) {
        resultsEl.style.color = "";
        resultsEl.style.fontWeight = "";
      }
    }, 4000);
  }
  playSound("sndWild");
});

socket.on("playerEliminated", ({ seat, name }) => {
  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    resultsEl.textContent = `${name} has been ELIMINATED!`;
    resultsEl.style.color = "#f44336"; // Red
    resultsEl.style.fontWeight = "bold";
    playSound("sndNope");
    setTimeout(() => {
      if (resultsEl) {
        resultsEl.style.color = "";
        resultsEl.style.fontWeight = "";
      }
    }, 5000);
  }
});

/* ============================================================
   SERVER → CLIENT: DICE / CHIPS / HISTORY
   ============================================================ */

socket.on("rollResult", ({ seat, outcomes, outcomesText }) => {
  animateDice(outcomes);
  addHistory(players[seat], outcomesText);

  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    resultsEl.textContent = `${players[seat]} rolled: ${outcomesText}`;
  }
});

socket.on("chipTransfer", ({ fromSeat, toSeat, type }) => {
  animateChipTransfer(fromSeat, toSeat, type);
  playSound("sndChip");
});

socket.on("historyEntry", ({ playerName, outcomesText }) => {
  addHistory(playerName, outcomesText);
});

/* ============================================================
   SERVER → CLIENT: WILD CHOICE REQUESTS
   ============================================================ */

socket.on("requestWildChoice", (payload) => {
  const { seat, outcomes } = payload;
  if (seat !== mySeat) {
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      resultsEl.innerText = `${players[seat]} is choosing Wild actions...`;
    }
    return;
  }

  openWildChoicePanelServerDriven(seat, outcomes);
});

socket.on("requestTripleWildChoice", (payload) => {
  const { seat } = payload;
  if (seat !== mySeat) {
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      resultsEl.innerText = `${players[seat]} is resolving Triple Wilds...`;
    }
    return;
  }

  openTripleWildChoicePanelServerDriven(seat);
});

/* ============================================================
   TABLE RENDERING - Player 1(top), 2(right), 3(bottom), 4(left)
   ============================================================ */

function updateTable() {
  for (let logicalSeat = 0; logicalSeat < 4; logicalSeat++) {
    const domIndex  = domSeatForLogical[logicalSeat];
    const playerDiv = document.getElementById("player" + domIndex);
    if (!playerDiv) continue;

    const name      = players[logicalSeat];
    const chipCount = chips[logicalSeat] ?? 0;

    const nameDiv   = playerDiv.querySelector(".name");
    const chipsDiv  = playerDiv.querySelector(".chips");
    const avatarImg = playerDiv.querySelector(".avatar");

    playerDiv.classList.remove("eliminated", "active", "danger");
    playerDiv.style.boxShadow = "none";

    if (!name) {
      if (nameDiv)  nameDiv.textContent = "";
      if (chipsDiv) chipsDiv.textContent = "";
      if (avatarImg) avatarImg.style.borderColor = "transparent";
      continue;
    }

    if (nameDiv) nameDiv.textContent = name;

    if (avatars[logicalSeat] && avatarImg) {
      avatarImg.src = avatars[logicalSeat];
    }

    if (colors[logicalSeat] && avatarImg) {
      avatarImg.style.borderColor = colors[logicalSeat];
    }

    if (eliminated[logicalSeat]) {
      playerDiv.classList.add("eliminated");
      if (chipsDiv) chipsDiv.textContent = "ELIMINATED";
    } else if (danger[logicalSeat]) {
      playerDiv.classList.add("danger");
      if (chipsDiv) chipsDiv.textContent = `Chips: ${chipCount} ⚠️ DANGER`;
    } else {
      if (chipsDiv) chipsDiv.textContent = `Chips: ${chipCount}`;
    }
  }

  const potEl = document.getElementById("centerPot");
  if (potEl) {
    potEl.innerText = `Hub Pot: ${centerPot}`;
  }

  highlightCurrentPlayer();
}

/* ============================================================
   HIGHLIGHT CURRENT PLAYER
   ============================================================ */

function highlightCurrentPlayer() {
  document.querySelectorAll(".player").forEach((el) => {
    el.classList.remove("active");
    el.style.boxShadow = "none";
  });

  const turnEl = document.getElementById("currentTurn");

  if (!players[currentPlayer] || eliminated[currentPlayer]) {
    if (turnEl) turnEl.textContent = "Current turn: Waiting...";
    return;
  }

  const domIndex  = domSeatForLogical[currentPlayer];
  const activeDiv = document.getElementById("player" + domIndex);
  if (activeDiv) {
    activeDiv.classList.add("active");
    const color = colors[currentPlayer] || "#ff4081";
    activeDiv.style.boxShadow = `0 0 20px ${color}`;
  }

  if (turnEl) {
    turnEl.textContent = `Player ${currentPlayer + 1}: ${players[currentPlayer]}`;
  }
}

/* ============================================================
   DICE DISPLAY + ANIMATION
   ============================================================ */

function renderDice(outcomes) {
  return outcomes
    .map((o) => `<img src="assets/dice/${o}.png" alt="${o}" class="die">`)
    .join(" ");
}

function animateDice(outcomes) {
  const diceArea = document.getElementById("diceArea");
  if (!diceArea) return;

  diceArea.innerHTML = renderDice(outcomes);

  const diceImgs = diceArea.querySelectorAll(".die");
  diceImgs.forEach((die, i) => {
    die.classList.add("roll");
    setTimeout(() => {
      die.classList.remove("roll");
      die.src = `assets/dice/${outcomes[i]}.png`;
    }, 600);
  });
}

/* ============================================================
   HISTORY
   ============================================================ */

function addHistory(playerName, outcomesText) {
  const historyDiv = document.getElementById("rollHistory");
  if (!historyDiv) return;

  const entry = document.createElement("div");
  entry.classList.add("history-entry");
  const playerIndex = players.indexOf(playerName);
  const isMe = mySeat !== null && playerIndex === mySeat;
  entry.textContent = `${isMe ? 'You' : playerName} rolled: ${outcomesText}`;
  entry.style.fontWeight = isMe ? 'bold' : 'normal';
  historyDiv.prepend(entry);
  
  while (historyDiv.children.length > 10) {
    historyDiv.removeChild(historyDiv.lastChild);
  }
}

/* ============================================================
   WILD UI (SERVER-DRIVEN)
   ============================================================ */

function openWildChoicePanelServerDriven(playerIndex, outcomes) {
  const wildContent = document.getElementById("wildContent");
  const resultsEl   = document.getElementById("results");
  const rollBtn     = document.getElementById("rollBtn");

  if (!wildContent || !resultsEl || !rollBtn) return;

  rollBtn.disabled = true;
  resultsEl.innerText = `You rolled: ${outcomes.join(", ")}`;

  const wildCount = outcomes.filter((o) => o === "Wild").length;
  if (wildCount === 0) {
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
    return;
  }

  wildContent.innerHTML = `
    <h3>🎲 Wild Choices (${wildCount} Wild${wildCount > 1 ? 's' : ''})</h3>
    <p>Choose actions for your Wild dice, then confirm.</p>
  `;

  const actions = [];

  ["Left", "Right", "Hub"].forEach(direction => {
    if (outcomes.includes(direction)) {
      const btn = document.createElement("button");
      btn.textContent = `❌ Cancel ${direction}`;
      btn.onclick = () => {
        actions.push({ type: "cancel", target: direction });
        btn.disabled = true;
        btn.textContent = `✅ ${direction} Canceled`;
        btn.style.background = "#4CAF50";
      };
      wildContent.appendChild(btn);
    }
  });

  const opponents = players
    .map((p, i) => ({ name: p, index: i }))
    .filter((o) => o.index !== playerIndex && o.name && !eliminated[o.index]);

  opponents.forEach((op) => {
    const btn = document.createElement("button");
    btn.textContent = `💰 Steal from ${op.name}`;
    btn.onclick = () => {
      actions.push({ type: "steal", from: op.index });
      btn.disabled = true;
      btn.textContent = `✅ Stole from ${op.name}`;
      btn.style.background = "#4CAF50";
    };
    wildContent.appendChild(btn);
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "✅ Confirm Choices";
  confirmBtn.style.marginTop = "15px";
  confirmBtn.style.background = "#4CAF50";
  confirmBtn.style.color = "white";
  confirmBtn.onclick = () => {
    socket.emit("resolveWilds", { roomId, actions });
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
  };
  wildContent.appendChild(confirmBtn);
}

/* ============================================================
   TRIPLE WILD UI
   ============================================================ */

function openTripleWildChoicePanelServerDriven(playerIndex) {
  const wildContent = document.getElementById("wildContent");
  const rollBtn     = document.getElementById("rollBtn");

  if (!wildContent || !rollBtn) return;

  rollBtn.disabled = true;

  wildContent.innerHTML = `
    <h3 style="color: gold;">🎲 TRIPLE WILDS! 🎲</h3>
    <p style="font-size: 1.2em; font-weight: bold;">Choose your epic reward:</p>
    <button id="takePotBtn" style="font-size: 1.3em; padding: 20px; margin: 10px; background: #4CAF50; color: white; border: none; border-radius: 10px;">
      💰 Take entire Hub Pot (${centerPot} chips)
    </button>
    <button id="steal3Btn" style="font-size: 1.3em; padding: 20px; margin: 10px; background: #FF9800; color: white; border: none; border-radius: 10px;">
      ⚔️ Steal 3 chips total from opponents
    </button>
  `;

  document.getElementById("takePotBtn").onclick = () => {
    socket.emit("tripleWildChoice", { roomId, choice: { type: "takePot" } });
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
  };

  document.getElementById("steal3Btn").onclick = () => {
    socket.emit("tripleWildChoice", { roomId, choice: { type: "steal3" } });
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
  };
}

/* ============================================================
   CHIP ANIMATION
   ============================================================ */

function getSeatCenter(logicalSeat) {
  const domIndex = domSeatForLogical[logicalSeat];
  const el       = document.getElementById("player" + domIndex);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function animateChipTransfer(fromSeat, toSeat, type) {
  let fromPos = null;
  let toPos   = null;

  if (fromSeat !== null && fromSeat !== undefined) {
    fromPos = getSeatCenter(fromSeat);
  }

  if (type === "hub") {
    const pot  = document.getElementById("centerPot");
    if (!pot) return;
    const rect = pot.getBoundingClientRect();
    toPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  } else if (toSeat !== null && toSeat !== undefined) {
    toPos = getSeatCenter(toSeat);
  }

  if (!fromPos || !toPos) return;

  const chip = document.createElement("div");
  chip.className = "chip-fly";
  chip.style.position = "fixed";
  chip.style.left = fromPos.x + "px";
  chip.style.top  = fromPos.y + "px";
  chip.style.width = "24px";
  chip.style.height = "24px";
  chip.style.background = "#FFD700";
  chip.style.borderRadius = "50%";
  chip.style.opacity = "1";
  chip.style.transform = "scale(1)";
  chip.style.zIndex = "1000";
  chip.style.transition = "all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  chip.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";

  document.body.appendChild(chip);

  requestAnimationFrame(() => {
    chip.style.left = toPos.x + "px";
    chip.style.top  = toPos.y + "px";
    chip.style.transform = "scale(1.2)";
  });

  setTimeout(() => {
    chip.style.opacity = "0";
    chip.style.transform = "scale(0.5)";
    setTimeout(() => chip.remove(), 300);
  }, 500);
}

/* ============================================================
   GAME OVER UI
   ============================================================ */

socket.on("gameOver", ({ winnerSeat, winnerName, pot }) => {
  const overlay = document.getElementById("gameOverOverlay");
  const text    = document.getElementById("gameOverText");
  const title   = document.getElementById("gameOverTitle");

  if (!overlay || !text || !title) return;

  const winnerLabel = mySeat === winnerSeat ? "🎉 YOU WIN! 🎉" : `${winnerName} WINS!`;
  title.textContent = "🏆 GAME OVER 🏆";
  text.innerHTML = `${winnerLabel}<br>Wins ${pot} chips from hub pot!`;

  setTimeout(() => {
    overlay.classList.remove("hidden");
    if (rollBtn) rollBtn.disabled = true;
    playSound("sndWin");
  }, 1000);
});

function hideGameOver() {
  const overlay = document.getElementById("gameOverOverlay");
  if (overlay) overlay.classList.add("hidden");
}

/* ============================================================
   RESET GAME (CLEAR CHAT TOO)
   ============================================================ */

socket.on("resetGame", () => {
  // Clear game state
  players = [null, null, null, null];
  chips = [0, 0, 0, 0];
  avatars = [null, null, null, null];
  colors = [null, null, null, null];
  eliminated = [false, false, false, false];
  danger = [false, false, false, false];
  centerPot = 0;
  currentPlayer = 0;
  gameStarted = false;
  
  // Clear chat history (chat.js will also listen for this)
  const chatDiv = document.getElementById("chatMessages");
  if (chatDiv) chatDiv.innerHTML = "";
});

/* ============================================================
   RANDOM DICE IDLE ANIMATION
   ============================================================ */

function showRandomDice() {
  const diceArea = document.getElementById("diceArea");
  if (!diceArea) return;

  const faces = ["Left", "Right", "Hub", "Dottt", "Wild"];
  const randomOutcomes = Array(3).fill().map(() => faces[Math.floor(Math.random() * faces.length)]);

  diceArea.innerHTML = renderDice(randomOutcomes);
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initSeatMapping();
  if (!gameStarted && !idleDiceInterval) {
    idleDiceInterval = setInterval(showRandomDice, 1500);
  }
});
