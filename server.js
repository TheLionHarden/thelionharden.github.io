const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "code-duels-db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const sessions = new Map();
const clients = new Map();
const activePlayers = new Map();
const queue = { easy: [], medium: [], hard: [] };
const games = new Map();

const challenges = [
  {
    id: "sum-array",
    mode: "easy",
    title: "Patch the Loot Counter",
    prompt: "Return the sum of all numbers in an array.",
    brokenCode: `function solve(nums) {
  let total = 0;
  for (let i = 0; i <= nums.length; i++) {
    total += nums[i];
  }
  return total;
}`,
    solution: `function solve(nums) {
  let total = 0;
  for (let i = 0; i < nums.length; i++) {
    total += nums[i];
  }
  return total;
}`,
    hints: [
      "Check the loop boundary. The last valid index is nums.length - 1.",
      "Adding nums[nums.length] introduces undefined into the total.",
      "Use i < nums.length instead of i <= nums.length.",
      "Empty arrays should return the initial total without entering the loop.",
      "The simplest fix is only changing the loop condition."
    ],
    tests: [
      { input: [[1, 2, 3, 4]], expected: 10 },
      { input: [[-2, 2, 8]], expected: 8 },
      { input: [[]], expected: 0 }
    ],
    hiddenTests: [{ input: [[100, -50, 25]], expected: 75 }]
  },
  {
    id: "unique",
    mode: "easy",
    title: "De-Dupe the Map Fragments",
    prompt: "Remove duplicate values while preserving first-seen order.",
    brokenCode: `function solve(items) {
  const seen = [];
  return items.filter((item) => {
    if (seen.includes(item)) return true;
    seen.push(item);
    return true;
  });
}`,
    solution: `function solve(items) {
  const seen = [];
  return items.filter((item) => {
    if (seen.includes(item)) return false;
    seen.push(item);
    return true;
  });
}`,
    hints: [
      "The duplicate branch is currently keeping duplicates.",
      "filter should return false when an item was already seen.",
      "When seen.includes(item) is true, return false.",
      "Push the item only after you know it is new.",
      "A Set can also solve this while preserving insertion order."
    ],
    tests: [
      { input: [[1, 1, 2, 3, 2]], expected: [1, 2, 3] },
      { input: [["a", "b", "a", "c"]], expected: ["a", "b", "c"] },
      { input: [[]], expected: [] }
    ],
    hiddenTests: [{ input: [[0, 0, false, false, "0"]], expected: [0, false, "0"] }]
  },
  {
    id: "reverse-text",
    mode: "easy",
    title: "Reverse the Transmission",
    prompt: "Return the input string reversed.",
    brokenCode: `function solve(text) {
  return text.split("").reverse;
}`,
    solution: `function solve(text) {
  return text.split("").reverse().join("");
}`,
    hints: [
      "reverse is a function, so it needs parentheses.",
      "split turns the string into an array of characters.",
      "After reversing the array, join it back into a string.",
      "The final chain should use split, reverse(), and join.",
      "An empty string should still return an empty string."
    ],
    tests: [
      { input: ["duel"], expected: "leud" },
      { input: ["abc"], expected: "cba" },
      { input: [""], expected: "" }
    ],
    hiddenTests: [{ input: ["racecar"], expected: "racecar" }]
  },
  {
    id: "max-number",
    mode: "easy",
    title: "Find the Highest Signal",
    prompt: "Return the largest number in the array, or null for an empty array.",
    brokenCode: `function solve(nums) {
  let best = 0;
  for (const num of nums) {
    if (num < best) best = num;
  }
  return best;
}`,
    solution: `function solve(nums) {
  if (nums.length === 0) return null;
  let best = nums[0];
  for (const num of nums) {
    if (num > best) best = num;
  }
  return best;
}`,
    hints: [
      "Starting at 0 breaks arrays with only negative numbers.",
      "Use the first array item as the starting best value.",
      "The comparison should check if num is greater than best.",
      "Handle an empty array before reading nums[0].",
      "Return null when there are no numbers."
    ],
    tests: [
      { input: [[1, 9, 3]], expected: 9 },
      { input: [[-8, -2, -5]], expected: -2 },
      { input: [[]], expected: null }
    ],
    hiddenTests: [{ input: [[42]], expected: 42 }]
  },
  {
    id: "middle-value",
    mode: "medium",
    title: "Center the Signal",
    prompt: "Return the middle value after sorting the numbers ascending.",
    brokenCode: `function solve(nums) {
  const sorted = nums.sort();
  return sorted[Math.round(sorted.length / 2)];
}`,
    solution: `function solve(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}`,
    hints: [
      "Default array sort compares values as strings.",
      "Use a numeric compare function: (a, b) => a - b.",
      "Use Math.floor for the middle index.",
      "Copy the array before sorting if you want to avoid mutating input."
    ],
    tests: [
      { input: [[9, 1, 5]], expected: 5 },
      { input: [[10, 2, 30, 4, 5]], expected: 5 },
      { input: [[7]], expected: 7 }
    ],
    hiddenTests: [
      { input: [[]], expected: null },
      { input: [[100, 3, 20]], expected: 20 }
    ]
  },
  {
    id: "count-vowels",
    mode: "medium",
    title: "Tune the Echo Scanner",
    prompt: "Count vowels in a string, ignoring case.",
    brokenCode: `function solve(text) {
  let count = 0;
  for (const ch of text) {
    if ("aeiou".includes(ch)) count--;
  }
  return count;
}`,
    solution: `function solve(text) {
  let count = 0;
  for (const ch of text.toLowerCase()) {
    if ("aeiou".includes(ch)) count++;
  }
  return count;
}`,
    hints: [
      "The code is subtracting when it finds a vowel.",
      "Convert the string to lowercase before checking vowels.",
      "Increment count when the character is in aeiou.",
      "Only a, e, i, o, and u count for this challenge."
    ],
    tests: [
      { input: ["Code Duels"], expected: 4 },
      { input: ["RHYTHM"], expected: 0 },
      { input: ["Education"], expected: 5 }
    ],
    hiddenTests: [{ input: ["AEIOUaeiou"], expected: 10 }]
  },
  {
    id: "first-non-repeat",
    mode: "medium",
    title: "Find the Solo Beacon",
    prompt: "Return the first character that appears exactly once, or null if none exists.",
    brokenCode: `function solve(text) {
  const counts = {};
  for (const ch of text) counts[ch] = 1;
  for (const ch of text) {
    if (counts[ch] === 1) return text[ch];
  }
  return null;
}`,
    solution: `function solve(text) {
  const counts = {};
  for (const ch of text) counts[ch] = (counts[ch] || 0) + 1;
  for (const ch of text) {
    if (counts[ch] === 1) return ch;
  }
  return null;
}`,
    hints: [
      "Counts need to increment instead of always becoming 1.",
      "The second loop already gives you the character.",
      "Return ch, not text[ch].",
      "Use null when no unique character exists."
    ],
    tests: [
      { input: ["swiss"], expected: "w" },
      { input: ["aabbc"], expected: "c" },
      { input: ["aabb"], expected: null }
    ],
    hiddenTests: [{ input: ["leetcode"], expected: "l" }]
  },
  {
    id: "chunk-sum",
    mode: "medium",
    title: "Compress the Supply Runs",
    prompt: "Return an array of sums for chunks of size two.",
    brokenCode: `function solve(nums) {
  const result = [];
  for (let i = 0; i < nums.length; i++) {
    result.push(nums[i] + nums[i + 1]);
  }
  return result;
}`,
    solution: `function solve(nums) {
  const result = [];
  for (let i = 0; i < nums.length; i += 2) {
    result.push(nums[i] + (nums[i + 1] || 0));
  }
  return result;
}`,
    hints: [
      "The loop should jump by two after each chunk.",
      "Odd-length arrays need the last number to stand alone.",
      "Use 0 when nums[i + 1] is missing.",
      "Push one sum per pair, not one sum per index."
    ],
    tests: [
      { input: [[1, 2, 3, 4]], expected: [3, 7] },
      { input: [[5, 5, 2]], expected: [10, 2] },
      { input: [[]], expected: [] }
    ],
    hiddenTests: [{ input: [[0, 1, 0, 1, 9]], expected: [1, 1, 9] }]
  },
  {
    id: "balanced",
    mode: "hard",
    title: "Stabilize the Vault Locks",
    prompt: "Return true when every bracket is closed in the correct order.",
    brokenCode: `function solve(text) {
  const stack = [];
  const pairs = { ")": "(", "]": "[", "}": "{" };
  for (const ch of text) {
    if ("([{".includes(ch)) stack.push(ch);
    if (")]}".includes(ch) && stack.pop() !== ch) return false;
  }
  return stack.length === 0;
}`,
    solution: `function solve(text) {
  const stack = [];
  const pairs = { ")": "(", "]": "[", "}": "{" };
  for (const ch of text) {
    if ("([{".includes(ch)) stack.push(ch);
    if (")]}".includes(ch) && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}`,
    hints: [
      "pairs maps a closing bracket to the opening bracket you expect to pop.",
      "Compare stack.pop() against pairs[ch], not ch itself."
    ],
    tests: [
      { input: ["([]){}"], expected: true },
      { input: ["([)]"], expected: false },
      { input: ["{[()()]()}"], expected: true },
      { input: ["(((()"], expected: false }
    ],
    hiddenTests: [
      { input: ["]"], expected: false },
      { input: ["a(b)c[d]{e}"], expected: true }
    ]
  },
  {
    id: "longest-run",
    mode: "hard",
    title: "Decode the Signal Run",
    prompt: "Return the length of the longest consecutive increasing run.",
    brokenCode: `function solve(nums) {
  let best = 0;
  let current = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > nums[i - 1]) current++;
    else current = 0;
    best = Math.max(best, current);
  }
  return best;
}`,
    solution: `function solve(nums) {
  if (nums.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < nums.length; i++) {
    current = nums[i] > nums[i - 1] ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}`,
    hints: [
      "A run length starts at 1 when the array is not empty.",
      "When the run continues, increment the current length; when it breaks, reset to 1."
    ],
    tests: [
      { input: [[1, 2, 3, 2, 3, 4, 5]], expected: 4 },
      { input: [[7]], expected: 1 },
      { input: [[5, 4, 3]], expected: 1 },
      { input: [[1, 3, 5, 7, 9]], expected: 5 }
    ],
    hiddenTests: [
      { input: [[]], expected: 0 },
      { input: [[2, 2, 3]], expected: 2 }
    ]
  },
  {
    id: "merge-intervals",
    mode: "hard",
    title: "Merge the Patrol Zones",
    prompt: "Merge overlapping intervals sorted by start time.",
    brokenCode: `function solve(intervals) {
  intervals.sort();
  const merged = [];
  for (const current of intervals) {
    const last = merged[merged.length - 1];
    if (!last || current[0] > last[1]) merged.push(current);
    else last[1] = current[1];
  }
  return merged;
}`,
    solution: `function solve(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const current of intervals) {
    const last = merged[merged.length - 1];
    if (!last || current[0] > last[1]) merged.push([...current]);
    else last[1] = Math.max(last[1], current[1]);
  }
  return merged;
}`,
    hints: [
      "Sort intervals by their numeric start value.",
      "When intervals overlap, the end should be the larger end value."
    ],
    tests: [
      { input: [[[1, 3], [2, 6], [8, 10]]], expected: [[1, 6], [8, 10]] },
      { input: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { input: [[]], expected: [] }
    ],
    hiddenTests: [{ input: [[[5, 7], [1, 2], [2, 4]]], expected: [[1, 4], [5, 7]] }]
  },
  {
    id: "binary-search",
    mode: "hard",
    title: "Locate the Hidden Cache",
    prompt: "Return the index of target in a sorted array, or -1 if missing.",
    brokenCode: `function solve(nums, target) {
  let left = 0;
  let right = nums.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) right = mid - 1;
    else left = mid + 1;
  }
  return -1;
}`,
    solution: `function solve(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
    hints: [
      "right should start at the last valid index.",
      "When nums[mid] is too small, move left upward."
    ],
    tests: [
      { input: [[1, 3, 5, 7, 9], 7], expected: 3 },
      { input: [[1, 3, 5, 7, 9], 2], expected: -1 },
      { input: [[], 4], expected: -1 }
    ],
    hiddenTests: [{ input: [[2, 4, 6], 2], expected: 0 }]
  }
];

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    saveDb({ users: [], matches: [] });
  }
}

function loadDb() {
  ensureData();
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    db.users ||= [];
    db.matches ||= [];
    return db;
  } catch {
    return { users: [], matches: [] };
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2) + "\n");
}

function normalizeUsername(username) {
  return String(username || "").trim().replace(/\s+/g, "_").slice(0, 24);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    elo: user.elo,
    wins: user.wins,
    losses: user.losses,
    games: user.games,
    createdAt: user.createdAt
  };
}

function createUser(username, password) {
  const clean = normalizeUsername(username);
  if (clean.length < 3) throw new Error("Username must be at least 3 characters.");
  if (String(password || "").length < 6) throw new Error("Password must be at least 6 characters.");

  const db = loadDb();
  const key = clean.toLowerCase();
  if (db.users.some((user) => user.key === key)) throw new Error("That username is taken.");

  const passwordRecord = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    key,
    username: clean,
    passwordSalt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    elo: 1000,
    wins: 0,
    losses: 0,
    games: 0,
    createdAt: Date.now()
  };
  db.users.push(user);
  saveDb(db);
  return user;
}

function verifyUser(username, password) {
  const key = normalizeUsername(username).toLowerCase();
  const db = loadDb();
  const user = db.users.find((candidate) => candidate.key === key);
  if (!user) throw new Error("Invalid username or password.");

  const attempted = hashPassword(password, user.passwordSalt).hash;
  const actual = Buffer.from(user.passwordHash, "hex");
  const incoming = Buffer.from(attempted, "hex");
  if (actual.length !== incoming.length || !crypto.timingSafeEqual(actual, incoming)) {
    throw new Error("Invalid username or password.");
  }
  return user;
}

function saveUserStats(player) {
  const db = loadDb();
  const user = db.users.find((candidate) => candidate.id === player.userId);
  if (!user) return;
  user.elo = player.elo;
  user.wins = player.wins;
  user.losses = player.losses;
  user.games = player.games;
  saveDb(db);
}

function updateUsername(userId, username) {
  const clean = normalizeUsername(username);
  if (clean.length < 3) throw new Error("Username must be at least 3 characters.");

  const db = loadDb();
  const key = clean.toLowerCase();
  if (db.users.some((candidate) => candidate.key === key && candidate.id !== userId)) {
    throw new Error("That username is taken.");
  }

  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("User not found.");
  user.key = key;
  user.username = clean;
  saveDb(db);

  const player = activePlayers.get(userId);
  if (player) {
    player.key = key;
    player.name = clean;
  }
  return user;
}

function userFromToken(token) {
  const userId = sessions.get(token);
  if (!userId) return null;
  return loadDb().users.find((user) => user.id === userId) || null;
}

function requireUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = userFromToken(token);
  if (!user) throw new Error("Please log in again.");
  return user;
}

function startSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user.id);
  return { token, user: safeUser(user) };
}

function playerForUser(user) {
  let player = activePlayers.get(user.id);
  if (!player) {
    player = {
      id: user.id,
      userId: user.id,
      key: user.key,
      name: user.username,
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      games: user.games,
      gameId: null
    };
    activePlayers.set(user.id, player);
  } else {
    player.name = user.username;
    player.elo = user.elo;
    player.wins = user.wins;
    player.losses = user.losses;
    player.games = user.games;
  }
  return player;
}

function publicPlayer(player) {
  return { id: player.id, name: player.name, elo: player.elo, wins: player.wins, losses: player.losses, bot: Boolean(player.bot) };
}

function expectedScore(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

function hintPolicy(mode) {
  if (mode === "hard") return { max: 2, free: 0, costs: [22, 34], speedBonusCap: 18, hintWinPenalty: 8 };
  if (mode === "medium") return { max: 4, free: 1, costs: [0, 8, 12, 18], speedBonusCap: 14, hintWinPenalty: 6 };
  return { max: 5, free: 2, costs: [0, 0, 6, 10, 14], speedBonusCap: 10, hintWinPenalty: 4 };
}

function hintCost(mode, index) {
  return hintPolicy(mode).costs[index] ?? 0;
}

function applyMatchElo(game, winner, loser) {
  const winnerHints = game.hintsByPlayer[winner.id]?.length || 0;
  const loserHints = game.hintsByPlayer[loser.id]?.length || 0;
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - game.startedAt) / 1000));
  const base = Math.round(32 * (1 - expectedScore(winner.elo, loser.elo)));
  const policy = hintPolicy(game.mode);
  const timeLimitSeconds = game.mode === "hard" ? 90 : game.mode === "medium" ? 150 : 180;
  const speedRatio = Math.max(0, 1 - elapsedSeconds / timeLimitSeconds);
  const speedBonus = Math.round(policy.speedBonusCap * speedRatio);
  const hintPenalty = winnerHints * policy.hintWinPenalty;
  const loserHintCushion = Math.min(6, loserHints * 2);
  const winnerDelta = Math.max(4, base + speedBonus - hintPenalty);
  const loserDelta = Math.max(4, base - loserHintCushion);

  winner.elo += winnerDelta;
  loser.elo = Math.max(100, loser.elo - loserDelta);
  winner.wins++;
  loser.losses++;
  winner.games++;
  loser.games++;
  if (!winner.bot) saveUserStats(winner);
  if (!loser.bot) saveUserStats(loser);

  const db = loadDb();
  db.matches.push({
    id: game.id,
    mode: game.mode,
    challengeId: game.challenge.id,
    winnerId: winner.userId,
    loserId: loser.userId,
    winnerDelta,
    loserDelta: -loserDelta,
    elapsedSeconds,
    winnerHints,
    loserHints,
    completedAt: Date.now()
  });
  saveDb(db);

  return { winnerDelta, loserDelta: -loserDelta, speedBonus, hintPenalty, elapsedSeconds, winnerHints, loserHints };
}

function pickChallenge(mode) {
  const pool = challenges.filter((challenge) => challenge.mode === mode);
  return pool[Math.floor(Math.random() * pool.length)];
}

function createGame(mode, playerA, playerB) {
  const challenge = pickChallenge(mode);
  const game = {
    id: crypto.randomUUID(),
    mode,
    status: "active",
    opponentType: playerA.bot || playerB.bot ? "bot" : "friend",
    challenge,
    players: [playerA, playerB],
    startedAt: Date.now(),
    endsAt: mode === "hard" ? Date.now() + 90_000 : null,
    winnerId: null,
    scoring: null,
    hintsByPlayer: { [playerA.id]: [], [playerB.id]: [] },
    submissions: [],
    chats: [],
    lastMessage: "Duel started."
  };
  games.set(game.id, game);
  playerA.gameId = game.id;
  playerB.gameId = game.id;
  broadcastGame(game);
  if (game.endsAt) setTimeout(() => expireGame(game.id), 91_000);
  if (playerA.bot || playerB.bot) scheduleBotMove(game);
  return game;
}

function gamePayload(game, viewerId) {
  const scoreDelta = game.scoring
    ? viewerId === game.winnerId
      ? game.scoring.winnerDelta
      : game.scoring.loserDelta
    : null;
  const viewerSubmission = [...game.submissions].reverse().find((submission) => submission.playerId === viewerId);
  return {
    id: game.id,
    mode: game.mode,
    opponentType: game.opponentType,
    status: game.status,
    startedAt: game.startedAt,
    endsAt: game.endsAt,
    serverNow: Date.now(),
    winnerId: game.winnerId,
    winnerName: game.players.find((player) => player.id === game.winnerId)?.name || null,
    scoring: game.scoring,
    scoreDelta,
    viewerId,
    players: game.players.map(publicPlayer),
    hintPolicy: hintPolicy(game.mode),
    hints: (game.hintsByPlayer[viewerId] || []).map((hintIndex) => ({
      index: hintIndex,
      text: game.challenge.hints[hintIndex],
      cost: hintCost(game.mode, hintIndex)
    })),
    challenge: {
      id: game.challenge.id,
      title: game.challenge.title,
      prompt: game.challenge.prompt,
      brokenCode: game.challenge.brokenCode,
      tests: game.challenge.tests.map((test) => ({ input: test.input, expected: test.expected }))
    },
    submissions: game.submissions.slice(-8),
    review: game.status !== "active" ? {
      title: game.challenge.title,
      concept: reviewTip(game.challenge.id),
      yourCode: viewerSubmission?.code || "",
      solution: game.challenge.solution,
      hiddenTests: (game.challenge.hiddenTests || []).length
    } : null,
    chats: game.chats || [],
    lastMessage: game.lastMessage
  };
}

function reviewTip(challengeId) {
  const tips = {
    "sum-array": "This is an off-by-one loop bug. Array indexes stop at length - 1, so i < nums.length avoids adding undefined.",
    unique: "This is a filtering/state bug. Keep a seen list and return false when an item was already encountered.",
    "reverse-text": "This checks method chaining. reverse must be called as reverse(), and arrays need join(\"\") to become strings again.",
    "max-number": "This is about initialization. Starting from nums[0] handles negative arrays better than starting from zero.",
    "middle-value": "This combines numeric sorting and indexing. JavaScript's default sort is string-based, so use a compare function.",
    "count-vowels": "This is a counter bug. Normalize case first, then increment when the character is a vowel.",
    "first-non-repeat": "This uses a frequency map. Count every character first, then scan again to find the first count of one.",
    "chunk-sum": "This is an iteration-step bug. Move through the array in jumps of two and handle a missing pair value with zero.",
    balanced: "This is a stack problem. Push opening brackets, then every closing bracket must match the most recent opening bracket.",
    "longest-run": "This is a state tracking problem. Track the current run length and reset it when the increasing sequence breaks.",
    "merge-intervals": "This is an interval merging pattern. Sort by start time, then extend the previous interval when ranges overlap.",
    "binary-search": "This is binary search boundary management. left and right must move inward without skipping valid indexes."
  };
  return tips[challengeId] || "Review the bug, compare your final code to the solution, and look for the smallest logic change that fixed it.";
}

function sendEvent(playerId, type, payload) {
  const response = clients.get(playerId);
  if (!response) return;
  response.write(`event: ${type}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastGame(game) {
  for (const player of game.players) {
    sendEvent(player.id, "game", gamePayload(game, player.id));
  }
}

function expireGame(gameId) {
  const game = games.get(gameId);
  if (!game || game.status !== "active" || !game.endsAt || Date.now() < game.endsAt) return;
  game.status = "expired";
  game.lastMessage = "Time expired. No Elo changed.";
  for (const player of game.players) {
    if (!player.bot) player.gameId = null;
  }
  broadcastGame(game);
}

function validMode(mode) {
  return ["easy", "medium", "hard"].includes(mode);
}

function joinQueue(mode, player) {
  if (!validMode(mode)) throw new Error("Unknown mode.");
  if (player.gameId) return games.get(player.gameId);

  const now = Date.now();
  for (const key of Object.keys(queue)) {
    queue[key] = queue[key].filter((queued) => queued.id !== player.id && !queued.gameId && now - (queued.queuedAt || 0) < 120_000);
  }

  const opponent = queue[mode].find((queued) => queued.id !== player.id);
  if (!opponent) {
    player.queuedAt = now;
    queue[mode].push(player);
    sendEvent(player.id, "queue", { mode, message: `Waiting for a ${mode} opponent...` });
    return null;
  }

  queue[mode] = queue[mode].filter((queued) => queued.id !== opponent.id);
  return createGame(mode, opponent, player);
}

function createBotPlayer(mode) {
  const label = mode === "hard" ? "NPC Compiler" : mode === "medium" ? "NPC Debugger" : "NPC Trainee";
  return {
    id: `bot-${crypto.randomUUID()}`,
    userId: "bot",
    key: "bot",
    name: label,
    elo: mode === "hard" ? 1060 : mode === "medium" ? 1015 : 960,
    wins: 0,
    losses: 0,
    games: 0,
    gameId: null,
    bot: true
  };
}

function createBotGame(mode, player) {
  if (!validMode(mode)) throw new Error("Unknown mode.");
  if (player.gameId) return games.get(player.gameId);
  queue.easy = queue.easy.filter((queued) => queued.id !== player.id);
  queue.medium = queue.medium.filter((queued) => queued.id !== player.id);
  queue.hard = queue.hard.filter((queued) => queued.id !== player.id);
  return createGame(mode, player, createBotPlayer(mode));
}

function scheduleBotMove(game) {
  const bot = game.players.find((player) => player.bot);
  if (!bot) return;
  const delay = (game.mode === "hard" ? 25_000 : game.mode === "medium" ? 34_000 : 45_000) + Math.floor(Math.random() * 14_000);
  setTimeout(() => {
    const current = games.get(game.id);
    if (!current || current.status !== "active") return;
    try {
      submit(bot.id, current.id, current.challenge.solution);
    } catch {
      // The bot only acts if the duel is still available.
    }
  }, delay);
}

function currentGameForPlayer(player) {
  if (!player.gameId) return null;
  return games.get(player.gameId) || null;
}

function stableJson(value) {
  return JSON.stringify(value);
}

function runCode(code, challenge) {
  const tests = [...challenge.tests, ...(challenge.hiddenTests || [])];
  if (String(code).length > 10_000) return { passed: false, message: "Code is too large.", results: [] };
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  const wrapped = `"use strict";\n${code}\n;solve`;
  let solve;
  try {
    solve = vm.runInContext(wrapped, context, { timeout: 400, displayErrors: false });
  } catch (error) {
    return { passed: false, message: `Compile error: ${error.message}`, results: [] };
  }
  if (typeof solve !== "function") return { passed: false, message: "Define a function named solve.", results: [] };

  const results = [];
  for (const [index, test] of tests.entries()) {
    try {
      context.__solve__ = solve;
      context.__input__ = JSON.parse(JSON.stringify(test.input));
      const actual = vm.runInContext("__solve__(...__input__)", context, { timeout: 250, displayErrors: false });
      const passed = stableJson(actual) === stableJson(test.expected);
      results.push({
        index: index + 1,
        hidden: index >= challenge.tests.length,
        passed,
        actual: index >= challenge.tests.length ? "(hidden)" : actual,
        expected: index >= challenge.tests.length ? "(hidden)" : test.expected
      });
      if (!passed) return { passed: false, message: "A test failed.", results };
    } catch (error) {
      results.push({ index: index + 1, hidden: index >= challenge.tests.length, passed: false, error: error.message });
      return { passed: false, message: `Runtime error: ${error.message}`, results };
    } finally {
      delete context.__solve__;
      delete context.__input__;
    }
  }
  return { passed: true, message: "All tests passed.", results };
}

function requestHint(playerId, gameId) {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found.");
  if (game.status !== "active") throw new Error("This duel is already finished.");
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("You are not in this game.");

  const used = game.hintsByPlayer[playerId] || [];
  const policy = hintPolicy(game.mode);
  if (used.length >= policy.max) throw new Error("No hints left for this mode.");

  const nextIndex = used.length;
  const cost = hintCost(game.mode, nextIndex);
  if (cost > 0) {
    player.elo = Math.max(100, player.elo - cost);
    saveUserStats(player);
  }
  used.push(nextIndex);
  game.hintsByPlayer[playerId] = used;
  game.lastMessage = cost > 0 ? `${player.name} bought hint ${nextIndex + 1} for ${cost} Elo.` : `${player.name} used a free hint.`;
  broadcastGame(game);
  return gamePayload(game, playerId);
}

function submit(playerId, gameId, code) {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found.");
  if (game.status !== "active") throw new Error("This duel is already finished.");
  if (!game.players.some((player) => player.id === playerId)) throw new Error("You are not in this game.");
  if (game.endsAt && Date.now() > game.endsAt) {
    expireGame(game.id);
    throw new Error("Timer expired.");
  }

  const player = game.players.find((candidate) => candidate.id === playerId);
  const result = runCode(code, game.challenge);
  game.submissions.push({
    playerId,
    playerName: player.name,
    passed: result.passed,
    message: result.message,
    code: String(code),
    at: Date.now(),
    results: result.results
  });
  game.lastMessage = result.passed ? `${player.name} fixed it first.` : `${player.name}: ${result.message}`;

  if (result.passed) {
    const loser = game.players.find((candidate) => candidate.id !== playerId);
    game.scoring = applyMatchElo(game, player, loser);
    game.status = "complete";
    game.winnerId = playerId;
    player.gameId = null;
    loser.gameId = null;
  }
  broadcastGame(game);
  return { result, game: gamePayload(game, playerId) };
}

function leaderboard() {
  return loadDb()
    .users.map(({ username, elo, wins, losses, games }) => ({ name: username, elo, wins, losses, games }))
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins || a.name.localeCompare(b.name))
    .slice(0, 20);
}

function profileForUser(userId) {
  const db = loadDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("User not found.");

  const matches = db.matches
    .filter((match) => match.winnerId === userId || match.loserId === userId)
    .sort((a, b) => b.completedAt - a.completedAt);
  const wins = matches.filter((match) => match.winnerId === userId).length;
  const losses = matches.filter((match) => match.loserId === userId).length;
  const totalHints = matches.reduce((sum, match) => {
    if (match.winnerId === userId) return sum + (match.winnerHints || 0);
    return sum + (match.loserHints || 0);
  }, 0);
  const avgSeconds = matches.length
    ? Math.round(matches.reduce((sum, match) => sum + (match.elapsedSeconds || 0), 0) / matches.length)
    : 0;
  const modeCounts = matches.reduce((counts, match) => {
    counts[match.mode] = (counts[match.mode] || 0) + 1;
    return counts;
  }, {});
  const favoriteMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
  const bestDelta = matches.reduce((best, match) => {
    const delta = match.winnerId === userId ? match.winnerDelta : match.loserDelta;
    return Math.max(best, delta || 0);
  }, 0);

  return {
    user: safeUser(user),
    stats: {
      wins,
      losses,
      games: matches.length,
      winRate: matches.length ? Math.round((wins / matches.length) * 100) : 0,
      totalHints,
      avgSeconds,
      favoriteMode,
      bestDelta
    },
    recentMatches: matches.slice(0, 8).map((match) => ({
      id: match.id,
      mode: match.mode,
      result: match.winnerId === userId ? "Win" : "Loss",
      eloDelta: match.winnerId === userId ? match.winnerDelta : match.loserDelta,
      elapsedSeconds: match.elapsedSeconds,
      hintsUsed: match.winnerId === userId ? match.winnerHints : match.loserHints,
      completedAt: match.completedAt
    }))
  };
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const unsafePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, unsafePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
    response.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    response.end(data);
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      return sendJson(response, 200, leaderboard());
    }
    if (request.method === "POST" && url.pathname === "/api/signup") {
      const body = await parseBody(request);
      return sendJson(response, 200, startSession(createUser(body.username, body.password)));
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      const body = await parseBody(request);
      return sendJson(response, 200, startSession(verifyUser(body.username, body.password)));
    }
    if (request.method === "GET" && url.pathname === "/api/me") {
      const user = requireUser(request);
      return sendJson(response, 200, { user: safeUser(user) });
    }

    const user = requireUser(request);
    const player = playerForUser(user);

    if (request.method === "GET" && url.pathname === "/api/profile") {
      return sendJson(response, 200, profileForUser(user.id));
    }
    if (request.method === "POST" && url.pathname === "/api/profile/username") {
      const body = await parseBody(request);
      const updated = updateUsername(user.id, body.username);
      return sendJson(response, 200, profileForUser(updated.id));
    }

    if (request.method === "POST" && url.pathname === "/api/join") {
      const body = await parseBody(request);
      const game = joinQueue(body.mode, player);
      return sendJson(response, 200, { player: publicPlayer(player), game: game ? gamePayload(game, player.id) : null });
    }
    if (request.method === "POST" && url.pathname === "/api/bot") {
      const body = await parseBody(request);
      const game = createBotGame(body.mode, player);
      return sendJson(response, 200, { player: publicPlayer(player), game: gamePayload(game, player.id) });
    }
    if (request.method === "GET" && url.pathname === "/api/current-game") {
      const game = currentGameForPlayer(player);
      return sendJson(response, 200, { player: publicPlayer(player), game: game ? gamePayload(game, player.id) : null });
    }
    if (request.method === "POST" && url.pathname === "/api/submit") {
      const body = await parseBody(request);
      return sendJson(response, 200, submit(player.id, body.gameId, body.code));
    }
    if (request.method === "POST" && url.pathname === "/api/hint") {
      const body = await parseBody(request);
      return sendJson(response, 200, { game: requestHint(player.id, body.gameId) });
    }
    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await parseBody(request);
      const game = games.get(body.gameId);
      if (!game) throw new Error("No active game.");
      if (!game.players.some(p => p.id === player.id)) throw new Error("Not in this game.");

      const message = String(body.message || "").trim().slice(0, 200);
      if (!message) throw new Error("Message cannot be empty.");
      game.chats = game.chats || [];
      const entry = { playerId: player.id, playerName: player.name, message, at: Date.now() };
      game.chats.push(entry);
      broadcastGame(game);
      return sendJson(response, 200, { ok: true });
    }
    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

function handleEvents(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get("token");
  const user = userFromToken(token);
  if (!user) {
    response.writeHead(401);
    response.end("Unauthorized");
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.write(": connected\n\n");
  clients.set(user.id, response);
  request.on("close", () => clients.delete(user.id));
}

ensureData();
const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) return handleApi(request, response);
  if (request.url.startsWith("/events")) return handleEvents(request, response);
  return serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Code Duels running at http://localhost:${PORT}`);
});
