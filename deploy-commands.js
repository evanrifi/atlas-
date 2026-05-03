const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

/** Verify token + CLIENT_ID refer to the same Discord application (common misconfiguration). */
async function verifyApplicationMatch(token, clientId) {
  const res = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: { Authorization: `Bot ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Could not verify bot token. Discord said:', data.message || res.statusText);
    return false;
  }
  if (data.id && data.id !== clientId) {
    console.error('');
    console.error('  CLIENT_ID mismatch!');
    console.error('  Your DISCORD_TOKEN belongs to application ID:', data.id);
    console.error('  But CLIENT_ID in .env is:', clientId);
    console.error('  Fix: set CLIENT_ID=' + data.id + ' in .env (Developer Portal → General → Application ID).');
    console.error('');
    return false;
  }
  return true;
}

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all bot commands (everyone can use this)'),

  // ── XP ──────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your XP rank or another member')
    .addUserOption(opt => opt.setName('user').setDescription('Member to check').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 members by XP'),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Premium server overview — boosts, members, channels'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Premium member card — roles, join date, Nitro boost')
    .addUserOption(opt => opt.setName('user').setDescription('Member (default: you)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Reaction-style role panels (dropdowns) — Boom Bot style')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('post').setDescription('Post all role panels from role-panels.json in this channel'))
    .addSubcommand(s => s.setName('reload').setDescription('Reload role-panels.json without restarting the bot')),

  new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Set a member\'s XP (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('XP amount').setMinValue(0).setRequired(true)),

  new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset a member\'s XP to 0 (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true)),

  // ── MODERATION ───────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(opt => opt.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Check a member\'s warnings')
    .addUserOption(opt => opt.setName('user').setDescription('Member to check').setRequired(false)),

  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clear all warnings for a member (Mod only)')
    .addUserOption(opt => opt.setName('user').setDescription('Member to clear').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addword')
    .setDescription('Add a word to the banned list (Mod only)')
    .addStringOption(opt => opt.setName('word').setDescription('Word to ban').setRequired(true)),

  new SlashCommandBuilder()
    .setName('removeword')
    .setDescription('Remove a word from the banned list (Mod only)')
    .addStringOption(opt => opt.setName('word').setDescription('Word to remove').setRequired(true)),

  new SlashCommandBuilder()
    .setName('wordlist')
    .setDescription('Show all banned words (Mod only)'),

  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Welcome message tools (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('preview').setDescription('Preview the welcome card in this channel')
    ),

  // ── SECURITY ───────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('security')
    .setDescription('Advanced server security settings (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('View current security settings'))
    .addSubcommand(sub => 
      sub.setName('toggle')
      .setDescription('Toggle a security feature')
      .addStringOption(opt => 
        opt.setName('feature')
        .setDescription('Feature to toggle')
        .setRequired(true)
        .addChoices(
          { name: 'Anti-Link', value: 'antiLink' },
          { name: 'Anti-Raid (Mass join/New accounts)', value: 'antiRaid' },
          { name: 'Anti-Nuke (Mass bans/deletions)', value: 'antiNuke' },
          { name: 'Anti-Caps', value: 'antiCaps' },
          { name: 'Anti-Ghost Ping', value: 'antiGhostPing' }
        )
      )
    )
    .addSubcommand(sub => 
      sub.setName('setquarantine')
      .setDescription('Set the role used to quarantine threats')
      .addRoleOption(opt => opt.setName('role').setDescription('Quarantine Role').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('setup-verification')
      .setDescription('Deploy a captcha verification panel for new users')
    )
    .addSubcommand(sub => 
      sub.setName('setup-ticket')
      .setDescription('Deploy a smart ticket panel in this channel')
    ),

  new SlashCommandBuilder()
    .setName('alt-check')
    .setDescription('Check a user\'s associated IP/Fingerprint (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)),

  new SlashCommandBuilder()
    .setName('alt-blacklist')
    .setDescription('Manually blacklist a user\'s IP/Fingerprint (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('Target user to blacklist').setRequired(true)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7)),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('user_id').setDescription('Banned user ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes (1-40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a member\'s timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk-delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('How many messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Only messages from this user').setRequired(false)),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('Delay between messages (0 = off)').setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member\'s nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave empty to reset)').setMaxLength(32)),

  new SlashCommandBuilder()
    .setName('secret-chat')
    .setDescription('Create a self-destructing secret channel with another user')
    .addUserOption(opt => opt.setName('user').setDescription('The user to invite').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Minutes until self-destruct (1-60)').setMinValue(1).setMaxValue(60).setRequired(true)),

  new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Server economy and shop commands')
    .addSubcommand(sub => sub.setName('balance').setDescription('Check your or another user\'s balance')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('shop').setDescription('View the server shop'))
    .addSubcommand(sub => sub.setName('buy').setDescription('Buy an item from the shop')
      .addStringOption(o => o.setName('item').setDescription('The ID of the item').setRequired(true)))
    .addSubcommand(sub => sub.setName('addmoney').setDescription('[ADMIN] Add money to a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true))),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play high-quality music via Lavalink')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View the current music queue'),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show details of the currently playing song'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the music playback'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the music playback'),
    
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the current music and disconnect the bot')
].map(cmd => cmd.toJSON());

(async () => {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
    process.exit(1);
  }

  try {
    const ok = await verifyApplicationMatch(token, clientId);
    if (!ok) process.exit(1);

    const rest = new REST({ version: '10' }).setToken(token);
    const names = commands.map((c) => c.name).filter(Boolean);
    console.log(`✦ Registering ${commands.length} slash commands to guild ${guildId}...`);
    console.log('  Commands:', names.join(', '));

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

    console.log('✦ Done.');
  } catch (err) {
    console.error('Deploy failed:', err.message || err);
    process.exit(1);
  }
})();
