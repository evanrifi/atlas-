# ✦ ATLAS ULTIMATE — Temp Voice Bot

A clean, powerful temporary voice channel bot for Discord.

---

## Setup in 5 steps

### 1. Install dependencies
```bash
npm install
```

### 2. Create your .env file
```bash
cp .env.example .env
```
Fill in your values (see `.env.example` for every key):

| Variable | Where to find it |
|---|---|
| `DISCORD_TOKEN` | discord.com/developers → Your App → Bot → Token |
| `CLIENT_ID` | discord.com/developers → Your App → General → Application ID |
| `GUILD_ID` | Right-click your server icon → Copy Server ID |
| `JOIN_TO_CREATE_ID` | Right-click the voice channel → Copy Channel ID |

Optional extras in `.env.example`: extra **join-to-create** hubs (`JTC_GAMING`, `JTC_STUDY`, etc.), **XP** level-up channel and milestone roles, **mod log** for warnings, and a **banner GIF** for the temp-channel panel.

> Enable Developer Mode in Discord: Settings → Advanced → Developer Mode

### 3. Invite the bot to your server
Go to discord.com/developers → Your App → OAuth2 → URL Generator
- Scopes: `bot`, `applications.commands`
- Permissions: `Manage Channels`, `Move Members`, `Mute Members`, `Connect`, `View Channels`

### 4. Register slash commands
```bash
npm run deploy
```

### 5. Start the bot
```bash
npm start
```

---

## Commands

**Temp channels** are controlled from **buttons** on the panel message in your channel (rename, limit, lock, unlock, kick, transfer, info).

| Command | Description |
|---|---|
| `/rank` | Your XP rank (optional: another member) |
| `/leaderboard` | Top 10 members by XP |
| `/setxp` | Set a member’s XP (Administrator) |
| `/resetxp` | Reset a member’s XP (Administrator) |
| `/warn` | Warn a member (Manage Messages) |
| `/warns` | List warnings for a member |
| `/clearwarns` | Clear warnings for a member |
| `/addword` | Add a banned word for this server |
| `/removeword` | Remove a banned word |
| `/wordlist` | Show banned words |

---

## How it works

1. Create one or more **join-to-create** voice channels (any name you like).
2. Copy each channel ID into `.env` (`JOIN_TO_CREATE_ID` is required; optional `JTC_*` IDs add themed room types).
3. When a user joins a hub, ATLAS ULTIMATE creates a **temporary** voice channel, moves them in, and posts a **control panel** with buttons.
4. When the last user leaves, the temp channel is deleted.

**Note:** Temp-channel ownership is kept in memory while the bot runs. After a **restart**, existing temp channels may still exist in Discord but won’t be manageable until recreated (or you extend the bot to persist state).

---

## Free hosting (24/7)
- **Railway** → railway.app (easiest, free tier)
- **Render** → render.com (free tier, sleeps after inactivity — use a keep-alive ping)
- **Replit** → replit.com (free, use UptimeRobot to keep it alive)
