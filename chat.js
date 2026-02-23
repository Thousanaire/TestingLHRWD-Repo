/* ============================================================
   MULTIPLAYER CHAT - PLAYER NAMES + TTS (SPEAKS REAL NAMES)
   ============================================================ */

const chatDiv = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

/* ============================================================
   UNLOCK SPEECH SYNTHESIS (Required on Chrome/iOS/Android)
   ============================================================ */
document.addEventListener("click", () => {
  speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}, { once: true });

// Send on button click OR Enter key
sendBtn.addEventListener("click", sendChatMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function sendChatMessage() {
  const text = input.value.trim();
  if (text === "") return;
  
  // Get MY player name from game.js global state
  const playerName = window.myPlayerName || "Guest";
  
  // Send to SERVER with name
  socket.emit("chatMessage", { 
    roomId, 
    name: playerName, 
    text 
  });
  
  input.value = "";
  input.focus();
}

// Receive chat messages from OTHER players (via server)
socket.on("chatMessage", ({ name, text }) => {
  addMessage(name, text);
});

function addMessage(name, text) {
  const msg = document.createElement("div");
  msg.className = "chat-message";
  
  // Color code by player seat (Player 1=pink, Player 2=purple, etc.)
  const seatColors = ["#ff4081", "#7c4dff", "#00e5ff", "#ffeb3b"];
  const seat = players.indexOf(name);
  const color = seatColors[seat] || "#666";
  
  msg.innerHTML = `
    <span class="chat-name" style="color: ${color}; font-weight: bold;">
      ${name}
    </span>
    <span class="chat-text">${text}</span>
  `;
  
  chatDiv.appendChild(msg);
  
  // Scroll to bottom
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Limit chat height and keep only last 50 messages
function limitChatHistory() {
  while (chatDiv.children.length > 50) {
    chatDiv.removeChild(chatDiv.firstChild);
  }
}

/* ============================================================
   WRAP addMessage TO INCLUDE TTS + HISTORY LIMIT
   ============================================================ */
addMessage = ((originalAddMessage) => {
  return function(name, text) {
    originalAddMessage(name, text);

    // 🔊 Speak message out loud using REAL player name
    const spoken = `${name} said ${text}`;
    const utterance = new SpeechSynthesisUtterance(spoken);
    speechSynthesis.speak(utterance);

    limitChatHistory();
  };
})(addMessage);

// Auto-focus chat input when typing
input.addEventListener("focus", () => {
  chatDiv.scrollTop = chatDiv.scrollHeight;
});

// Clear chat on game reset
socket.on("resetGame", () => {
  chatDiv.innerHTML = "";
});
