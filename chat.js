/* ============================================================
   MULTIPLAYER CHAT - FULLY UPDATED WITH PLAYER NAMES
   ============================================================ */

const chatDiv = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

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
  
  // Optional: TTS (commented out - uncomment if desired)
  // let utterance = new SpeechSynthesisUtterance(`${name}: ${text}`);
  // speechSynthesis.speak(utterance);
}

// Limit chat height and keep only last 50 messages
function limitChatHistory() {
  while (chatDiv.children.length > 50) {
    chatDiv.removeChild(chatDiv.firstChild);
  }
}

// Call after each message
addMessage = ((originalAddMessage) => {
  return function(name, text) {
    originalAddMessage(name, text);
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
