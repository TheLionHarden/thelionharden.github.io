# Code Duels

A fullstack 1v1 competitive coding scavenger hunt. Two players join the same mode, race to repair a broken JavaScript function, and the first player whose code passes the tests wins Elo.

## Features

- Real-time 1v1 friend matchmaking
- NPC/bot duels for solo play
- Easy, Medium, and Hard modes
- Multiple LeetCode-style debugging prompts per difficulty
- Hard mode 90-second timer
- Easy mode has 5 hints, with the first 2 free
- Medium mode has 4 hints, with the first 1 free
- Hard mode has 2 paid hints with higher Elo costs
- User sign up and login with salted PBKDF2 password hashes
- Local file-backed JSON database for users, stats, and match history
- Server-sent events for live match updates
- Sandboxed JavaScript validation with execution timeouts
- Visible and hidden test cases
- Persistent Elo leaderboard with speed and hint-adjusted scoring
- Simple match results: win/loss Elo delta plus a next-match flow

## Run locally

```bash
npm start
```

Then open http://localhost:3000.

Use two browser windows or two devices pointed at the same server to play a friend duel. If another device is joining, use the host computer's local network URL (open command prompt, tpye "ipconfig", and locate your IPv4 address), for example `http://192.168.x.x:3000`, not that device's own `localhost`.

The local database is stored in `data/code-duels-db.json`.
