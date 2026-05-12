const state = {
  token: localStorage.getItem("code-duels-token") || "",
  user: null,
  mode: "easy",
  authMode: "login",
  game: null,
  eventSource: null,
  pollTimer: null,
  lastCode: "",
  currentGameId: null,
  serverOffset: 0,
  lastOpponentType: "friend"
};

const els = {
  authView: document.querySelector("#authView"),
  appView: document.querySelector("#appView"),
  authForm: document.querySelector("#authForm"),
  authTabs: document.querySelectorAll(".auth-tab"),
  usernameInput: document.querySelector("#usernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  authSubmit: document.querySelector("#authSubmit"),
  authStatus: document.querySelector("#authStatus"),
  profileButton: document.querySelector("#profileButton"),
  profileModal: document.querySelector("#profileModal"),
  closeProfileButton: document.querySelector("#closeProfileButton"),
  profileForm: document.querySelector("#profileForm"),
  profileUsernameInput: document.querySelector("#profileUsernameInput"),
  profileStatus: document.querySelector("#profileStatus"),
  profileElo: document.querySelector("#profileElo"),
  profileRecord: document.querySelector("#profileRecord"),
  profileWinRate: document.querySelector("#profileWinRate"),
  profileAvgTime: document.querySelector("#profileAvgTime"),
  profileHints: document.querySelector("#profileHints"),
  profileMode: document.querySelector("#profileMode"),
  profileMatches: document.querySelector("#profileMatches"),
  logoutButton: document.querySelector("#logoutButton"),
  accountName: document.querySelector("#accountName"),
  accountElo: document.querySelector("#accountElo"),
  modeButtons: document.querySelectorAll(".mode"),
  friendButton: document.querySelector("#friendButton"),
  botButton: document.querySelector("#botButton"),
  status: document.querySelector("#status"),
  matchMeta: document.querySelector("#matchMeta"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengePrompt: document.querySelector("#challengePrompt"),
  players: document.querySelector("#players"),
  hintMeta: document.querySelector("#hintMeta"),
  hintButton: document.querySelector("#hintButton"),
  hintList: document.querySelector("#hintList"),
  codeEditor: document.querySelector("#codeEditor"),
  resetCode: document.querySelector("#resetCode"),
  nextMatchButton: document.querySelector("#nextMatchButton"),
  submitCode: document.querySelector("#submitCode"),
  testList: document.querySelector("#testList"),
  feed: document.querySelector("#feed"),
  reviewPanel: document.querySelector("#reviewPanel"),
  reviewTitle: document.querySelector("#reviewTitle"),
  reviewHiddenTests: document.querySelector("#reviewHiddenTests"),
  reviewConcept: document.querySelector("#reviewConcept"),
  reviewYourCode: document.querySelector("#reviewYourCode"),
  reviewSolution: document.querySelector("#reviewSolution"),
  timer: document.querySelector("#timer"),
  leaderboardList: document.querySelector("#leaderboardList"),
  refreshBoard: document.querySelector("#refreshBoard")
};

function api(path, body, method = "POST") {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  });
}

function setStatus(text) {
  els.status.textContent = text;
}

function setAuthStatus(text) {
  els.authStatus.textContent = text;
}

function showApp(user) {
  state.user = user;
  els.authView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.accountName.textContent = user.username;
  els.accountElo.textContent = `${user.elo} Elo`;
  connectEvents();
  startMatchPolling();
  loadLeaderboard();
}

function showAuth(message = "Accounts are stored locally with salted password hashes.") {
  els.appView.classList.add("hidden");
  els.authView.classList.remove("hidden");
  setAuthStatus(message);
}

function connectEvents() {
  if (!state.token) return;
  if (state.eventSource) state.eventSource.close();
  state.eventSource = new EventSource(`/events?token=${encodeURIComponent(state.token)}`);
  state.eventSource.addEventListener("queue", (event) => {
    const data = JSON.parse(event.data);
    setStatus(data.message);
  });
  state.eventSource.addEventListener("game", (event) => {
    state.game = JSON.parse(event.data);
    state.serverOffset = state.game.serverNow - Date.now();
    renderGame();
    loadLeaderboard();
  });
}

function renderChat(game) {
  const log = document.querySelector("#chatLog");
  if (!log) return;
  log.innerHTML = (game.chats || []).map(c => {
    const isMe = c.playerId === game.viewerId;
    return `<div class="chat-message${isMe ? "me" : "them"}">
      <strong>${escapeHtml(c.playerName)}:</strong> ${escapeHtml(c.message)}
    </div>`;
  }).join("");
  log.scrollTop = log.scrollHeight;
}

async function sendChat(message) {
    if (!state.game || !message.trim()) return;
    try {
      await api("/api/chat", { gameId: state.game.id, message });
    } catch (error) {
      setStatus(error.message);
    }
}

async function authenticate(event) {
  event.preventDefault();
  const username = els.usernameInput.value.trim();
  const password = els.passwordInput.value;
  if (!username || !password) {
    setAuthStatus("Enter a username and password.");
    return;
  }
  els.authSubmit.disabled = true;
  try {
    const data = await api(`/api/${state.authMode}`, { username, password });
    state.token = data.token;
    localStorage.setItem("code-duels-token", state.token);
    showApp(data.user);
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    els.authSubmit.disabled = false;
  }
}

async function restoreSession() {
  if (!state.token) {
    showAuth();
    return;
  }
  try {
    const data = await api("/api/me", null, "GET");
    showApp(data.user);
  } catch {
    localStorage.removeItem("code-duels-token");
    state.token = "";
    showAuth("Session expired. Log in again.");
  }
}

function logout() {
  localStorage.removeItem("code-duels-token");
  state.token = "";
  state.user = null;
  state.game = null;
  if (state.eventSource) state.eventSource.close();
  if (state.pollTimer) clearInterval(state.pollTimer);
  showAuth("Logged out.");
}

async function openProfile() {
  if (!state.user) return;
  els.profileModal.classList.remove("hidden");
  els.profileModal.setAttribute("aria-hidden", "false");
  els.profileStatus.textContent = "Loading profile...";
  els.profileUsernameInput.value = state.user.username;
  try {
    const profile = await api("/api/profile", null, "GET");
    renderProfile(profile);
  } catch (error) {
    els.profileStatus.textContent = error.message;
  }
}

function closeProfile() {
  els.profileModal.classList.add("hidden");
  els.profileModal.setAttribute("aria-hidden", "true");
}

function renderProfile(profile) {
  state.user = profile.user;
  els.accountName.textContent = profile.user.username;
  els.accountElo.textContent = `${profile.user.elo} Elo`;
  els.profileUsernameInput.value = profile.user.username;
  els.profileElo.textContent = profile.user.elo;
  els.profileRecord.textContent = `${profile.stats.wins}W ${profile.stats.losses}L`;
  els.profileWinRate.textContent = `${profile.stats.winRate}%`;
  els.profileAvgTime.textContent = profile.stats.avgSeconds ? `${profile.stats.avgSeconds}s` : "--";
  els.profileHints.textContent = profile.stats.totalHints;
  els.profileMode.textContent = titleCase(profile.stats.favoriteMode);
  els.profileStatus.textContent = profile.stats.games
    ? `${profile.stats.games} completed matches. Best Elo gain: +${profile.stats.bestDelta}.`
    : "No completed matches yet.";
  els.profileMatches.innerHTML = profile.recentMatches.length
    ? profile.recentMatches
        .map((match) => {
          const delta = match.eloDelta >= 0 ? `+${match.eloDelta}` : String(match.eloDelta);
          return `<div class="profile-match ${match.result.toLowerCase()}">
            <strong>${escapeHtml(match.result)} ${delta} Elo</strong>
            <span>${titleCase(match.mode)} - ${match.elapsedSeconds || 0}s - ${match.hintsUsed || 0} hints</span>
          </div>`;
        })
        .join("")
    : `<div class="profile-match empty">No match history yet.</div>`;
}

async function saveProfileUsername(event) {
  event.preventDefault();
  const username = els.profileUsernameInput.value.trim();
  if (!username) {
    els.profileStatus.textContent = "Enter a username.";
    return;
  }
  els.profileStatus.textContent = "Saving username...";
  try {
    const profile = await api("/api/profile/username", { username });
    renderProfile(profile);
    loadLeaderboard();
  } catch (error) {
    els.profileStatus.textContent = error.message;
  }
}

function titleCase(value) {
  const text = String(value || "none");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setAuthMode(mode) {
  state.authMode = mode;
  els.authTabs.forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  els.authSubmit.textContent = mode === "signup" ? "Create account" : "Log in";
  els.passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
  setAuthStatus(mode === "signup" ? "Choose a username and a 6+ character password." : "Welcome back. Log in to queue.");
}

function startMatchPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(refreshCurrentGame, 2500);
}

async function refreshCurrentGame() {
  if (!state.user || !state.token) return;
  try {
    const data = await api("/api/current-game", null, "GET");
    if (data.game && (!state.game || state.game.id !== data.game.id || data.game.status !== state.game.status)) {
      state.game = data.game;
      state.serverOffset = state.game.serverNow - Date.now();
      renderGame();
    }
    if (data.player && state.user) {
      state.user.elo = data.player.elo;
      els.accountElo.textContent = `${data.player.elo} Elo`;
    }
  } catch {
    // The next user action will surface auth/server errors.
  }
}

async function startDuel(kind) {
  if (!state.user) return;
  els.friendButton.disabled = true;
  els.botButton.disabled = true;
  setStatus(kind === "bot" ? "Starting an NPC duel..." : "Looking for another signed-in player...");
  state.lastOpponentType = kind;
  try {
    const data = await api(kind === "bot" ? "/api/bot" : "/api/join", { mode: state.mode });
    if (data.game) {
      state.game = data.game;
      state.serverOffset = state.game.serverNow - Date.now();
      renderGame();
    } else {
      setStatus(`Waiting for a ${state.mode} opponent. Both players must use the same server URL.`);
    }
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.friendButton.disabled = false;
    els.botButton.disabled = false;
  }
}

function renderGame() {
  const game = state.game;
  if (!game) return;
  const isActive = game.status === "active";
  const challenge = game.challenge;
  const isNewGame = state.currentGameId !== game.id;
  state.currentGameId = game.id;

  els.matchMeta.textContent = `${game.mode.toUpperCase()} ${game.opponentType === "bot" ? "bot" : "friend"} duel - ${game.status}`;
  els.challengeTitle.textContent = challenge.title;
  els.challengePrompt.textContent = challenge.prompt;
  els.codeEditor.disabled = !isActive;
  els.submitCode.disabled = !isActive;
  els.resetCode.disabled = !isActive;
  els.nextMatchButton.disabled = isActive;
  els.hintButton.disabled = !isActive || game.hints.length >= game.hintPolicy.max;
  setStatus(resultMessage(game));

  if (isNewGame) {
    els.codeEditor.value = challenge.brokenCode;
    state.lastCode = challenge.brokenCode;
  }

  els.players.innerHTML = game.players
    .map((player) => {
      const marker = player.id === game.viewerId ? "You" : "Opponent";
      const label = player.bot ? "NPC" : marker;
      const won = game.winnerId === player.id ? " winner" : "";
      return `<div class="player"><strong>${escapeHtml(player.name)}${won}</strong><span>${label} - ${player.elo} Elo</span></div>`;
    })
    .join("");

  const me = game.players.find((player) => player.id === game.viewerId);
  if (me && state.user) {
    state.user.elo = me.elo;
    els.accountElo.textContent = `${me.elo} Elo`;
  }

  renderHints(game);
  renderChat(game);
  renderTests(game.challenge.tests, game.submissions.at(-1)?.results || []);
  renderReview(game);
  const scoringLine = !isActive ? `<div class="score-line">${escapeHtml(resultMessage(game))}</div>` : "";
  els.feed.innerHTML = scoringLine + game.submissions
    .slice()
    .reverse()
    .map((submission) => `<div>${new Date(submission.at).toLocaleTimeString()} - <strong>${escapeHtml(submission.playerName)}</strong> - ${escapeHtml(submission.message)}</div>`)
    .join("");
}

function renderReview(game) {
  if (!game.review) {
    els.reviewPanel.classList.add("hidden");
    return;
  }
  els.reviewPanel.classList.remove("hidden");
  els.reviewTitle.textContent = game.review.title;
  els.reviewHiddenTests.textContent = `Hidden tests: ${game.review.hiddenTests}`;
  els.reviewConcept.textContent = game.review.concept;
  els.reviewYourCode.textContent = game.review.yourCode || "No submitted code for this round.";
  els.reviewSolution.textContent = game.review.solution || "Solution unavailable.";
}

function resultMessage(game) {
  if (game.status === "active") return game.lastMessage;
  if (game.status === "expired") return "Round over. No Elo changed.";
  if (!game.scoring) return game.lastMessage;
  const won = game.winnerId === game.viewerId;
  return won ? `You won ${signed(game.scoreDelta)} Elo.` : `You lost ${Math.abs(game.scoreDelta)} Elo.`;
}

function renderHints(game) {
  const used = game.hints.length;
  const nextCost = used < game.hintPolicy.max ? hintCostLabel(game, used) : "none left";
  const freeCopy = game.hintPolicy.free > 0 ? `${game.hintPolicy.free} free` : "all paid";
  els.hintMeta.textContent = `${used}/${game.hintPolicy.max} used - ${freeCopy} - next: ${nextCost}`;
  els.hintButton.textContent = used >= game.hintPolicy.max ? "No hints left" : `Reveal hint ${used + 1}`;
  els.hintList.innerHTML = game.hints.length
    ? game.hints
        .map((hint) => `<div class="hint"><span>Hint ${hint.index + 1} - ${hint.cost > 0 ? `${hint.cost} Elo` : "free"}</span><p>${escapeHtml(hint.text)}</p></div>`)
        .join("")
    : `<div class="hint empty">No hints revealed yet.</div>`;
}

function hintCostLabel(game, index) {
  const cost = game.hintPolicy.costs[index] || 0;
  return cost > 0 ? `${cost} Elo` : "free";
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function renderTests(tests, results) {
  els.testList.innerHTML = tests
    .map((test, index) => {
      const result = results.find((item) => item.index === index + 1);
      const cls = result ? (result.passed ? "pass" : "fail") : "";
      const badge = result ? (result.passed ? "PASS" : "FAIL") : "TEST";
      return `<div class="test ${cls}"><span class="badge">${badge}</span><code>solve(${escapeHtml(JSON.stringify(test.input).slice(1, -1))}) -> ${escapeHtml(JSON.stringify(test.expected))}</code></div>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function submitCode() {
  if (!state.game) return;
  els.submitCode.disabled = true;
  try {
    const data = await api("/api/submit", {
      gameId: state.game.id,
      code: els.codeEditor.value
    });
    renderTests(state.game.challenge.tests, data.result.results);
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.submitCode.disabled = state.game?.status !== "active";
  }
}

async function requestHint() {
  if (!state.game) return;
  els.hintButton.disabled = true;
  try {
    const data = await api("/api/hint", { gameId: state.game.id });
    state.game = data.game;
    state.serverOffset = state.game.serverNow - Date.now();
    renderGame();
    loadLeaderboard();
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.hintButton.disabled = state.game?.status !== "active" || state.game?.hints.length >= state.game?.hintPolicy.max;
  }
}

async function loadLeaderboard() {
  const response = await fetch("/api/leaderboard");
  const rows = await response.json();
  if (!rows.length) {
    els.leaderboardList.innerHTML = `<li><span class="rank">--</span><span>No ranked users yet</span><span class="elo">1000</span></li>`;
    return;
  }
  els.leaderboardList.innerHTML = rows
    .map((row, index) => `<li><span class="rank">#${index + 1}</span><span>${escapeHtml(row.name)}<br><small>${row.wins}W ${row.losses}L</small></span><span class="elo">${row.elo}</span></li>`)
    .join("");
}

function tickTimer() {
  const endsAt = state.game?.endsAt;
  if (!endsAt || state.game?.status !== "active") {
    els.timer.textContent = "--:--";
    els.timer.classList.remove("urgent");
    return;
  }
  const seconds = Math.max(0, Math.ceil((endsAt - (Date.now() + state.serverOffset)) / 1000));
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  els.timer.textContent = `${mins}:${secs}`;
  els.timer.classList.toggle("urgent", seconds <= 15);
  if (seconds === 0) {
    els.codeEditor.disabled = true;
    els.submitCode.disabled = true;
    els.hintButton.disabled = true;
    setStatus("Time expired. Waiting for the server to close the duel.");
  }
}

els.authForm.addEventListener("submit", authenticate);
els.authTabs.forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
els.profileButton.addEventListener("click", openProfile);
els.closeProfileButton.addEventListener("click", closeProfile);
els.profileForm.addEventListener("submit", saveProfileUsername);
els.profileModal.addEventListener("click", (event) => {
  if (event.target === els.profileModal) closeProfile();
});
els.logoutButton.addEventListener("click", logout);
els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    els.modeButtons.forEach((modeButton) => modeButton.classList.toggle("active", modeButton === button));
  });
});
els.friendButton.addEventListener("click", () => startDuel("friend"));
els.botButton.addEventListener("click", () => startDuel("bot"));
els.resetCode.addEventListener("click", () => {
  if (!state.game) return;
  els.codeEditor.value = state.game.challenge.brokenCode;
  state.lastCode = state.game.challenge.brokenCode;
});
els.nextMatchButton.addEventListener("click", () => {
  if (!state.game || state.game.status === "active") return;
  state.mode = state.game.mode;
  const modeButton = Array.from(els.modeButtons).find((button) => button.dataset.mode === state.mode);
  if (modeButton) els.modeButtons.forEach((button) => button.classList.toggle("active", button === modeButton));
  startDuel(state.game.opponentType || state.lastOpponentType);
});
els.codeEditor.addEventListener("input", () => {
  state.lastCode = els.codeEditor.value;
});
els.submitCode.addEventListener("click", submitCode);
els.hintButton.addEventListener("click", requestHint);
els.refreshBoard.addEventListener("click", loadLeaderboard);

document.querySelector("#chatSend").addEventListener("click", () => {
  const input = document.querySelector("#chatInput");
  sendChat(input.value);
  input.value = "";
});

document.querySelector("#chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendChat(e.target.value);
    e.target.value = "";
  }
});

document.querySelector("#themeToggle").addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "" : "dark";
  document.querySelector("#themeToggle").textContent = isDark ? "Dark" : "Light";
});

setInterval(tickTimer, 250);

document.querySelector("#themeToggle").textContent = 
  document.documentElement.dataset.theme === "dark" ? "Light" : "Dark";

restoreSession();
