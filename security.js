const fs = require('fs');
const path = require('path');
const { EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');

const SEC_DB_PATH = path.join(__dirname, 'security-config.json');

const defaultSecurityConfig = {
  antiLink: false,
  antiRaid: false,
  antiNuke: false,
  antiCaps: false,
  antiGhostPing: false,
  raidThreshold: 10,
  nukeThreshold: 5,
  quarantineRoleId: null,
  lockdownActive: false,
  whitelistedChannels: [],
  whitelistedRoles: []
};

function loadSecurityConfig(guildId) {
  let db = {};
  if (fs.existsSync(SEC_DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(SEC_DB_PATH, 'utf8')); } catch {}
  }
  if (!db[guildId]) db[guildId] = { ...defaultSecurityConfig };
  
  for (const key in defaultSecurityConfig) {
      if (db[guildId][key] === undefined) {
          db[guildId][key] = defaultSecurityConfig[key];
      }
  }
  return db[guildId];
}

function saveSecurityConfig(guildId, config) {
  let db = {};
  if (fs.existsSync(SEC_DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(SEC_DB_PATH, 'utf8')); } catch {}
  }
  db[guildId] = config;
  fs.writeFileSync(SEC_DB_PATH, JSON.stringify(db, null, 2));
}

// Memory tracking
const joinTracker = new Map();
const nukeTracker = new Map();
const panicTracker = new Map();

async function quarantineUser(guild, user, reason) {
  const config = loadSecurityConfig(guild.id);
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (config.quarantineRoleId) {
    const role = guild.roles.cache.get(config.quarantineRoleId);
    if (role) {
      try { await member.roles.add(role); } catch {}
      try { await member.send(`🚨 **SECURITY ALERT** 🚨\nYou have been quarantined in **${guild.name}**.\nReason: ${reason}`); } catch {}
      return;
    }
  }
  // Fallback to kick
  try { await member.send(`🚨 **SECURITY ALERT** 🚨\nYou have been kicked from **${guild.name}**.\nReason: ${reason}`); } catch {}
  try { await member.kick(`Security system: ${reason}`); } catch {}
}

async function checkAntiRaid(member) {
  const config = loadSecurityConfig(member.guild.id);
  if (!config.antiRaid) return false;

  const now = Date.now();

  // 1. Join Rate Limiter (Panic Mode) - 15 users in 30s
  let panicJoins = panicTracker.get(member.guild.id) || [];
  panicJoins.push(now);
  panicJoins = panicJoins.filter(t => now - t < 30000); // 30 seconds
  panicTracker.set(member.guild.id, panicJoins);

  if (panicJoins.length > 15 && !config.lockdownActive) {
    config.lockdownActive = true;
    saveSecurityConfig(member.guild.id, config);
    
    // Trigger Lockdown (SEND_MESSAGES: false)
    const textChannels = member.guild.channels.cache.filter(c => c.isTextBased());
    for (const [, ch] of textChannels) {
      await ch.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(()=>{});
    }
    
    try {
      const owner = await member.guild.fetchOwner();
      await owner.send(`🚨 **PANIC MODE TRIGGERED** 🚨\nMore than 15 users joined in 30 seconds in **${member.guild.name}**.\n**Lockdown state activated**: All text channels locked for @everyone.`);
    } catch {}
  }

  // 2. Account Age
  const ageMs = Date.now() - member.user.createdTimestamp;
  if (ageMs < 3 * 24 * 60 * 60 * 1000) {
    await quarantineUser(member.guild, member.user, 'Account age under 3 days (Anti-Raid)');
    return true; // Kicked/Quarantined
  }

  // 3. Standard Raid Tracker
  let joins = joinTracker.get(member.guild.id) || [];
  joins.push(now);
  joins = joins.filter(t => now - t < 10000); // 10 seconds window
  joinTracker.set(member.guild.id, joins);

  if (joins.length > config.raidThreshold) {
    await quarantineUser(member.guild, member.user, 'Mass join detected (Anti-Raid)');
    return true;
  }
  return false;
}

async function checkAntiNuke(guild, actionType, client) {
  const config = loadSecurityConfig(guild.id);
  if (!config.antiNuke) return false;

  const now = Date.now();
  if (!nukeTracker.has(guild.id)) {
    nukeTracker.set(guild.id, { bans: [], channels: [], roles: [] });
  }
  
  const tracker = nukeTracker.get(guild.id);
  if (!tracker[actionType]) tracker[actionType] = [];
  tracker[actionType].push(now);
  tracker[actionType] = tracker[actionType].filter(t => now - t < 10000); // 10s window
  
  if (tracker[actionType].length > config.nukeThreshold) {
    let logType;
    if (actionType === 'bans') logType = AuditLogEvent.MemberBanAdd;
    else if (actionType === 'channels') logType = AuditLogEvent.ChannelDelete;
    else if (actionType === 'roles') logType = AuditLogEvent.RoleDelete;

    let culprit = null;
    try {
      if (logType) {
        const logs = await guild.fetchAuditLogs({ limit: 1, type: logType });
        const entry = logs.entries.first();
        if (entry && entry.executor && entry.executor.id !== client.user.id) {
           culprit = entry.executor;
           await quarantineUser(guild, culprit, `Mass ${actionType} detected (Anti-Nuke)`);
        }
      }
    } catch {}

    try {
      const owner = await guild.fetchOwner();
      let alertMsg = `🚨 **ANTI-NUKE TRIGGERED** 🚨\nMass **${actionType}** detected in **${guild.name}**!`;
      if (culprit) alertMsg += `\nCulprit detected: ${culprit.tag} (${culprit.id}) - They have been neutralized.`;
      else alertMsg += `\nPlease check your audit logs immediately!`;
      await owner.send(alertMsg);
    } catch {}
    
    tracker[actionType] = [];
    return true;
  }
  return false;
}

function checkSecurityText(message, config) {
  const content = message.content;
  if (config.antiLink && /(https?:\/\/[^\s]+)/gi.test(content)) {
     if (!/(tenor\.com|giphy\.com)/gi.test(content)) return 'Unauthorized Link';
  }
  if (config.antiCaps) {
     const capsLength = content.replace(/[^A-Z]/g, '').length;
     const totalLength = content.replace(/[^a-zA-Z]/g, '').length;
     if (totalLength > 10 && (capsLength / totalLength) > 0.7) return 'Excessive Caps';
  }
  return null;
}

function statusString(val) {
  return val ? '🟢 **ONLINE**' : '🔴 **OFFLINE**';
}

function securityStatusEmbed(guild, config, client) {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Elite Security', iconURL: client.user.displayAvatarURL() })
    .setTitle('🛡️ Security Engine Dashboard')
    .setDescription('Advanced protective countermeasures are strictly enforced.')
    .addFields(
      { name: '🔗 Anti-Link', value: statusString(config.antiLink), inline: true },
      { name: '⚔️ Anti-Raid', value: statusString(config.antiRaid), inline: true },
      { name: '☢️ Anti-Nuke', value: statusString(config.antiNuke), inline: true },
      { name: '🔠 Anti-Caps', value: statusString(config.antiCaps), inline: true },
      { name: '👻 Anti-Ghost Ping', value: statusString(config.antiGhostPing), inline: true },
      { name: '\u200B', value: '\u200B', inline: true }, // Spacer
      { name: '⚙️ Engine Parameters', value: `Raid Limit: **${config.raidThreshold} joins/10s**\nNuke Limit: **${config.nukeThreshold} acts/10s**\nQuarantine Role: ${config.quarantineRoleId ? `<@&${config.quarantineRoleId}>` : '`None (Kick fallback)`'}`, inline: false }
    )
    .setFooter({ text: `System Kernel · Guild ${guild.id}` })
    .setTimestamp();
}

module.exports = {
  loadSecurityConfig,
  saveSecurityConfig,
  checkAntiRaid,
  checkAntiNuke,
  checkSecurityText,
  securityStatusEmbed,
  quarantineUser
};
