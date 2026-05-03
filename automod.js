const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const WARN_DB_PATH = path.join(__dirname, 'warn-data.json');

// ─── WARN DATABASE ───────────────────────────────────────────────────
function loadWarns() {
  if (!fs.existsSync(WARN_DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(WARN_DB_PATH, 'utf8')); } catch { return {}; }
}
function saveWarns(db) {
  fs.writeFileSync(WARN_DB_PATH, JSON.stringify(db, null, 2));
}
function getWarns(db, guildId, userId) {
  if (!db[guildId])         db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = { warns: [], count: 0 };
  return db[guildId][userId];
}

// ─── WORD FILTER (REGEX SUPPORTED) ───────────────────────────────────
// Add/remove words here or manage via !addword / !removeword commands
const DEFAULT_BANNED_WORDS = [
  'nigg[a|er]', 'faggot', 'retard', 'k[i1]ll\\s*y[o0]urself',
  'free\\s*nitro', 'discord\\.gift\\/'
];

function loadBannedWords(guildId) {
  const filePath = path.join(__dirname, `banned-words-${guildId}.json`);
  if (!fs.existsSync(filePath)) return [...DEFAULT_BANNED_WORDS];
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return [...DEFAULT_BANNED_WORDS]; }
}
function saveBannedWords(guildId, words) {
  const filePath = path.join(__dirname, `banned-words-${guildId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(words, null, 2));
}

// ─── SPAM TRACKER ────────────────────────────────────────────────────
// Map<userId, { count, lastTime }>
const spamTracker = new Map();
const SPAM_THRESHOLD  = 5;   // messages
const SPAM_WINDOW_MS  = 4000; // within 4 seconds

function checkSpam(userId) {
  const now  = Date.now();
  const data = spamTracker.get(userId) || { count: 0, lastTime: 0 };
  if (now - data.lastTime > SPAM_WINDOW_MS) {
    spamTracker.set(userId, { count: 1, lastTime: now });
    return false;
  }
  data.count++;
  data.lastTime = now;
  spamTracker.set(userId, data);
  return data.count >= SPAM_THRESHOLD;
}

// ─── EMBEDS ──────────────────────────────────────────────────────────
const CYAN   = 0x1dc9d8;
const RED    = 0xe05a5a;
const AMBER  = 0xf0c13e;

function warnEmbed(member, reason, warnCount, client) {
  return new EmbedBuilder()
    .setColor(AMBER)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Auto Mod', iconURL: client.user.displayAvatarURL() })
    .setTitle(`⚠️  Warning — ${member.displayName}`)
    .setDescription(`You have been warned in **${member.guild.name}**.`)
    .addFields(
      { name: 'Reason',    value: reason,          inline: true },
      { name: 'Warnings',  value: `**${warnCount}/3**`, inline: true },
    )
    .setFooter({ text: warnCount >= 3 ? 'Final warning — next action: mute' : 'ATLAS ULTIMATE · Auto Moderation' })
    .setTimestamp();
}

function logEmbed(member, reason, warnCount, action, client) {
  const color = action === 'kick' ? RED : action === 'warn' ? AMBER : RED;
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Mod Log', iconURL: client.user.displayAvatarURL() })
    .setTitle(action === 'kick' ? '🔨  Member Kicked' : '⚠️  Member Warned')
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Member',   value: `${member} (${member.id})`, inline: false },
      { name: 'Reason',   value: reason,                     inline: true  },
      { name: 'Warnings', value: `${warnCount}/3`,           inline: true  },
      { name: 'Action',   value: action.toUpperCase(),       inline: true  },
    )
    .setFooter({ text: 'ATLAS ULTIMATE · Auto Moderation' })
    .setTimestamp();
}

function manualWarnEmbed(target, reason, warnCount, mod, client) {
  return new EmbedBuilder()
    .setColor(AMBER)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Manual Warn', iconURL: client.user.displayAvatarURL() })
    .setTitle(`⚠️  Warning Issued`)
    .addFields(
      { name: 'Member',       value: `${target} (${target.id})`, inline: false },
      { name: 'Reason',       value: reason,                      inline: true  },
      { name: 'Warnings',     value: `${warnCount}/3`,            inline: true  },
      { name: 'Warned by',    value: `${mod}`,                    inline: true  },
    )
    .setFooter({ text: 'ATLAS ULTIMATE · Auto Moderation' })
    .setTimestamp();
}

function clearWarnsEmbed(target, mod, client) {
  return new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Warnings Cleared', iconURL: client.user.displayAvatarURL() })
    .setTitle('✦  Warnings Cleared')
    .setDescription(`All warnings for **${target.displayName}** have been cleared by ${mod}.`)
    .setFooter({ text: 'ATLAS ULTIMATE · Auto Moderation' })
    .setTimestamp();
}

function warnsListEmbed(target, warns, client) {
  const lines = warns.length === 0
    ? 'No warnings.'
    : warns.map((w, i) => `**${i+1}.** ${w.reason} — <t:${Math.floor(w.time/1000)}:R>`).join('\n');
  return new EmbedBuilder()
    .setColor(AMBER)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  Warn History', iconURL: client.user.displayAvatarURL() })
    .setTitle(`⚠️  Warnings for ${target.displayName}`)
    .setDescription(lines)
    .setFooter({ text: `Total: ${warns.length}/3 · ATLAS ULTIMATE` })
    .setTimestamp();
}

module.exports = {
  loadWarns, saveWarns, getWarns,
  loadBannedWords, saveBannedWords,
  checkSpam,
  warnEmbed, logEmbed, manualWarnEmbed,
  clearWarnsEmbed, warnsListEmbed,
};
