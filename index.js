const {
  Client, GatewayIntentBits, PermissionFlagsBits, Events, ActivityType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
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
  return new EmbedBuilder().setColor(CYAN).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'Atlas Unit' });
}
function errorEmbed(title, desc) {
  return new EmbedBuilder().setColor(RED).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'Atlas Unit' });
}
function infoEmbed(title, desc) {
  return new EmbedBuilder().setColor(SILVER).setTitle(`✦ ${title}`).setDescription(desc).setFooter({ text: 'Atlas Unit' });
}

function buildPanel(member, data) {
  const type = data.type || { emoji: '🔷', label: 'Voice Room' };
  const GIF  = process.env.BANNER_GIF_URL;
  const embed = new EmbedBuilder().setColor(CYAN)
    .setAuthor({ name: `◈  ATLAS UNIT  ·  ${type.emoji} ${type.label}`, iconURL: client.user.displayAvatarURL() });
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
    try { await member.kick(`Atlas Unit AutoMod: 3 warnings — ${reason}`); } catch {}
  }
  return warnCount;
}

// ─── READY ───────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`✦ Atlas Unit online as ${client.user.tag}`);
  client.user.setActivity('new members', { type: ActivityType.Watching });
});

// ─── WELCOME (Probot-style, branded) ─────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    if (process.env.GUILD_ID && member.guild.id !== process.env.GUILD_ID) return;
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

// ─── MESSAGE — AUTOMOD ONLY (no prefix commands) ──────────────────────
const XP_COOLDOWN = 60 * 1000;

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const member  = message.member;
  const content = message.content.toLowerCase();
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!isStaff) {
    const banned = loadBannedWords(message.guild.id);
    const hit    = banned.find(w => content.includes(w.toLowerCase()));
    if (hit) { await message.delete().catch(() => {}); await issueWarn(member, 'Banned word detected', client); return; }
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
  if (newStats.level > oldLevel) {
    const lvlCh = message.guild.channels.cache.get(process.env.LEVEL_UP_CHANNEL_ID) || message.channel;
    await lvlCh.send({ content: `${message.author}`, embeds: [levelUpEmbed(message.member, newStats.level, newStats.needed, client)] });
    await assignRoles(message.member, newStats.level);
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
        .setTitle('✦ Atlas Unit — Command list')
        .setDescription(
          [
            '**Everyone** (should appear in `/` for all members)',
            '`/help` · `/rank` · `/leaderboard` · `/serverinfo` · `/userinfo`',
            '',
            '**Mods** (Manage Messages)',
            '`/warn` · `/warns` · `/clearwarns` · `/addword` · `/removeword` · `/wordlist`',
            '',
            '**Administrators only** — Discord **hides** these in the `/` menu unless your account has **Administrator** (or owner)',
            '`/roles` (post/reload panels) · `/kick` · `/ban` · `/unban` · `/mute` · `/unmute` · `/clear` · `/slowmode` · `/lock` · `/unlock` · `/nick` · `/welcome` · `/setxp` · `/resetxp`',
            '',
            '**No commands at all?** Run `npm run deploy` on the PC where the bot project lives. `GUILD_ID` in `.env` must be **this** server\'s ID. Re-open Discord or press **Ctrl+R**.',
          ].join('\n')
        )
        .setFooter({ text: 'Atlas Unit' });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
      }
      const target = interaction.options.getMember('user');
      const hb = hierarchyBlock(member, target);
      if (hb) return interaction.reply({ embeds: [errorEmbed('Cannot unmute', hb)], ephemeral: true });
      await target.timeout(null, 'Timeout removed');
      await sendModLog(guild, modLogEmbed({ action: 'Unmute', moderator: member, targetUser: target.user, reason: 'Timeout removed' }));
      return interaction.reply({ embeds: [successEmbed('Unmuted', `Timeout removed for **${target.user.tag}**.`)] });
    }

    if (commandName === 'clear') {
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
      if (!isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('No Permission', 'Only **Administrators** can use this command.')], ephemeral: true });
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
        return interaction.reply({ embeds: [successEmbed('Reloaded', '**data/role-panels.json** has been reloaded.')], ephemeral: true });
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
  }

  // ── ROLE PANELS (select menu → roles) ───────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('au_rr:')) {
    await handleRolePanelSelect(interaction);
    return;
  }

  // ── BUTTONS ────────────────────────────────────────────────────
  if (interaction.isButton()) {
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

client.login(process.env.DISCORD_TOKEN);
