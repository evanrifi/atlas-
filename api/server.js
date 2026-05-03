const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const OAuthUser = require('../models/OAuthUser');
const GuildConfig = require('../models/GuildConfig');
const AltTracker = require('../models/AltTracker');


module.exports = (client) => {
  const app = express();
  const PORT = process.env.EXPRESS_PORT || 3000;

  app.use(express.json());
  app.use(session({
    secret: process.env.OAUTH2_CLIENT_SECRET || 'atlas-secret',
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.CLIENT_ID && process.env.OAUTH2_CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      callbackURL: `http://localhost:${PORT}/dashboard/callback`,
      scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
  }

  // ── DASHBOARD ROUTES ──
  app.get('/dashboard/login', passport.authenticate('discord'));

  app.get('/dashboard/callback', passport.authenticate('discord', {
    failureRedirect: '/'
  }), (req, res) => {
    res.redirect('/dashboard');
  });

  app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('<a href="/dashboard/login">Login with Discord</a>');
    
    const targetGuildId = process.env.GUILD_ID;
    const guild = req.user.guilds.find(g => g.id === targetGuildId);
    
    if (!guild || (guild.permissions & 0x8) !== 0x8) {
      return res.status(403).send('<h2 style="color:red; font-family:sans-serif;">Access Denied: You must be an Administrator in the bot\'s primary server.</h2>');
    }

    let antiNuke = true;
    let automod = true;
    let antiLink = false;

    const { loadSecurityConfig } = require('../security');
    const secConfig = loadSecurityConfig(targetGuildId);
    antiNuke = secConfig.antiNuke;
    antiLink = secConfig.antiLink;

    if (mongoose.connection.readyState === 1) {
       const config = await GuildConfig.findOne({ guildId: targetGuildId });
       if (config) {
          automod = config.modules.automod;
       }
    }

    res.send(`
      <h1 style="font-family:sans-serif; color: #1dc9d8;">ATLAS ULTIMATE Dashboard</h1>
      <p style="font-family:sans-serif;">Welcome, <strong>${req.user.username}</strong>!</p>
      <h3 style="font-family:sans-serif;">Server Modules Configuration</h3>
      <form id="configForm" style="display:flex; flex-direction:column; max-width:300px; gap:15px; font-family:sans-serif;">
         <label><input type="checkbox" id="antiNuke" ${antiNuke ? 'checked' : ''}> Enable Anti-Nuke</label>
         <label><input type="checkbox" id="automod" ${automod ? 'checked' : ''}> Enable Automod (Lexicon)</label>
         <label><input type="checkbox" id="antiLink" ${antiLink ? 'checked' : ''}> Enable Anti-Link Protection</label>
         <button type="button" onclick="saveConfig()" style="background:#1dc9d8; border:none; padding:10px; color:white; cursor:pointer; font-weight:bold;">Save Configuration</button>
      </form>
      <script>
        function saveConfig() {
          const payload = {
            antiNuke: document.getElementById('antiNuke').checked,
            automod: document.getElementById('automod').checked,
            antiLink: document.getElementById('antiLink').checked
          };
          fetch('/api/config/${targetGuildId}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(r => r.json()).then(d => alert(d.success ? "Configuration Saved!" : "Error Saving Configuration"));
        }
      </script>
    `);
  });

  app.post('/api/config/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    const guild = req.user.guilds.find(g => g.id === req.params.guildId);
    if (!guild || (guild.permissions & 0x8) !== 0x8) return res.status(403).json({ error: 'Forbidden' });

    const { antiNuke, automod, antiLink } = req.body;
    
    const { loadSecurityConfig, saveSecurityConfig } = require('../security');
    const secConfig = loadSecurityConfig(req.params.guildId);
    secConfig.antiNuke = antiNuke;
    secConfig.antiLink = antiLink;
    saveSecurityConfig(req.params.guildId, secConfig);

    if (mongoose.connection.readyState === 1) {
       await GuildConfig.findOneAndUpdate(
         { guildId: req.params.guildId },
         { $set: { 'modules.antiNuke': antiNuke, 'modules.automod': automod, 'modules.antiLink': antiLink } },
         { upsert: true }
       );
    }
    
    res.json({ success: true });
  });

  app.get('/verify/login', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
         <title>ATLAS Security Verification</title>
         <style>body { background:#0a0a0a; color:#1dc9d8; font-family:sans-serif; text-align:center; padding-top:100px; }</style>
      </head>
      <body>
         <h1>Checking secure connection...</h1>
         <p>Please wait while we verify your browser to prevent bot raids.</p>
         <canvas id="fpCanvas" width="200" height="50" style="display:none;"></canvas>
         <script>
            setTimeout(() => {
              const canvas = document.getElementById('fpCanvas');
              const ctx = canvas.getContext('2d');
              ctx.textBaseline = "top";
              ctx.font = "14px 'Arial'";
              ctx.textBaseline = "alphabetic";
              ctx.fillStyle = "#f60";
              ctx.fillRect(125,1,62,20);
              ctx.fillStyle = "#069";
              ctx.fillText("Atlas Fingerprint", 2, 15);
              ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
              ctx.fillText("Atlas Fingerprint", 4, 17);
              
              const fingerprint = canvas.toDataURL();
              
              fetch('/verify/fingerprint', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ fingerprint })
              }).then(r => r.json()).then(data => {
                 if (data.success && data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                 } else {
                    document.body.innerHTML = "<h1 style='color:red;'>Access Denied. Suspicious Network / Ban Evasion Detected.</h1>";
                 }
              });
            }, 1000);
         </script>
      </body>
      </html>
    `);
  });

  app.post('/verify/fingerprint', async (req, res) => {
    const { fingerprint } = req.body;
    if (!fingerprint) return res.status(400).json({ success: false });

    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const fpHash = crypto.createHash('md5').update(fingerprint).digest('hex');

    if (mongoose.connection.readyState === 1) {
       const isBanned = await AltTracker.findOne({ 
         $or: [ { ipHash }, { fingerprint: fpHash } ], 
         banned: true 
       });

       if (isBanned) {
         return res.json({ success: false, error: 'Network Blacklisted.' });
       }
       
       req.session.ipHash = ipHash;
       req.session.fingerprint = fpHash;
    }

    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.OAUTH2_REDIRECT_URI);
    const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20connections`;
    
    res.json({ success: true, redirectUrl });
  });

  app.get('/verify/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.OAUTH2_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.OAUTH2_REDIRECT_URI
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const token = tokenResponse.data.access_token;

      const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } });
      const connectionsRes = await axios.get('https://discord.com/api/users/@me/connections', { headers: { Authorization: `Bearer ${token}` } });

      const user = userRes.data;
      const connections = connectionsRes.data;

      if (connections.length === 0) {
        return res.status(403).send('<h2 style="color:red; font-family:sans-serif;">Verification Failed: No linked social accounts found (Steam, Twitter, etc).</h2>');
      }

      const snowflake = user.id;
      const createdAt = new Date(parseInt(snowflake) / 4194304 + 1420070400000);
      if (Date.now() - createdAt.getTime() < 30 * 24 * 60 * 60 * 1000) {
        return res.status(403).send('<h2 style="color:red; font-family:sans-serif;">Verification Failed: Account must be at least 30 days old.</h2>');
      }

      if (mongoose.connection.readyState === 1) {
         await OAuthUser.findOneAndUpdate(
           { userId: user.id },
           { verifiedAt: new Date(), connections: connections.map(c => c.type) },
           { upsert: true }
         );

         if (req.session.ipHash && req.session.fingerprint) {
            await AltTracker.findOneAndUpdate(
              { userId: user.id },
              { ipHash: req.session.ipHash, fingerprint: req.session.fingerprint },
              { upsert: true }
            );
         }
      }

      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      if (guild) {
         const member = await guild.members.fetch(user.id).catch(() => null);
         const roleId = process.env.AUTO_ROLE_ID;
         if (member && roleId) {
            await member.roles.add(roleId).catch(()=>{});
         }
      }

      res.send('<h1 style="color:green; text-align:center; font-family:sans-serif;">Account Verified! You may close this tab and return to Discord.</h1>');
    } catch (err) {
      console.error('OAuth Error:', err.response?.data || err.message);
      res.status(500).send('<h2 style="color:red;">An error occurred during verification. Please check the bot console.</h2>');
    }
  });

  app.listen(PORT, () => {
    console.log(`✦ Express Verification API Server running on port ${PORT}`);
  });
};
