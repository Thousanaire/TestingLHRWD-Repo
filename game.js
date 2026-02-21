/* ============================================================
   SOCKET.IO MULTIPLAYER CLIENT - FULLY FIXED ROLL BUTTON + PRODUCTION READY
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
    if (!code || code.length !== 6) {
      alert("Please enter a 6-letter room code");
      return;
    }
    socket.emit("joinRoom", { roomId: code });
  });
}

/* ============================================================
   SOCKET EVENTS FOR ROOM FLOW - PERFECT HOST FLOW
   ============================================================ */

socket.on("connect", () => {
  console.log("✅ Connected to Thousanaire server");
});

socket.on("roomCreated", ({ roomId: id }) => {
  roomId = id;
  document.getElementById("roomCodeDisplay").textContent = id;
  document.getElementById("roomInfo").style.display = "block";
  hideIntroOverlay();
  console.log("🎯 Room created:", id, "- You are Host (Player 1)");
});

socket.on("roomJoined", ({ roomId: id }) => {
  roomId = id;
  document.getElementById("roomCodeDisplay").textContent = id;
  document.getElementById("roomInfo").style.display = "block";
  hideIntroOverlay();
  console.log("✅ Joined room lobby:", id);
});

socket.on("joinedRoom", ({ roomId: id, seat }) => {
  roomId = id;
  mySeat = seat;  // 🎯 CRITICAL: Store my seat number
  
  console.log("🎯 I AM SEAT", mySeat, "- Roll button ready!");
  
  const seatNames = ["Player 1 (Host)", "Player 2", "Player 3", "Player 4"];
  document.getElementById("joinTitle").textContent = `Joined as ${seatNames[seat]}`;
  
  disableJoinInputs();
  showGame();
  updateRollButtonState();  // 🎯 Initial button state
});

socket.on("errorMessage", (msg) => {
  console.error("❌ Server error:", msg);
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

    if (!name || name.length < 2) {
      alert("Please enter your name (2+ characters)");
      return;
    }

    socket.emit("joinSeat", {
      roomId,
      name: name.substring(0, 12),
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
  setTimeout(() => {
    overlay.style.display = "none";
    document.getElementById("joinGame").style.display = "block";
  }, 300);
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
let currentPlayer = null;
let gameStarted   = false;

const logicalPositions = ["top", "right", "bottom", "left"];
let domSeatForLogical  = [0, 1, 2, 3];

let idleDiceInterval;

/* ============================================================
   SEAT MAPPING
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
   ROLL BUTTON STATE
   ============================================================ */

function updateRollButtonState() {
  const rollBtn = document.getElementById("rollBtn");
  if (!rollBtn) return;
  
  const isMyTurn = mySeat !== null && mySeat === currentPlayer;
  rollBtn.disabled = !gameStarted || !isMyTurn || eliminated[mySeat || 0];
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

const rollBtn = document.getElementById("rollBtn");
const resetBtn = document.getElementById("resetBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

if (rollBtn) {
  rollBtn.addEventListener("click", () => {
    if (!roomId || mySeat === null) {
      alert("Join a seat first.");
      playSound("sndNope");
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
   🔥 FIXED STATE UPDATE - ROLL BUTTON WORKS NOW!
   ============================================================ */

socket.on("stateUpdate", (state) => {
  console.log("📊 STATE UPDATE:", state.currentPlayer, "My seat:", mySeat);
  
  isApplyingRemote = true;

  // 🎯 FIXED: Proper null coalescing
  players       = state.players       || players;
  chips         = state.chips         || chips;
  avatars       = state.avatars       || avatars;
  colors        = state.colors        || colors;
  eliminated    = state.eliminated    || eliminated;
  danger        = state.danger        || danger;
  centerPot     = state.centerPot     ?? centerPot;
  currentPlayer = state.currentPlayer ?? null;  // 🎯 FIXED null handling
  gameStarted   = state.gameStarted   ?? gameStarted;

  // 🔗 CHAT INTEGRATION: Update chat name
  if (mySeat !== null && players[mySeat]) {
    window.myPlayerName = players[mySeat];
  }

  updateTable();
  updateRollButtonState();  // 🎯 THIS MAKES ROLL BUTTON WORK!

  // Idle dice animation
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
   ALL OTHER EVENTS (unchanged - already perfect)
   ============================================================ */

socket.on("graceWarning", ({ seat, message }) => {
  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    resultsEl.textContent = message;
    resultsEl.style.color = "#ff9800";
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
    resultsEl.style.color = "#f44336";
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

socket.on("resetGame", () => {
  players = [null, null, null, null];
  chips = [0, 0, 0, 0];
  avatars = [null, null, null, null];
  colors = [null, null, null, null];
  eliminated = [false, false, false, false];
  danger = [false, false, false, false];
  centerPot = 0;
  currentPlayer = null;
  gameStarted = false;
  
  const chatDiv = document.getElementById("chatMessages");
  if (chatDiv) chatDiv.innerHTML = "";
  updateRollButtonState();
});

/* ============================================================
   [Keep all your existing functions unchanged - they're perfect]
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

function showRandomDice() {
  const diceArea = document.getElementById("diceArea");
  if (!diceArea) return;

  const faces = ["Left", "Right", "Hub", "Dottt", "Wild"];
  const randomOutcomes = Array(3).fill().map(() => faces[Math.floor(Math.random() * faces.length)]);

  diceArea.innerHTML = renderDice(randomOutcomes);
}

/* ============================================================
   ⭐ UPDATED WILD LOGIC — INSTANT ACTIONS, NO CONFIRM BUTTON
   ============================================================ */

function openWildChoicePanelServerDriven(playerIndex, outcomes) {
  const wildContent = document.getElementById("wildContent");
  const resultsEl   = document.getElementById("results");
  const rollBtn     = document.getElementById("rollBtn");

  if (!wildContent || !resultsEl || !rollBtn) return;

  rollBtn.disabled = true;
  resultsEl.innerText = `You rolled: ${outcomes.join(", ")}`;

  // Identify all Wild dice indices
  const wildIndices = outcomes
    .map((o, i) => (o === "Wild" ? i : null))
    .filter((i) => i !== null);

  const wildCount = wildIndices.length;
  if (wildCount === 0) {
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
    return;
  }

  // Track which Wilds have been used
  const usedWilds = new Set();

  function getNextWildIndex() {
    for (const wi of wildIndices) {
      if (!usedWilds.has(wi)) return wi;
    }
    return null;
  }

  function markWildUsed(wi) {
    usedWilds.add(wi);

    // If all Wilds used → close panel immediately
    if (usedWilds.size >= wildCount) {
      wildContent.innerHTML = "";
      rollBtn.disabled = false;
    }
  }

  // Build UI
  wildContent.innerHTML = `
    <h3>🎲 Wild Choices (${wildCount} Wild${wildCount > 1 ? 's' : ''})</h3>
    <p>Choose actions — each action executes instantly.</p>
  `;

  // CANCEL BUTTONS
  ["Left", "Right", "Hub"].forEach(direction => {
    if (outcomes.includes(direction)) {
      const btn = document.createElement("button");
      btn.textContent = `❌ Cancel ${direction}`;
      btn.onclick = () => {
        const wi = getNextWildIndex();
        if (wi === null) return;

        socket.emit("resolveWilds", {
          roomId,
          seat: playerIndex,  // 🔥 PATCH: include acting seat
          actions: [{ type: "cancel", target: direction, wildIndex: wi }]
        });

        btn.disabled = true;
        btn.textContent = `✅ ${direction} Canceled`;
        btn.style.background = "#4CAF50";

        markWildUsed(wi);
      };
      wildContent.appendChild(btn);
    }
  });

  // STEAL BUTTONS
  const opponents = players
    .map((p, i) => ({ name: p, index: i }))
    .filter((o) => o.index !== playerIndex && o.name && !eliminated[o.index]);

  opponents.forEach((op) => {
    const btn = document.createElement("button");
    btn.textContent = `💰 Steal from ${op.name}`;
    btn.onclick = () => {
      const wi = getNextWildIndex();
      if (wi === null) return;

      socket.emit("resolveWilds", {
        roomId,
        seat: playerIndex,  // 🔥 PATCH: include acting seat
        actions: [{ type: "steal", from: op.index, wildIndex: wi }]
      });

      btn.disabled = true;
      btn.textContent = `✅ Stole from ${op.name}`;
      btn.style.background = "#4CAF50";

      markWildUsed(wi);
    };
    wildContent.appendChild(btn);
  });
}

/* ============================================================
   TRIPLE WILD PANEL (UNCHANGED EXCEPT FOR SEAT PATCH)
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
    socket.emit("tripleWildChoice", {
      roomId,
      seat: playerIndex,          // 🔥 PATCH: include acting seat
      choice: { type: "takePot" }
    });
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
  };

  document.getElementById("steal3Btn").onclick = () => {
    socket.emit("tripleWildChoice", {
      roomId,
      seat: playerIndex,          // 🔥 PATCH: include acting seat
      choice: { type: "steal3" }
    });
    wildContent.innerHTML = "";
    rollBtn.disabled = false;
  };
}

/* ============================================================
   CHIP ANIMATION (UNCHANGED)
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
   INITIALIZATION (UNCHANGED)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initSeatMapping();
  if (!gameStarted && !idleDiceInterval) {
    idleDiceInterval = setInterval(showRandomDice, 1500);
  }
});
