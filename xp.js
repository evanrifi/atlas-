const { EmbedBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'xp-data.json');

// ─── XP FORMULA ─────────────────────────────────────────────────────
// XP needed to reach level N = 100 * N * 1.5
function xpForLevel(level) {
  return Math.floor(100 * level * 1.5);
}

function getLevelFromXP(totalXP) {
  let level = 0;
  let xp    = totalXP;
  while (xp >= xpForLevel(level + 1)) {
    xp -= xpForLevel(level + 1);
    level++;
  }
  return { level, currentXP: xp, needed: xpForLevel(level + 1) };
}

// ─── DATABASE (JSON file) ────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(db, guildId, userId) {
  if (!db[guildId])               db[guildId] = {};
  if (!db[guildId][userId])       db[guildId][userId] = { xp: 0, lastMessage: 0 };
  return db[guildId][userId];
}

// ─── LEVEL ROLES ────────────────────────────────────────────────────
// Set these role IDs in your .env file
const LEVEL_ROLES = [
  { level: 5,  envKey: 'ROLE_LEVEL_5'  },
  { level: 10, envKey: 'ROLE_LEVEL_10' },
  { level: 20, envKey: 'ROLE_LEVEL_20' },
  { level: 50, envKey: 'ROLE_LEVEL_50' },
];

async function assignRoles(member, newLevel) {
  for (const { level, envKey } of LEVEL_ROLES) {
    const roleId = process.env[envKey];
    if (!roleId) continue;
    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;
    if (newLevel >= level && !member.roles.cache.has(roleId)) {
      await member.roles.add(role).catch(() => {});
    }
  }
}

// ─── LEVEL UP EMBED ─────────────────────────────────────────────────
function levelUpEmbed(member, newLevel, needed, client) {
  const milestones = LEVEL_ROLES.map(r => r.level);
  const isMilestone = milestones.includes(newLevel);

  return new EmbedBuilder()
    .setColor(isMilestone ? 0xf0c13e : 0x1dc9d8)
    .setAuthor({
      name: '◈  ATLAS ULTIMATE  ·  Level Up',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(isMilestone ? `⭐ ${member.displayName} reached Level ${newLevel}!` : `✦ ${member.displayName} leveled up!`)
    .setDescription(
      isMilestone
        ? `You've hit a milestone — **Level ${newLevel}**!\nA new role has been assigned to you. 🔷`
        : `You are now **Level ${newLevel}**.\nKeep chatting to reach the next level!`
    )
    .addFields(
      { name: 'Level',    value: `**${newLevel}**`,          inline: true },
      { name: 'Next level', value: `**${needed} XP** needed`, inline: true },
    )
    .setFooter({ text: 'ATLAS ULTIMATE · XP System' })
    .setTimestamp();
}

// ─── RANK EMBED ─────────────────────────────────────────────────────
function rankEmbed(member, { level, currentXP, needed }, totalXP, rank, client) {
  const barTotal = 20;
  const filled   = Math.round((currentXP / needed) * barTotal);
  const bar      = '█'.repeat(filled) + '░'.repeat(barTotal - filled);

  return new EmbedBuilder()
    .setColor(0x1dc9d8)
    .setAuthor({
      name: '◈  ATLAS ULTIMATE  ·  XP Rank',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(`${member.displayName}'s Rank`)
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Rank',     value: `**#${rank}**`,              inline: true },
      { name: 'Level',    value: `**${level}**`,              inline: true },
      { name: 'Total XP', value: `**${totalXP} XP**`,         inline: true },
      { name: `Progress  ${currentXP}/${needed} XP`, value: `\`${bar}\`` },
    )
    .setFooter({ text: 'ATLAS ULTIMATE · XP System' })
    .setTimestamp();
}

// ─── LEADERBOARD EMBED ──────────────────────────────────────────────
function leaderboardEmbed(entries, client) {
  const medals = ['🥇','🥈','🥉'];
  const lines  = entries.map((e, i) =>
    `${medals[i] || `**${i+1}.**`}  ${e.name}  ·  Level **${e.level}**  ·  **${e.xp} XP**`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x1dc9d8)
    .setAuthor({
      name: '◈  ATLAS ULTIMATE  ·  Leaderboard',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('Top Members')
    .setDescription(lines || 'No data yet.')
    .setFooter({ text: 'ATLAS ULTIMATE · XP System' })
    .setTimestamp();
}

module.exports = {
  loadDB, saveDB, getUser,
  getLevelFromXP, xpForLevel,
  assignRoles, levelUpEmbed,
  rankEmbed, leaderboardEmbed,
};
