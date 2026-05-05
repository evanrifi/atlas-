const {
  Client, GatewayIntentBits, PermissionFlagsBits, Events, ActivityType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, AuditLogEvent,
  StringSelectMenuBuilder
} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const yts = require('yt-search');
const mongoose = require('mongoose');
const discordTranscripts = require('discord-html-transcripts');
const Ticket = require('./models/Ticket');
const SecretChannel = require('./models/SecretChannel');
const Economy = require('./models/Economy');
const PhishingCache = require('./models/PhishingCache');
const AltTracker = require('./models/AltTracker');
const axios = require('axios');

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✦ MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}
require('dotenv').config();

const {
  loadDB, saveDB, getUser,
  getLevelFromXP, assignRoles,
  levelUpEmbed, rankEmbed, leaderboardEmbed,
} = require('./xp');

const {
  loadWarns, saveWarns, getWarns,
  loadBannedWords, saveBannedWords,
  checkSpam, warnEmbed, logEmbed,
  manualWarnEmbed, clearWarnsEmbed, warnsListEmbed,
} = require('./automod');

const {
  loadSecurityConfig, saveSecurityConfig,
  checkAntiRaid, checkAntiNuke, checkSecurityText, securityStatusEmbed
} = require('./security');

const { buildWelcomePayload } = require('./welcome');
const { hierarchyBlock, modLogEmbed, sendModLog, purgeMessages } = require('./moderation');
const { buildBoostEmbed, serverInfoEmbed, userInfoEmbed } = require('./premium');
const { loadRolePanels, reloadRolePanels, postRolePanels, handleRolePanelSelect } = require('./rolePanels');

loadRolePanels();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const tempChannels = new Map();
const musicQueues  = new Map();
const CYAN   = 0x1dc9d8;
const RED    = 0xe05a5a;
const SILVER = 0xa8c0cc;

const E = {
  rename:   { id: '1492523171373645905', name: 'au_rename'   },
  lock:     { id: '1492523136694878350', name: 'au_lock'     },
  unlock:   { id: '1492523245117640936', name: 'au_unlock'   },
  kick:     { id: '1492523028959985704', name: 'au_kick'     },
  transfer: { id: '1492523205309763585', name: 'au_transfer' },
  info:     { id: '1492522998371057825', name: 'au_info'     },
  limit:    { id: '1493352536206479482', name: 'au_limit'    },
};

function buildTypes() {
  return {
    [process.env.JTC_GAMING]:        { emoji: '🎮', label: 'Gaming Room', name: 'Gaming' },
    [process.env.JTC_STUDY]:         { emoji: '📚', label: 'Study Room',  name: 'Study'  },
    [process.env.JTC_MUSIC]:         { emoji: '🎵', label: 'Music Room',  name: 'Music'  },
    [process.env.JTC_CHILL]:         { emoji: '🌙', label: 'Chill Room',  name: 'Chill'  },
    [process.env.JOIN_TO_CREATE_ID]: { emoji: '🔷', label: 'Voice Room',  name: 'Room'   },
  };
}
function getChannelType(id) {
  const t = buildTypes();
  return t[id] || t[process.env.JOIN_TO_CREATE_ID];
}

function successEmbed(title, desc) {
  return new EmbedBuilder().setColor(CYAN).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'ATLAS ULTIMATE' });
}
function errorEmbed(title, desc) {
  return new EmbedBuilder().setColor(RED).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'ATLAS ULTIMATE' });
}
function infoEmbed(title, desc) {
  return new EmbedBuilder().setColor(SILVER).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'ATLAS ULTIMATE' });
}

function buildPanel(member, data) {
  const type = data.type || { emoji: '🔷', label: 'Voice Room' };
  const GIF  = process.env.BANNER_GIF_URL;
  const embed = new EmbedBuilder().setColor(CYAN)
    .setAuthor({ name: `◈  ATLAS ULTIMATE  ·  ${type.emoji} ${type.label}`, iconURL: client.user.displayAvatarURL() });
  if (GIF && GIF.startsWith('http')) {
    embed.setImage(GIF);
  } else {
    const status = data.status === 'locked' ? '🔒 Locked' : '🔓 Open';
    const limit  = data.limit  === 0        ? 'Unlimited' : `${data.limit} users`;
    embed.setTitle(`Welcome, ${member.displayName}`).setDescription('Use the buttons below to manage your channel.')
      .addFields(
        { name: 'Owner',  value: `${member}`, inline: true },
        { name: 'Status', value: status,      inline: true },
        { name: 'Limit',  value: limit,       inline: true },
      );
  }
  return embed;
}

function buildRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_rename').setEmoji(E.rename).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_limit').setEmoji(E.limit).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_lock').setEmoji(E.lock).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_unlock').setEmoji(E.unlock).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_kick').setEmoji(E.kick).setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_transfer').setEmoji(E.transfer).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_info').setEmoji(E.info).setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

async function refreshPanel(channel, member, data) {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const msg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (msg) await msg.edit({ embeds: [buildPanel(member, data)], components: buildRows() });
  } catch {}
}

async function issueWarn(member, reason, client, isAuto = true) {
  const db   = loadWarns();
  const user = getWarns(db, member.guild.id, member.id);
  user.warns.push({ reason, time: Date.now(), auto: isAuto });
  user.count = user.warns.length;
  saveWarns(db);
  const warnCount = user.count;
  const logCh     = member.guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
  try { await member.send({ embeds: [warnEmbed(member, reason, warnCount, client)] }); } catch {}
  if (logCh) {
    await logCh.send({ embeds: [logEmbed(member, reason, warnCount, warnCount >= 3 ? 'kick' : 'warn', client)] });
  }
  if (warnCount >= 3) {
    user.warns = [];
    user.count = 0;
    saveWarns(db);
    try { 
       await member.timeout(60 * 60 * 1000, `ATLAS ULTIMATE AutoMod: 3 warnings — ${reason}`); 
       await member.send(`⚠️ You have been **muted for 1 hour** due to reaching 3 strikes.`);
    } catch {}
  }
  return warnCount;
}

// ─── READY ───────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log(`✦ ATLAS ULTIMATE online as ${client.user.tag}`);
  client.user.setActivity('🎵 Atlas Unit', { type: ActivityType.Watching });

  // ── SECRET CHAT DAEMON ──
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const expired = await SecretChannel.find({ deleteAt: { $lt: new Date() } });
      for (const doc of expired) {
        const guild = client.guilds.cache.get(doc.guildId);
        if (guild) {
          const ch = guild.channels.cache.get(doc.channelId);
          if (ch) await ch.delete('Secret channel expired (Daemon)').catch(()=>{});
        }
        await SecretChannel.deleteOne({ _id: doc._id }).catch(()=>{});
      }
    } catch (e) {}
  }, 60000); // Check every minute
  
  // Initialize play-dl SoundCloud client
  play.getFreeClientID().then(cid => play.setToken({ soundcloud : { client_id : cid } })).catch(e => console.error('SC Token Error:', e));
  
  // Music logic uses native play-dl and @discordjs/voice
});

// ─── WELCOME & ANTI-RAID ───────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    if (process.env.GUILD_ID && member.guild.id !== process.env.GUILD_ID) return;
    
    // Anti-Raid Check
    const isRaid = await checkAntiRaid(member);
    if (isRaid) return; // Stop processing if kicked by anti-raid

    // Auto-role assignment is now handled by the Captcha verification panel

    const chId = process.env.WELCOME_CHANNEL_ID;
    if (!chId) return;
    const ch = member.guild.channels.cache.get(chId);
    if (!ch?.isTextBased()) return;
    const { embeds, files } = buildWelcomePayload(member, member.guild, client);
    await ch.send({ content: `${member.user}`, embeds, files: files.length ? files : undefined });
  } catch (err) {
    console.error('guildMemberAdd welcome:', err);
  }
});

// ─── ANTI-NUKE ────────────────────────────────────────────────────────
client.on('guildBanAdd', async (ban) => {
  try {
    if (process.env.GUILD_ID && ban.guild.id !== process.env.GUILD_ID) return;
    await checkAntiNuke(ban.guild, 'bans', client);
  } catch (err) {
    console.error('guildBanAdd anti-nuke:', err);
  }
});

client.on('channelDelete', async (channel) => {
  try {
    if (!channel.guild) return;
    if (process.env.GUILD_ID && channel.guild.id !== process.env.GUILD_ID) return;
    await checkAntiNuke(channel.guild, 'channels', client);
  } catch (err) {
    console.error('channelDelete anti-nuke:', err);
  }
});

// ─── ANTI-GHOST PING & ROLE NUKE ──────────────────────────────────
client.on('roleDelete', async (role) => {
  try {
    if (process.env.GUILD_ID && role.guild.id !== process.env.GUILD_ID) return;
    await checkAntiNuke(role.guild, 'roles', client);
  } catch (err) {
    console.error('roleDelete anti-nuke:', err);
  }
});

client.on('messageDelete', async (message) => {
  try {
    if (!message.guild || message.author?.bot) return;
    const config = loadSecurityConfig(message.guild.id);
    if (!config.antiGhostPing) return;
    
    if (message.mentions.users.size > 0 || message.mentions.roles.size > 0) {
      if (Date.now() - message.createdTimestamp > 60 * 60 * 1000) return; // ignore old
      
      const logCh = message.guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
      if (logCh) {
        const embed = new EmbedBuilder()
          .setColor(0xf0c13e)
          .setAuthor({ name: '◈ ATLAS ULTIMATE · Anti-Ghost Ping', iconURL: client.user.displayAvatarURL() })
          .setDescription(`**${message.author.tag}** ghost pinged in ${message.channel}`)
          .addFields({ name: 'Message Content', value: message.content || '*No content*' })
          .setTimestamp();
        await logCh.send({ embeds: [embed] });
      }
      await message.channel.send(`👻 ${message.author}, ghost pinging is forbidden!`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
    }
  } catch (err) {
    console.error('messageDelete ghost ping:', err);
  }
});

// ─── SERVER BOOST (Nitro) — premium thank-you ───────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (process.env.GUILD_ID && newMember.guild.id !== process.env.GUILD_ID) return;
    const before = oldMember.premiumSince;
    const after = newMember.premiumSince;
    if (before?.getTime?.() === after?.getTime?.()) return;
    if (!after) return;
    if (before) return;

    const chId = process.env.BOOST_LOG_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID;
    if (!chId) return;
    const ch = newMember.guild.channels.cache.get(chId);
    if (!ch?.isTextBased()) return;

    await newMember.guild.fetch().catch(() => {});
    const ping = process.env.BOOST_PING_USER !== '0' && process.env.BOOST_PING_USER !== 'false';
    const content = ping ? `${newMember.user}` : undefined;
    await ch.send({ content, embeds: [buildBoostEmbed(newMember, newMember.guild, client)] });
  } catch (err) {
    console.error('guildMemberUpdate boost:', err);
  }
});

// ─── STAFF ACTION LOGGING ──────────────────────────────────────────
async function logStaffAction(guild, actionName, changes) {
  try {
    const logCh = guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
    if (!logCh) return;
    const embed = new EmbedBuilder()
      .setColor(0x1dc9d8)
      .setAuthor({ name: `◈ ATLAS ULTIMATE · Staff Log`, iconURL: guild.client.user.displayAvatarURL() })
      .setTitle(actionName)
      .setDescription(changes || '*No specific details available.*')
      .setTimestamp();
    await logCh.send({ embeds: [embed] });
  } catch {}
}

client.on('channelUpdate', async (oldChannel, newChannel) => {
  if (!oldChannel.guild) return;
  setTimeout(async () => {
    try {
      const logs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newChannel.id && Date.now() - entry.createdTimestamp < 10000) {
        if (entry.executor.bot) return;
        const changes = entry.changes.map(c => `**${c.key}**: \`${c.old}\` ➔ \`${c.new}\``).join('\n');
        await logStaffAction(newChannel.guild, `🛠️ Channel Updated: #${newChannel.name}`, `**Executor**: ${entry.executor}\n${changes}`);
      }
    } catch {}
  }, 2000);
});

client.on('roleUpdate', async (oldRole, newRole) => {
  setTimeout(async () => {
    try {
      const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
      const entry = logs.entries.first();
      if (entry && entry.target.id === newRole.id && Date.now() - entry.createdTimestamp < 10000) {
        if (entry.executor.bot) return;
        const changes = entry.changes.map(c => `**${c.key}**: \`${c.old}\` ➔ \`${c.new}\``).join('\n');
        await logStaffAction(newRole.guild, `🛡️ Role Updated: @${newRole.name}`, `**Executor**: ${entry.executor}\n${changes}`);
      }
    } catch {}
  }, 2000);
});

client.on('guildUpdate', async (oldGuild, newGuild) => {
  setTimeout(async () => {
    try {
      const logs = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 10000) {
        if (entry.executor.bot) return;
        const changes = entry.changes.map(c => `**${c.key}**: \`${c.old}\` ➔ \`${c.new}\``).join('\n');
        await logStaffAction(newGuild, `🏰 Guild Settings Updated`, `**Executor**: ${entry.executor}\n${changes}`);
      }
    } catch {}
  }, 2000);
});

const verificationCache = new Map();
const XP_COOLDOWN = 10 * 1000;

// ─── MESSAGE — AUTOMOD ONLY (no prefix commands) ──────────────────────

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;
  if (!message.member)   return;

  const member  = message.member;
  const content = message.content.toLowerCase();
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!isStaff) {
    // ── ADVANCED PHISHING PROTECTION ──
    const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g);
    if (urlMatch) {
      let isPhishing = false;
      for (const link of urlMatch) {
        try {
          const domain = new URL(link).hostname;
          if (mongoose.connection.readyState === 1) {
            let cached = await PhishingCache.findOne({ domain });
            if (!cached && process.env.VT_API_KEY) {
              const vtRes = await axios.get(`https://www.virustotal.com/api/v3/domains/${domain}`, {
                headers: { 'x-apikey': process.env.VT_API_KEY }
              }).catch(() => null);
              
              const stats = vtRes?.data?.data?.attributes?.last_analysis_stats;
              const isBad = stats && (stats.malicious > 0 || stats.suspicious > 1);
              cached = await PhishingCache.create({ domain, isMalicious: !!isBad });
            }
            if (cached && cached.isMalicious) {
              isPhishing = true;
              break;
            }
          }
        } catch (e) {}
      }

      if (isPhishing) {
        await message.delete().catch(() => {});
        await issueWarn(member, 'Malicious phishing link detected', client);
        await message.channel.send(`🚨 ${message.author}, malicious link blocked by ATLAS Security!`);
        return;
      }
    }

    const config = loadSecurityConfig(message.guild.id);
    const secViolation = checkSecurityText(message, config);
    if (secViolation) {
      await message.delete().catch(() => {});
      await issueWarn(member, `Security Violation: ${secViolation}`, client);
      return;
    }

    const banned = loadBannedWords(message.guild.id);
    let hit = false;
    for (const w of banned) {
      try {
        if (new RegExp(w, 'i').test(content)) { hit = true; break; }
      } catch {
        if (content.includes(w.toLowerCase())) { hit = true; break; }
      }
    }
    if (hit) { await message.delete().catch(() => {}); await issueWarn(member, 'Banned word/link detected (Regex)', client); return; }
    if (checkSpam(message.author.id)) { await message.delete().catch(() => {}); await issueWarn(member, 'Spam detected', client); return; }
    if (message.mentions.users.size >= 5) { await message.delete().catch(() => {}); await issueWarn(member, `Mass mention (${message.mentions.users.size} pings)`, client); return; }
    if (/discord\.(gg|com\/invite)\/\S+/i.test(message.content)) { await message.delete().catch(() => {}); await issueWarn(member, 'Unauthorized invite link', client); return; }
  }

  // XP gain
  const db   = loadDB();
  const user = getUser(db, message.guild.id, message.author.id);
  const now  = Date.now();
  if (now - user.lastMessage < XP_COOLDOWN) return;
  user.lastMessage = now;
  const oldLevel = getLevelFromXP(user.xp).level;
  user.xp += Math.floor(Math.random() * 11) + 5;
  const newStats = getLevelFromXP(user.xp);
  saveDB(db);
  console.log(`[XP] ${message.author.tag} gained XP. Total: ${user.xp}`);
  if (newStats.level > oldLevel) {
    const lvlCh = message.guild.channels.cache.get(process.env.LEVEL_UP_CHANNEL_ID) || message.channel;
    await lvlCh.send({ content: `${message.author}`, embeds: [levelUpEmbed(message.member, newStats.level, newStats.needed, client)] });
    await assignRoles(message.member, newStats.level);
  }

  if (mongoose.connection.readyState === 1) {
    const coinsEarned = Math.floor(Math.random() * 5) + 1;
    await Economy.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      { $inc: { balance: coinsEarned } },
      { upsert: true }
    ).catch(()=>{});
  }
});

// ─── VOICE STATE ─────────────────────────────────────────────────────
client.on('voiceStateUpdate', async (oldState, newState) => {
  const types  = buildTypes();
  const allJTC = Object.keys(types).filter(Boolean);
  if (newState.channelId && allJTC.includes(newState.channelId)) {
    const guild    = newState.guild;
    const member   = newState.member;
    const category = newState.channel.parentId;
    const type     = getChannelType(newState.channelId);
    try {
      const newChannel = await guild.channels.create({
        name: `${type.emoji} ${member.displayName}'s ${type.name}`,
        type: 2, parent: category,
        permissionOverwrites: [{ id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers] }],
      });
      const channelData = { ownerId: member.id, guildId: guild.id, status: 'open', limit: 0, type };
      tempChannels.set(newChannel.id, channelData);
      await member.voice.setChannel(newChannel);
      await newChannel.send({ embeds: [buildPanel(member, channelData)], components: buildRows() });
    } catch (err) { console.error('Failed to create temp channel:', err); }
  }
  if (oldState.channelId && tempChannels.has(oldState.channelId)) {
    const channel = oldState.channel;
    if (channel && channel.members.size === 0) {
      tempChannels.delete(oldState.channelId);
      await channel.delete().catch(() => {});
    }
  }
});

// ─── INTERACTIONS ────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {

  // ── SLASH COMMANDS ─────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName, member, guild } = interaction;
    const isMod   = member.permissions.has(PermissionFlagsBits.ManageMessages);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    // /help — always visible (no default_member_permissions on deploy)
    if (commandName === 'help') {
      const help = new EmbedBuilder()
        .setColor(CYAN)
        .setTitle('✦ ATLAS ULTIMATE — Command list')
        .setDescription(
          [
            '**Everyone** (should appear in `/` for all members)',
            '`/help` · `/rank` · `/leaderboard` · `/serverinfo` · `/userinfo`',
            '',
            '**Mods** (Manage Messages)',
            '`/warn` · `/warns` · `/clearwarns` · `/addword` · `/removeword` · `/wordlist` · `/clear`',
            '',
            '**Moderators** (Specific Permissions)',
            '`/kick` · `/ban` · `/unban` · `/mute` · `/unmute` · `/slowmode` · `/lock` · `/unlock` · `/nick`',
            '',
            '**Administrators only**',
            '`/roles` (post/reload panels) · `/welcome` · `/setxp` · `/resetxp`',
            '',
            '**No commands at all?** Run `npm run deploy` on the PC where the bot project lives. `GUILD_ID` in `.env` must be **this** server\'s ID. Re-open Discord or press **Ctrl+R**.',
          ].join('\n')
        )
        .setFooter({ text: 'ATLAS ULTIMATE' });
      return interaction.reply({ embeds: [help], ephemeral: true });
    }

    // /rank
    if (commandName === 'rank') {
      const target = interaction.options.getMember('user') || member;
      const db     = loadDB();
      const user   = getUser(db, guild.id, target.id);
      const stats  = getLevelFromXP(user.xp);
      const gData  = db[guild.id] || {};
      const sorted = Object.entries(gData).sort((a,b) => b[1].xp - a[1].xp);
      const rank   = sorted.findIndex(([id]) => id === target.id) + 1;
      return interaction.reply({ embeds: [rankEmbed(target, stats, user.xp, rank, client)] });
    }

    // /leaderboard
    if (commandName === 'leaderboard') {
      const db    = loadDB();
      const gData = db[guild.id] || {};
      const sorted = Object.entries(gData).sort((a,b) => b[1].xp - a[1].xp).slice(0, 10);
      const entries = await Promise.all(sorted.map(async ([userId, data]) => {
        const stats = getLevelFromXP(data.xp);
        let name = userId;
        try { const m = await guild.members.fetch(userId); name = m.displayName; } catch {}
        return { name, level: stats.level, xp: data.xp };
      }));
      return interaction.reply({ embeds: [leaderboardEmbed(entries, client)] });
    }

    // /serverinfo — premium server card
    if (commandName === 'serverinfo') {
      await guild.fetch().catch(() => {});
      return interaction.reply({ embeds: [serverInfoEmbed(guild, client)] });
    }

    // /userinfo — premium member card
    if (commandName === 'userinfo') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const tm = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!tm) {
        return interaction.reply({ embeds: [errorEmbed('Not in server', 'That user is not a member of this server.')], ephemeral: true });
      }
      try { await tm.user.fetch(); } catch (_) { /* badges optional */ }
      return interaction.reply({ embeds: [userInfoEmbed(tm, client)] });
    }

    // /setxp
    if (commandName === 'setxp') {
      if (!isAdmin) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Admins only.')], ephemeral: true });
      const target = interaction.options.getMember('user');
      const amount = interaction.options.getInteger('amount');
      const db     = loadDB();
      const user   = getUser(db, guild.id, target.id);
      user.xp      = amount;
      saveDB(db);
      return interaction.reply({ embeds: [successEmbed('XP Set', `${target.displayName}'s XP is now **${amount}**`)] });
    }

    // /resetxp
    if (commandName === 'resetxp') {
      if (!isAdmin) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Admins only.')], ephemeral: true });
      const target = interaction.options.getMember('user');
      const db     = loadDB();
      const user   = getUser(db, guild.id, target.id);
      user.xp      = 0;
      saveDB(db);
      return interaction.reply({ embeds: [successEmbed('XP Reset', `${target.displayName}'s XP has been reset to 0.`)] });
    }

    // /warn
    if (commandName === 'warn') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const count  = await issueWarn(target, reason, client, false);
      const logCh  = guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
      if (logCh) await logCh.send({ embeds: [manualWarnEmbed(target, reason, count, member, client)] });
      return interaction.reply({ embeds: [successEmbed('Warning Issued', `**${target.displayName}** warned. (${count}/3)`)] });
    }

    // /warns
    if (commandName === 'warns') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const target = interaction.options.getMember('user') || member;
      const db     = loadWarns();
      const user   = getWarns(db, guild.id, target.id);
      return interaction.reply({ embeds: [warnsListEmbed(target, user.warns, client)], ephemeral: true });
    }

    // /clearwarns
    if (commandName === 'clearwarns') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const target = interaction.options.getMember('user');
      const db     = loadWarns();
      const user   = getWarns(db, guild.id, target.id);
      user.warns   = [];
      user.count   = 0;
      saveWarns(db);
      return interaction.reply({ embeds: [clearWarnsEmbed(target, member, client)] });
    }

    // /addword
    if (commandName === 'addword') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const word  = interaction.options.getString('word').toLowerCase();
      const words = loadBannedWords(guild.id);
      if (words.includes(word)) return interaction.reply({ embeds: [errorEmbed('Already Banned', `**${word}** is already in the list.`)], ephemeral: true });
      words.push(word);
      saveBannedWords(guild.id, words);
      return interaction.reply({ embeds: [successEmbed('Word Added', `**${word}** is now banned.`)] });
    }

    // /removeword
    if (commandName === 'removeword') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const word  = interaction.options.getString('word').toLowerCase();
      const words = loadBannedWords(guild.id);
      const idx   = words.indexOf(word);
      if (idx === -1) return interaction.reply({ embeds: [errorEmbed('Not Found', `**${word}** is not in the list.`)], ephemeral: true });
      words.splice(idx, 1);
      saveBannedWords(guild.id, words);
      return interaction.reply({ embeds: [successEmbed('Word Removed', `**${word}** removed from the banned list.`)] });
    }

    // /wordlist
    if (commandName === 'wordlist') {
      if (!isMod) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Mods only.')], ephemeral: true });
      const words = loadBannedWords(guild.id);
      return interaction.reply({ embeds: [infoEmbed('Banned Words', words.map(w => `\`${w}\``).join(', ') || 'None')], ephemeral: true });
    }

    // ── MODERATION (Probot-style) — Administrator only ─────────────
    if (commandName === 'kick') {
      if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Kick Members** permission can use this.')], ephemeral: true });
      }
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const hb = hierarchyBlock(member, target);
      if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot kick', hb)], ephemeral: true });
      if (!target.kickable) return interaction.reply({ embeds: [errorEmbed('Error', 'I cannot kick this member.')], ephemeral: true });
      await target.kick(reason);
      await sendModLog(guild, modLogEmbed({ action: 'Kick', moderator: member, targetUser: target.user, reason }));
      return interaction.reply({ embeds: [successEmbed('Kicked', `**${target.user.tag}** has been kicked.`)] });
    }

    if (commandName === 'ban') {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Ban Members** permission can use this.')], ephemeral: true });
      }
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
      const sec = Math.min(Math.max(deleteDays, 0), 7) * 24 * 60 * 60;
      const targetMember = await guild.members.fetch(user.id).catch(() => null);
      if (targetMember) {
        const hb = hierarchyBlock(member, targetMember);
        if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot ban', hb)], ephemeral: true });
        if (!targetMember.bannable) return interaction.reply({ embeds: [errorEmbed('Error', 'I cannot ban this member.')], ephemeral: true });
      }
      await guild.members.ban(user, { deleteMessageSeconds: sec, reason });
      await sendModLog(guild, modLogEmbed({ action: 'Ban', moderator: member, targetUser: user, reason, extra: deleteDays ? `Deleted messages: **${deleteDays}** day(s)` : undefined }));
      return interaction.reply({ embeds: [successEmbed('Banned', `**${user.tag}** has been banned.`)] });
    }

    if (commandName === 'unban') {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Ban Members** permission can use this.')], ephemeral: true });
      }
      const rawId = interaction.options.getString('user_id').trim();
      const reason = interaction.options.getString('reason') || 'No reason provided';
      if (!/^\d{17,20}$/.test(rawId)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Use a numeric Discord user ID.')], ephemeral: true });
      }
      const ban = await guild.bans.fetch(rawId).catch(() => null);
      if (!ban) return interaction.reply({ embeds: [errorEmbed('Not banned', 'That user is not in the ban list.')], ephemeral: true });
      await guild.members.unban(rawId, reason);
      await sendModLog(guild, modLogEmbed({ action: 'Unban', moderator: member, targetUser: ban.user, reason }));
      return interaction.reply({ embeds: [successEmbed('Unbanned', `**${ban.user.tag}** has been unbanned.`)] });
    }

    if (commandName === 'mute') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Timeout Members** permission can use this.')], ephemeral: true });
      }
      const target = interaction.options.getMember('user');
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const hb = hierarchyBlock(member, target);
      if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot mute', hb)], ephemeral: true });
      const ms = minutes * 60 * 1000;
      await target.timeout(ms, reason);
      await sendModLog(guild, modLogEmbed({ action: 'Timeout (mute)', moderator: member, targetUser: target.user, reason, extra: `Duration: **${minutes}** min` }));
      return interaction.reply({ embeds: [successEmbed('Muted', `**${target.user.tag}** timed out for **${minutes}** min.`)] });
    }

    if (commandName === 'unmute') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Timeout Members** permission can use this.')], ephemeral: true });
      }
      const target = interaction.options.getMember('user');
      const hb = hierarchyBlock(member, target);
      if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot unmute', hb)], ephemeral: true });
      await target.timeout(null, 'Timeout removed');
      await sendModLog(guild, modLogEmbed({ action: 'Unmute', moderator: member, targetUser: target.user, reason: 'Timeout removed' }));
      return interaction.reply({ embeds: [successEmbed('Unmuted', `Timeout removed for **${target.user.tag}**.`)] });
    }

    if (commandName === 'clear') {
      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Manage Messages** permission can use this.')], ephemeral: true });
      }
      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'Use this in a text channel.')], ephemeral: true });
      }
      const amount = interaction.options.getInteger('amount');
      const filterUser = interaction.options.getUser('user');
      await interaction.deferReply({ ephemeral: false });
      try {
        const deleted = await purgeMessages(channel, amount, filterUser?.id);
        await sendModLog(guild, modLogEmbed({
          action: 'Clear messages',
          moderator: member,
          targetUser: null,
          targetTag: filterUser ? filterUser.tag : 'everyone',
          extra: `Channel: ${channel} · Deleted: **${deleted}**`,
        }));
        return interaction.editReply({ embeds: [successEmbed('Messages cleared', `Removed **${deleted}** message(s).`)] });
      } catch (e) {
        console.error('purge:', e);
        return interaction.editReply({ embeds: [errorEmbed('Error', 'Could not delete messages (check age limit or permissions).')] });
      }
    }

    if (commandName === 'slowmode') {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Manage Channels** permission can use this.')], ephemeral: true });
      }
      const seconds = interaction.options.getInteger('seconds');
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      if (!ch?.isTextBased()) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'Pick a text channel.')], ephemeral: true });
      }
      await ch.setRateLimitPerUser(seconds);
      await sendModLog(guild, modLogEmbed({ action: 'Slowmode', moderator: member, targetUser: null, targetTag: ch.name, extra: `**${seconds}** second(s)` }));
      return interaction.reply({ embeds: [successEmbed('Slowmode', `${ch} is now **${seconds}**s per user.`)] });
    }

    if (commandName === 'lock') {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Manage Channels** permission can use this.')], ephemeral: true });
      }
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      if (!ch?.isTextBased()) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'Pick a text channel.')], ephemeral: true });
      }
      await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await sendModLog(guild, modLogEmbed({ action: 'Lock channel', moderator: member, targetUser: null, targetTag: ch.name }));
      return interaction.reply({ embeds: [successEmbed('Locked', `${ch} — **@everyone** cannot send messages.`)] });
    }

    if (commandName === 'unlock') {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Manage Channels** permission can use this.')], ephemeral: true });
      }
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      if (!ch?.isTextBased()) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'Pick a text channel.')], ephemeral: true });
      }
      await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
      await sendModLog(guild, modLogEmbed({ action: 'Unlock channel', moderator: member, targetUser: null, targetTag: ch.name }));
      return interaction.reply({ embeds: [successEmbed('Unlocked', `${ch} is open again.`)] });
    }

    if (commandName === 'nick') {
      if (!member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only members with **Manage Nicknames** permission can use this.')], ephemeral: true });
      }
      const target = interaction.options.getMember('user');
      const nickRaw = interaction.options.getString('nickname');
      const nick = nickRaw != null && nickRaw.trim().length ? nickRaw.trim() : null;
      const hb = hierarchyBlock(member, target);
      if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot change nick', hb)], ephemeral: true });
      await target.setNickname(nick, 'Nick command');
      await sendModLog(guild, modLogEmbed({ action: 'Nickname', moderator: member, targetUser: target.user, extra: nick ? `→ **${nick}**` : 'Reset' }));
      return interaction.reply({ embeds: [successEmbed('Nickname updated', `**${target.user.tag}** ${nick ? `is now **${nick}**.` : 'nickname cleared.'}`)] });
    }

    if (commandName === 'secret-chat') {
      const targetUser = interaction.options.getUser('user');
      const minutes = interaction.options.getInteger('minutes');
      
      const channel = await interaction.guild.channels.create({
        name: `secret-${Math.floor(Math.random() * 10000)}`,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages'] },
          { id: targetUser.id, allow: ['ViewChannel', 'SendMessages'] },
          { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] }
        ]
      }).catch(err => {
         console.error(err);
         return null;
      });

      if (!channel) return interaction.reply({ content: '❌ Failed to create secret channel.', ephemeral: true });

      const deleteAt = new Date(Date.now() + minutes * 60000);
      
      if (mongoose.connection.readyState === 1) {
         await SecretChannel.create({ channelId: channel.id, guildId: interaction.guild.id, deleteAt }).catch(()=>{});
      } else {
         // Fallback if Mongo isn't connected
         setTimeout(() => {
            channel.delete('Secret channel expired (Timeout fallback)').catch(()=>{});
         }, minutes * 60000);
      }

      await channel.send(`🕵️ **Secret Chat Created**\nWelcome ${interaction.user} and ${targetUser}.\nThis channel will self-destruct in **${minutes} minutes**.`);
      return interaction.reply({ content: `✅ Secret channel created: ${channel} (Destructs in ${minutes}m)`, ephemeral: true });
    }

   // ==========================================
   // 🎵 MUSIC SYSTEM (Native Voice + play-dl SC)
   // ==========================================

   function generateMusicPanel(queue) {
       if (!queue || !queue.current) return null;
       const embed = new EmbedBuilder()
           .setColor(0x00E5FF)
           .setAuthor({ name: 'ATLAS UNIT · AUDIO ENGINE', iconURL: 'https://i.imgur.com/8Qj8X8w.png' })
           .setTitle(queue.current.title)
           .setURL(queue.current.url)
           .setThumbnail(queue.current.thumbnail || 'https://i.imgur.com/8Qj8X8w.png')
           .addFields(
               { name: 'Author', value: queue.current.author || 'Unknown', inline: true },
               { name: 'Duration', value: String(queue.current.duration || '0:00') + 's', inline: true },
               { name: 'Up Next', value: queue.tracks.length > 0 ? queue.tracks[0].title : 'None', inline: true }
           )
           .setFooter({ text: `SYSTEM QUEUE: ${queue.tracks.length} TRACKS` });

       const row = new ActionRowBuilder().addComponents(
           new ButtonBuilder().setCustomId('music_pause').setLabel('❚❚').setStyle(ButtonStyle.Secondary),
           new ButtonBuilder().setCustomId('music_resume').setLabel('►').setStyle(ButtonStyle.Secondary),
           new ButtonBuilder().setCustomId('music_skip').setLabel('►►').setStyle(ButtonStyle.Secondary),
           new ButtonBuilder().setCustomId('music_stop').setLabel('■').setStyle(ButtonStyle.Secondary),
           new ButtonBuilder().setCustomId('music_queue').setLabel('▤').setStyle(ButtonStyle.Secondary)
       );

       return { embeds: [embed], components: [row] };
   }

    if (commandName === 'play') {
       const query = interaction.options.getString('query');
       const voiceChannel = interaction.member.voice.channel;
       if (!voiceChannel) return interaction.reply({ content: '❌ You need to be in a voice channel!', ephemeral: true });

       await interaction.deferReply();
       
       let trackInfo;
       try {
           let searchQuery = query;
           
           if (query.startsWith('http')) {
               if (query.includes('youtube.com') || query.includes('youtu.be')) {
                   let videoId = '';
                   if (query.includes('youtu.be/')) videoId = query.split('youtu.be/')[1].split('?')[0];
                   else if (query.includes('v=')) videoId = query.split('v=')[1].split('&')[0];
                   
                   if (videoId) {
                       const ytVid = await yts({ videoId });
                       if (ytVid && ytVid.title) searchQuery = ytVid.title; 
                   }
               } else if (query.includes('soundcloud.com')) {
                   trackInfo = await play.soundcloud(query);
                   if (!trackInfo) return interaction.editReply({ content: '❌ Track not found.' });
               }
           }
           
           if (!trackInfo) {
               const r = await play.search(searchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
               if (!r || !r.length) return interaction.editReply({ content: '❌ Track not found.' });
               trackInfo = r[0];
           }
       } catch (err) {
           console.error('Search/Link Error:', err);
           return interaction.editReply({ content: '❌ Error finding the track.' });
       }
       
       const track = {
           title: trackInfo.name,
           url: trackInfo.url,
           author: trackInfo.user?.name || 'Unknown',
           duration: trackInfo.durationInSec,
           thumbnail: trackInfo.thumbnail
       };

       let queue = musicQueues.get(interaction.guild.id);

       if (!queue) {
           queue = { 
               tracks: [], 
               current: null, 
               channel: interaction.channel,
               connection: null,
               player: createAudioPlayer()
           };
           musicQueues.set(interaction.guild.id, queue);

           try {
               queue.connection = joinVoiceChannel({
                   channelId: voiceChannel.id,
                   guildId: interaction.guild.id,
                   adapterCreator: interaction.guild.voiceAdapterCreator,
               });
               queue.connection.subscribe(queue.player);

               queue.player.on(AudioPlayerStatus.Idle, async () => {
                   if (queue.tracks.length > 0) {
                       queue.current = queue.tracks.shift();
                       try {
                           const stream = await play.stream(queue.current.url);
                           const resource = createAudioResource(stream.stream, { inputType: stream.type });
                           queue.player.play(resource);
                           if (queue.channel) { const panel = generateMusicPanel(queue); if (queue.panelMessage) queue.panelMessage.delete().catch(()=>{}); queue.channel.send(panel).then(m => queue.panelMessage = m).catch(()=>{}); }
                       } catch (err) {
                           console.error('Playback Error:', err);
                           if (queue.channel) queue.channel.send('❌ Failed to play next track.');
                           queue.player.stop();
                       }
                   } else {
                       queue.connection.destroy();
                       musicQueues.delete(interaction.guild.id);
                   }
               });
               
               queue.player.on('error', error => {
                   console.error('Audio Player Error:', error);
                   if (queue.channel) queue.channel.send('❌ An error occurred while playing audio.');
                   queue.connection.destroy();
                   musicQueues.delete(interaction.guild.id);
               });
           } catch (e) {
               console.error('Voice Connection Error:', e);
               musicQueues.delete(interaction.guild.id);
               return interaction.editReply({ content: '❌ Could not join your voice channel.' });
           }
       }

       if (!queue.current) {
           queue.current = track;
           try {
               const stream = await play.stream(track.url);
               const resource = createAudioResource(stream.stream, { inputType: stream.type });
               queue.player.play(resource);
               const panel = generateMusicPanel(queue); const msg = await interaction.editReply(panel); queue.panelMessage = msg; return;
           } catch (err) {
               console.error('Playback Error:', err);
               queue.current = null;
               return interaction.editReply({ content: '❌ Failed to play track.' });
           }
       } else {
           queue.tracks.push(track);
           return interaction.editReply(`📝 Added to queue: **${track.title}**`);
       }
    }

    if (commandName === 'skip') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue || !queue.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
       queue.player.stop();
       return interaction.reply('⏭️ Skipped.');
    }

    if (commandName === 'pause') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue || !queue.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
       queue.player.pause();
       return interaction.reply('⏸️ Paused.');
    }

    if (commandName === 'resume') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue || !queue.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
       queue.player.unpause();
       return interaction.reply('▶️ Resumed.');
    }

    if (commandName === 'queue') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue || (!queue.current && queue.tracks.length === 0)) {
           return interaction.reply({ content: '❌ Queue is empty.', ephemeral: true });
       }
       
       let qStr = `**Now Playing:** ${queue.current.title}\n\n**Up Next:**\n`;
       if (queue.tracks.length === 0) {
           qStr += '*No more tracks in queue.*';
       } else {
           qStr += queue.tracks.slice(0, 10).map((t, i) => `**${i+1}.** ${t.title}`).join('\n');
           if (queue.tracks.length > 10) qStr += `\n*...and ${queue.tracks.length - 10} more.*`;
       }
       
       const embed = new EmbedBuilder().setColor(CYAN).setTitle('🎶 Music Queue').setDescription(qStr);
       return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'nowplaying') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue || !queue.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
       
       const embed = new EmbedBuilder()
           .setColor(CYAN)
           .setTitle('🎶 Now Playing')
           .setDescription(`**[${queue.current.title}](${queue.current.url || '#'})**\nAuthor: ${queue.current.author}`);
       return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'stop') {
       const queue = musicQueues.get(interaction.guild.id);
       if (!queue) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
       
       queue.tracks = [];
       queue.player.stop();
       if (queue.connection) queue.connection.destroy();
       musicQueues.delete(interaction.guild.id);
       return interaction.reply('🛑 Audio stopped and disconnected.');
    }

    if (commandName === 'alt-check') {
       if (mongoose.connection.readyState !== 1) return interaction.reply({ content: '❌ Database offline.', ephemeral: true });
       const target = interaction.options.getUser('user');
       const record = await AltTracker.findOne({ userId: target.id });
       
       if (!record) {
           return interaction.reply({ content: `✅ **${target.tag}** has no tracked data or is clean.`, ephemeral: true });
       }
       
       // Check if they share IP or fingerprint with any banned user
       const relatedAlts = await AltTracker.find({ 
           $or: [ { ipHash: record.ipHash }, { fingerprint: record.fingerprint } ],
           userId: { $ne: target.id }
       });
       
       const embed = new EmbedBuilder()
           .setColor(record.banned ? RED : CYAN)
           .setTitle(`Alt Tracker: ${target.tag}`)
           .addFields(
               { name: 'Blacklisted?', value: record.banned ? '🔴 YES' : '🟢 NO', inline: true },
               { name: 'Fingerprint Match', value: `\`${record.fingerprint.substring(0, 8)}...\``, inline: true }
           );
           
       if (relatedAlts.length > 0) {
           embed.addFields({ name: 'Associated Accounts', value: relatedAlts.map(a => `<@${a.userId}> (Banned: ${a.banned})`).join('\n') });
       } else {
           embed.addFields({ name: 'Associated Accounts', value: 'None found.' });
       }
       
       return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'alt-blacklist') {
       if (mongoose.connection.readyState !== 1) return interaction.reply({ content: '❌ Database offline.', ephemeral: true });
       const target = interaction.options.getUser('user');
       
       const record = await AltTracker.findOneAndUpdate(
           { userId: target.id },
           { banned: true },
           { upsert: true, new: true }
       );
       
       // Ban the user in the server too
       const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
       if (member && member.bannable) {
           await member.ban({ reason: 'Alt Tracker: Blacklisted by Staff' });
       }
       
       return interaction.reply({ content: `🚫 **${target.tag}**'s network signature has been blacklisted. Any future alts using this network/browser will be blocked from verification.` });
    }


    if (commandName === 'economy') {
      const sub = interaction.options.getSubcommand();
      
      if (mongoose.connection.readyState !== 1) {
        return interaction.reply({ content: '❌ The Economy database is currently offline.', ephemeral: true });
      }

      if (sub === 'balance') {
        const target = interaction.options.getUser('user') || interaction.user;
        const record = await Economy.findOne({ guildId: interaction.guild.id, userId: target.id });
        const bal = record ? record.balance : 0;
        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setAuthor({ name: `${target.username}'s Balance`, iconURL: target.displayAvatarURL() })
          .setDescription(`💰 **${bal.toLocaleString()}** Atlas Coins`);
        return interaction.reply({ embeds: [embed] });
      }

      const shopItems = [
        { id: 'vip', name: 'VIP Role', price: 5000, desc: 'Grants the exclusive VIP role.', roleId: process.env.VIP_ROLE_ID || null },
        { id: 'custom', name: 'Custom Name Color', price: 10000, desc: 'DM staff to claim your custom color role.', roleId: null }
      ];

      if (sub === 'shop') {
        const embed = new EmbedBuilder()
          .setColor(0x1dc9d8)
          .setTitle('🛒 Server Shop')
          .setDescription('Use `/economy buy <item>` to purchase an item.');
        
        shopItems.forEach(item => {
           embed.addFields({ name: `${item.name} (${item.id})`, value: `💰 **${item.price.toLocaleString()}** Coins\n*${item.desc}*` });
        });
        
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'buy') {
        const itemId = interaction.options.getString('item').toLowerCase();
        const item = shopItems.find(i => i.id === itemId);
        if (!item) return interaction.reply({ content: '❌ Item not found in the shop.', ephemeral: true });

        const record = await Economy.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
        if (!record || record.balance < item.price) {
          return interaction.reply({ content: `❌ You don't have enough coins. You need **${item.price.toLocaleString()}** coins.`, ephemeral: true });
        }

        record.balance -= item.price;
        record.inventory.push({ itemName: item.name, purchasedAt: new Date() });
        await record.save();

        if (item.roleId) {
          const role = interaction.guild.roles.cache.get(item.roleId);
          if (role) {
            await interaction.member.roles.add(role).catch(()=>{});
          }
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Purchase Successful')
          .setDescription(`You successfully bought **${item.name}** for 💰 ${item.price} coins!\nYour new balance is 💰 **${record.balance.toLocaleString()}**.`);
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'addmoney') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
           return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        
        const record = await Economy.findOneAndUpdate(
          { guildId: interaction.guild.id, userId: target.id },
          { $inc: { balance: amount } },
          { upsert: true, new: true }
        );
        
        return interaction.reply({ content: `✅ Added 💰 **${amount}** to ${target}. New balance: **${record.balance}**` });
      }
    }

    // /welcome preview
    if (commandName === 'welcome') {
      if (!isAdmin) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Admins only.')], ephemeral: true });
      const sub = interaction.options.getSubcommand();
      if (sub === 'preview') {
        const { embeds, files } = buildWelcomePayload(member, guild, client);
        return interaction.reply({
          content: '*Preview — uses your profile as the new member.*',
          embeds,
          files: files.length ? files : undefined,
        });
      }
    }

    // /roles post | reload — button-style role panels (dropdowns)
    if (commandName === 'roles') {
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this.')], ephemeral: true });
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'reload') {
        reloadRolePanels();
        return interaction.reply({ embeds: [successEmbed('Reloaded', '**role-panels.json** has been reloaded.')], ephemeral: true });
      }
      if (sub === 'post') {
        const channel = interaction.channel;
        if (!channel?.isTextBased()) {
          return interaction.reply({ embeds: [errorEmbed('Error', 'Use this in a text channel.')], ephemeral: true });
        }
        try {
          const count = await postRolePanels(channel, guild, client);
          return interaction.reply({
            embeds: [successEmbed('Role panels posted', `Sent **${count}** panel(s). Members can use the dropdowns to get roles.`)],
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ embeds: [errorEmbed('Cannot post', e.message || String(e))], ephemeral: true });
        }
      }
    }
    // /security
    if (commandName === 'security') {
      if (!isAdmin) return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this.')], ephemeral: true });
      
      const sub = interaction.options.getSubcommand();
      const config = loadSecurityConfig(guild.id);

      if (sub === 'status') {
        return interaction.reply({ embeds: [securityStatusEmbed(guild, config, client)] });
      }

      if (sub === 'toggle') {
        const feature = interaction.options.getString('feature');
        config[feature] = !config[feature];
        saveSecurityConfig(guild.id, config);
        
        const state = config[feature] ? '✅ Enabled' : '❌ Disabled';
        const featureNames = {
          antiLink: 'Anti-Link',
          antiRaid: 'Anti-Raid',
          antiNuke: 'Anti-Nuke',
          antiCaps: 'Anti-Caps',
          antiGhostPing: 'Anti-Ghost Ping'
        };

        return interaction.reply({ embeds: [successEmbed('Security Updated', `**${featureNames[feature]}** is now ${state}.`)] });
      }

      if (sub === 'setquarantine') {
        const role = interaction.options.getRole('role');
        config.quarantineRoleId = role.id;
        saveSecurityConfig(guild.id, config);
        return interaction.reply({ embeds: [successEmbed('Security Updated', `Quarantine role set to ${role}.`)] });
      }

      if (sub === 'setup-ticket') {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('Select a department...')
            .addOptions([
              { label: 'General Support', description: 'Need help with something?', value: 'Support', emoji: '📝' },
              { label: 'Billing / Purchases', description: 'Questions about shop items?', value: 'Billing', emoji: '💳' },
              { label: 'Report User', description: 'Report a rule breaker.', value: 'Report', emoji: '🚨' }
            ])
        );
        const embed = new EmbedBuilder()
          .setColor(0x1dc9d8)
          .setTitle('🎫 ATLAS Support System')
          .setDescription('Need assistance? Select a department from the menu below to open a private ticket.')
          .setFooter({ text: 'ATLAS ULTIMATE Support' });
        
        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: 'Ticket panel deployed.', ephemeral: true });
      }
      
      if (sub === 'setup-verification') {
        const url = process.env.EXPRESS_PORT ? `http://localhost:${process.env.EXPRESS_PORT}/verify/login` : 'http://localhost:3000/verify/login';
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Verify to Enter')
            .setStyle(ButtonStyle.Link)
            .setURL(url)
            .setEmoji('🛡️')
        );
        const embed = new EmbedBuilder()
          .setColor(0x1dc9d8)
          .setTitle('🔒 Server Verification Required')
          .setDescription('To gain full access to this server and receive the Member role, you must authorize your account.\n\nWe check if your account is **older than 30 days** and has **linked social accounts** to prevent bot raids.\n\nClick the button below to start.')
          .setFooter({ text: 'ATLAS ULTIMATE Security' });
        
        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: 'OAuth2 Verification panel deployed.', ephemeral: true });
      }
    }

  }

  // ── ROLE PANELS (select menu → roles) ───────────────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_menu') {
      const dept = interaction.values[0];
      const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] }
        ]
      }).catch(() => null);

      if (!channel) return interaction.reply({ content: '❌ Failed to create ticket channel.', ephemeral: true });

      if (mongoose.connection.readyState === 1) {
         await Ticket.create({ ticketId: channel.id, ownerId: interaction.user.id, channelId: channel.id, department: dept }).catch(()=>{});
      }

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      const embed = new EmbedBuilder()
        .setColor(0x1dc9d8)
        .setTitle(`🎫 ${dept} Ticket`)
        .setDescription(`Hello ${interaction.user}, a staff member will be with you shortly.\n\nTo close this ticket and generate a transcript, click the button below.`);
      
      await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
      return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

    if (interaction.customId.startsWith('au_rr:')) {
      await handleRolePanelSelect(interaction);
      return;
    }
  }

  // ── BUTTONS ────────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('music_')) {
        const id = interaction.customId;
        const queue = musicQueues.get(interaction.guild.id);
        if (!queue) return interaction.reply({ content: '❌ No music is playing right now.', ephemeral: true });
        
        if (id === 'music_pause') {
            queue.player.pause();
            return interaction.reply({ content: '⏸️ Paused the music.', ephemeral: true });
        }
        if (id === 'music_resume') {
            queue.player.unpause();
            return interaction.reply({ content: '▶️ Resumed the music.', ephemeral: true });
        }
        if (id === 'music_skip') {
            queue.player.stop(); // Emits Idle which plays next track
            return interaction.reply({ content: '⏭️ Skipped to the next track.', ephemeral: true });
        }
        if (id === 'music_stop') {
            queue.tracks = [];
            queue.player.stop();
            if (queue.connection) queue.connection.destroy();
            musicQueues.delete(interaction.guild.id);
            if (queue.panelMessage) queue.panelMessage.delete().catch(()=>{});
            return interaction.reply({ content: '🛑 Stopped the music and cleared the queue.', ephemeral: true });
        }
        if (id === 'music_queue') {
            let qStr = `**Now Playing:** ${queue.current.title}\n\n**Up Next:**\n`;
            if (queue.tracks.length === 0) qStr += '*No more tracks in queue.*';
            else {
                qStr += queue.tracks.slice(0, 10).map((t, i) => `**${i+1}.** ${t.title}`).join('\n');
                if (queue.tracks.length > 10) qStr += `\n*...and ${queue.tracks.length - 10} more.*`;
            }
            const embed = new EmbedBuilder().setColor(0x1dc9d8).setTitle('🎶 Music Queue').setDescription(qStr);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Closing ticket and generating transcript... This may take a few seconds.');
      const channel = interaction.channel;
      try {
        const attachment = await discordTranscripts.createTranscript(channel, {
            filename: `${channel.name}-transcript.html`,
            saveImages: true,
            poweredBy: false
        });
        
        const logChannelId = process.env.MOD_LOG_CHANNEL_ID;
        if (logChannelId) {
           const logChannel = interaction.guild.channels.cache.get(logChannelId);
           if (logChannel) {
             await logChannel.send({ content: `Transcript for **${channel.name}** (Closed by ${interaction.user.tag})`, files: [attachment] });
           }
        }
        
        try { await interaction.user.send({ content: `Your ticket **${channel.name}** has been closed. Here is your transcript:`, files: [attachment] }); } catch {}
        
        if (mongoose.connection.readyState === 1) {
           await Ticket.findOneAndUpdate({ channelId: channel.id }, { status: 'closed' }).catch(()=>{});
        }
        
        await channel.delete('Ticket closed').catch(()=>{});
      } catch (err) {
        console.error('Ticket close error:', err);
        await interaction.editReply('❌ Failed to close ticket properly.');
      }
      return;
    }

    if (interaction.customId === 'btn_verify_start') {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      verificationCache.set(interaction.user.id, code);
      const modal = new ModalBuilder()
        .setCustomId('modal_verify')
        .setTitle('Security Captcha');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('captcha_input')
          .setLabel(`Type this exact code: ${code}`)
          .setStyle(TextInputStyle.Short)
          .setMinLength(6).setMaxLength(6)
          .setRequired(true)
      ));
      await interaction.showModal(modal);
      return;
    }

    const member  = interaction.member;
    const voiceCh = member.voice?.channel;
    const data    = voiceCh ? tempChannels.get(voiceCh.id) : null;
    const isOwner = data && data.ownerId === member.id;
    async function deny(msg) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', msg)], ephemeral: true });
    }
    async function notTempChannel() {
      return interaction.reply({ embeds: [errorEmbed('Not a Temp Channel', 'Join your temp voice channel first.')], ephemeral: true });
    }
    if (interaction.customId === 'btn_rename') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('Rename Your Channel');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rename_input').setLabel('New channel name').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(32).setPlaceholder('e.g. Squad Gaming').setRequired(true)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'btn_limit') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_limit').setTitle('Set User Limit');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('limit_input').setLabel('Max users (0 = unlimited)').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setPlaceholder('0').setRequired(true)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'btn_lock') {
      if (!voiceCh || !data) return notTempChannel();
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      data.status = 'locked';
      await interaction.reply({ embeds: [errorEmbed('Channel Locked', 'No new users can join.')], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }
    if (interaction.customId === 'btn_unlock') {
      if (!voiceCh || !data) return notTempChannel();
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      data.status = 'open';
      await interaction.reply({ embeds: [successEmbed('Channel Unlocked', 'Your channel is now open.')], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }
    if (interaction.customId === 'btn_kick') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_kick').setTitle('Kick a Member');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kick_input').setLabel('User ID to kick').setStyle(TextInputStyle.Short).setMinLength(17).setMaxLength(20).setPlaceholder('Right-click user → Copy ID').setRequired(true)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'btn_transfer') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_transfer').setTitle('Transfer Ownership');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('transfer_input').setLabel('New owner User ID').setStyle(TextInputStyle.Short).setMinLength(17).setMaxLength(20).setPlaceholder('Right-click user → Copy ID').setRequired(true)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'btn_info') {
      if (!voiceCh || !data) return interaction.reply({ embeds: [errorEmbed('Not a Temp Channel', 'You are not in a temp voice channel.')], ephemeral: true });
      const owner   = await interaction.guild.members.fetch(data.ownerId);
      const limit   = data.limit === 0 ? 'Unlimited' : `${data.limit} users`;
      const members = voiceCh.members.map(m => m.displayName).join(', ') || 'None';
      const status  = data.status === 'locked' ? '🔒 Locked' : '🔓 Open';
      await interaction.reply({ embeds: [infoEmbed('Channel Info', `**${voiceCh.name}**`).addFields({ name: 'Owner', value: owner.displayName, inline: true }, { name: 'Status', value: status, inline: true }, { name: 'Limit', value: limit, inline: true }, { name: 'Members', value: members, inline: false })], ephemeral: true });
    }
  }

  // ── MODALS ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_verify') {
      const expected = verificationCache.get(interaction.user.id);
      const typed = interaction.fields.getTextInputValue('captcha_input').trim().toUpperCase();
      
      if (!expected || expected !== typed) {
        return interaction.reply({ content: '❌ Incorrect captcha. Please click the button and try again.', ephemeral: true });
      }
      
      verificationCache.delete(interaction.user.id);
      const roleId = process.env.AUTO_ROLE_ID;
      if (!roleId) {
        return interaction.reply({ content: '⚠️ The server admin has not set up the AUTO_ROLE_ID in the configuration.', ephemeral: true });
      }
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await interaction.member.roles.add(role).catch(()=>{});
        await interaction.reply({ content: '✅ Verification successful! You now have access to the server.', ephemeral: true });
      } else {
        await interaction.reply({ content: '⚠️ Could not find the assigned member role.', ephemeral: true });
      }
      return;
    }

    const member  = interaction.member;
    const voiceCh = member.voice?.channel;
    const data    = voiceCh ? tempChannels.get(voiceCh.id) : null;
    const isOwner = data && data.ownerId === member.id;

    async function denyModal(msg) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', msg)], ephemeral: true });
    }
    async function notTempChannelModal() {
      return interaction.reply({ embeds: [errorEmbed('Not a Temp Channel', 'Join your temp voice channel first.')], ephemeral: true });
    }

    const ownerModalIds = new Set(['modal_rename', 'modal_limit', 'modal_kick', 'modal_transfer']);
    if (ownerModalIds.has(interaction.customId)) {
      if (!voiceCh || !data || data.ownerId !== member.id) {
        return interaction.reply({ embeds: [errorEmbed('Access Denied', 'You must be the **owner** of this temp channel (and still connected).')], ephemeral: true });
      }
    }

    if (interaction.customId === 'modal_rename') {
      if (!voiceCh || !data) return notTempChannelModal();
      if (!isOwner) return denyModal('You must be the **owner** of this channel.');
      const name = interaction.fields.getTextInputValue('rename_input');
      await voiceCh.setName(name);
      await interaction.reply({ embeds: [successEmbed('Channel Renamed', `Now called **${name}**.`)], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
      return;
    }
    if (interaction.customId === 'modal_limit') {
      if (!voiceCh || !data) return notTempChannelModal();
      if (!isOwner) return denyModal('You must be the **owner** of this channel.');
      const limit = parseInt(interaction.fields.getTextInputValue('limit_input'), 10);
      if (Number.isNaN(limit) || limit < 0 || limit > 99) return interaction.reply({ embeds: [errorEmbed('Invalid Limit', 'Enter a number between 0 and 99.')], ephemeral: true });
      await voiceCh.setUserLimit(limit);
      data.limit = limit;
      await interaction.reply({ embeds: [successEmbed('Limit Set', `Now ${limit === 0 ? 'unlimited' : `**${limit}** users`}.`)], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
      return;
    }
    if (interaction.customId === 'modal_kick') {
      if (!voiceCh || !data) return notTempChannelModal();
      if (!isOwner) return denyModal('You must be the **owner** of this channel.');
      const userId = interaction.fields.getTextInputValue('kick_input').trim();
      const target = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Could not find that user ID.')], ephemeral: true });
      if (target.voice?.channelId !== voiceCh.id) return interaction.reply({ embeds: [errorEmbed('Not in Channel', 'That user is not in your channel.')], ephemeral: true });
      await target.voice.disconnect();
      await interaction.reply({ embeds: [successEmbed('Kicked', `**${target.displayName}** removed.`)], ephemeral: true });
      return;
    }
    if (interaction.customId === 'modal_transfer') {
      if (!voiceCh || !data) return notTempChannelModal();
      if (!isOwner) return denyModal('You must be the **owner** of this channel.');
      const userId = interaction.fields.getTextInputValue('transfer_input').trim();
      const target = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Could not find that user ID.')], ephemeral: true });
      if (target.voice?.channelId !== voiceCh.id) return interaction.reply({ embeds: [errorEmbed('Not in Channel', 'That user must be in your channel.')], ephemeral: true });
      await voiceCh.permissionOverwrites.edit(member.id, { ManageChannels: false, MoveMembers: false, MuteMembers: false });
      await voiceCh.permissionOverwrites.edit(target.id, { ManageChannels: true, MoveMembers: true, MuteMembers: true });
      data.ownerId = target.id;
      await interaction.reply({ embeds: [successEmbed('Ownership Transferred', `**${target.displayName}** is now the owner.`)], ephemeral: true });
      await refreshPanel(voiceCh, target, data);
    }
  }
  } catch (err) {
    console.error('interactionCreate:', err);
    try {
      const payload = { embeds: [errorEmbed('Error', 'Something went wrong. Try again.')], ephemeral: true };
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
      }
    } catch (_) { /* ignore */ }
  }
});

const startApiServer = require('./api/server');

client.login(process.env.DISCORD_TOKEN).then(() => {
  if (process.env.EXPRESS_PORT || process.env.OAUTH2_CLIENT_SECRET) {
    try {
      startApiServer(client);
    } catch (e) {
      console.error('Failed to start API Server:', e);
    }
  }
});
