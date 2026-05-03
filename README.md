# ✦ ATLAS ULTIMATE

**ATLAS ULTIMATE** is a premium, feature-rich Discord bot designed for modern communities. It acts as an all-in-one ecosystem providing elite server security, dynamic temporary voice channels, high-quality music streaming, comprehensive auto-moderation, and a rich economy/XP system.

Built on **Discord.js v14** and **MongoDB**, it features a dedicated **Express API server** to power an external dashboard and a secure OAuth2 web-verification gateway.

---

## ✨ Core Features

### 🛡️ Elite Security & Auto-Moderation
- **Anti-Nuke & Anti-Raid Engine:** Automatically detects mass-joins, channel deletions, and mass bans. Engages server lock-down and neutralizes rogue admins instantly.
- **OAuth2 Captcha Verification:** Forces new users to verify via a web dashboard before entering. Checks account age (> 30 days) and linked social connections to obliterate bot raids.
- **Advanced Alt-Tracking:** Logs IP hashes and browser fingerprints during web verification. Moderators can use `/alt-check` and `/alt-blacklist` to trace and block entire networks of evading users.
- **Phishing Protection (VirusTotal):** Automatically scans posted URLs against VirusTotal databases to delete malicious links.
- **Automod Lexicon:** Regex-based banned word filtering, anti-spam, anti-caps, and anti-ghost ping protection. Includes a 3-strike warning system leading to automated timeouts.

### 🎵 High-Quality Music Suite
- Powered by **Lavalink** and **Shoukaku**.
- 24/7 high-fidelity audio playback.
- **Commands:** `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, and `/stop`.
- Robust queue management with seamless track transition and auto-disconnect.

### 🔷 Dynamic Voice Hubs (Join-To-Create)
- Create themed voice hubs (Gaming, Study, Chill, Music).
- When a user joins, a temporary channel is created uniquely for them.
- **Control Panel UI:** Owners get a beautiful embedded UI with buttons to rename, set user limits, lock/unlock, kick, and transfer ownership of their voice channel.
- Channels auto-delete when empty.

### 💎 Economy & Leveling (XP)
- **Chat XP:** Earn randomized XP for chatting (with cooldowns to prevent spamming).
- **Level-up Rewards:** Visually stunning level-up cards and automatic milestone role assignments.
- **Economy & Shop:** Earn "Atlas Coins" by being active. Users can check their `/economy balance` and purchase perks like VIP roles and Custom Colors from the `/economy shop`.

### 🎫 Smart Tickets & Secret Chats
- **Ticket System:** Dropdown-based support panel for users. Creates private channels for Support, Billing, or Reports.
- **Transcripts:** Automatically generates beautiful HTML transcripts when a ticket is closed.
- **Secret Chats:** Create self-destructing, private text channels between two users using `/secret-chat`.

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js:** v20+ (v22+ recommended)
- **MongoDB:** A running MongoDB instance (local or MongoDB Atlas).
- **Lavalink:** A running Lavalink node for the music features.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file based on `.env.example`. Key variables include:
- `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`
- `MONGO_URI` (e.g., `mongodb://localhost:27017/atlas-unit`)
- `OAUTH2_CLIENT_SECRET` & `OAUTH2_REDIRECT_URI` (for the web verification and dashboard)
- `VT_API_KEY` (VirusTotal API key for phishing protection)
- `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`

### 4. Register Slash Commands
Run the deployment script to push all slash commands to your server:
```bash
npm run deploy
```

### 5. Start the Bot
```bash
npm start
```

---

## 🌐 Web Dashboard & Verification
The bot runs an Express API server concurrently on `EXPRESS_PORT` (default 3000). 
- **Verification Portal:** `http://localhost:3000/verify/login` — Requires users to accept Discord OAuth2. Validates connections, age, and tracks fingerprints to stop alt accounts.
- **Admin Dashboard:** `http://localhost:3000/dashboard` — An administrative control panel that directly syncs with the bot's live security configuration (toggling Anti-Nuke, Automod, etc).

---

## 🛠️ Commands Overview

*(Commands marked as Admin/Mod are strictly restricted via Discord permissions.)*

**General:**
- `/help`, `/rank`, `/leaderboard`, `/serverinfo`, `/userinfo`

**Music:**
- `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/stop`

**Economy:**
- `/economy balance`, `/economy shop`, `/economy buy`, `/economy addmoney [Admin]`

**Security & Alts (Admin):**
- `/security status`, `/security toggle`, `/security setquarantine`
- `/security setup-verification`, `/security setup-ticket`
- `/alt-check`, `/alt-blacklist`

**Moderation (Mods):**
- `/warn`, `/warns`, `/clearwarns`, `/addword`, `/removeword`, `/wordlist`
- `/kick`, `/ban`, `/unban`, `/mute`, `/unmute`, `/clear`, `/slowmode`, `/lock`, `/unlock`, `/nick`

**Admin Utilities:**
- `/roles post`, `/roles reload` (Reaction/Dropdown Role Panels)
- `/setxp`, `/resetxp`, `/welcome preview`

---
*Developed with modern architecture to provide the Ultimate server experience.*
