const {
  Client, GatewayIntentBits, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
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
};

// ─── CHANNEL TYPES ───────────────────────────────────────────────────
// label = shown in embed author (no "Room" duplication)
// name  = used in the voice channel name
function buildTypes() {
  return {
    [process.env.JTC_GAMING]:        { emoji: '🎮', label: 'Gaming Room',  name: 'Gaming'  },
    [process.env.JTC_STUDY]:         { emoji: '📚', label: 'Study Room',   name: 'Study'   },
    [process.env.JTC_MUSIC]:         { emoji: '🎵', label: 'Music Room',   name: 'Music'   },
    [process.env.JTC_CHILL]:         { emoji: '🌙', label: 'Chill Room',   name: 'Chill'   },
    [process.env.JOIN_TO_CREATE_ID]: { emoji: '🔷', label: 'Voice Room',   name: 'Room'    },
  };
}

function getChannelType(channelId) {
  const types = buildTypes();
  return types[channelId] || types[process.env.JOIN_TO_CREATE_ID];
}

// ─── EMBEDS ──────────────────────────────────────────────────────────
function successEmbed(title, desc) {
  return new EmbedBuilder().setColor(CYAN)
    .setTitle(`✦ ${title}`).setDescription(desc)
    .setFooter({ text: 'Atlas Unit · Temp Voice System' });
}
function errorEmbed(title, desc) {
  return new EmbedBuilder().setColor(RED)
    .setTitle(`✦ ${title}`).setDescription(desc)
    .setFooter({ text: 'Atlas Unit · Temp Voice System' });
}
function infoEmbed(title, desc) {
  return new EmbedBuilder().setColor(SILVER)
    .setTitle(`✦ ${title}`).setDescription(desc)
    .setFooter({ text: 'Atlas Unit · Temp Voice System' });
}

// ─── PANEL ───────────────────────────────────────────────────────────
function buildPanel(member, data) {
  const type = data.type || { emoji: '🔷', label: 'Voice Room', name: 'Room' };
  const GIF  = process.env.BANNER_GIF_URL;

  const embed = new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({
      name: `◈  ATLAS UNIT  ·  ${type.emoji} ${type.label}`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (GIF && GIF.startsWith('http')) {
    embed.setImage(GIF);
  } else {
    // Fallback if no GIF: show owner info as fields
    const status = data.status === 'locked' ? '🔒 Locked' : '🔓 Open';
    const limit  = data.limit  === 0        ? 'Unlimited' : `${data.limit} users`;
    embed
      .setTitle(`Welcome, ${member.displayName}`)
      .setDescription('Use the buttons below to manage your channel.')
      .addFields(
        { name: 'Owner',  value: `${member}`, inline: true },
        { name: 'Status', value: status,      inline: true },
        { name: 'Limit',  value: limit,       inline: true },
      );
  }

  return embed;
}

// ─── BUTTONS ─────────────────────────────────────────────────────────
function buildRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_rename').setLabel('Rename').setEmoji(E.rename).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_limit').setLabel('Set Limit').setEmoji({ name: '⚙️' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_lock').setLabel('Lock').setEmoji(E.lock).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_unlock').setLabel('Unlock').setEmoji(E.unlock).setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_kick').setLabel('Kick').setEmoji(E.kick).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_transfer').setLabel('Transfer').setEmoji(E.transfer).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_info').setLabel('Info').setEmoji(E.info).setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

async function refreshPanel(channel, member, data) {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const panelMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (panelMsg) await panelMsg.edit({ embeds: [buildPanel(member, data)], components: buildRows() });
  } catch {}
}

// ─── READY ───────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`✦ Atlas Unit online as ${client.user.tag}`);
  console.log(`✦ GIF URL: ${process.env.BANNER_GIF_URL || 'NOT SET — using fallback'}`);
  client.user.setActivity('voice channels', { type: 3 });
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
        type: 2,
        parent: category,
        permissionOverwrites: [{
          id: member.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
          ],
        }],
      });

      const channelData = { ownerId: member.id, guildId: guild.id, status: 'open', limit: 0, type };
      tempChannels.set(newChannel.id, channelData);
      await member.voice.setChannel(newChannel);
      await newChannel.send({ embeds: [buildPanel(member, channelData)], components: buildRows() });

    } catch (err) {
      console.error('Failed to create temp channel:', err);
    }
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

  if (interaction.isButton()) {
    const member  = interaction.member;
    const voiceCh = member.voice?.channel;
    const data    = voiceCh ? tempChannels.get(voiceCh.id) : null;
    const isOwner = data && data.ownerId === member.id;

    async function deny(msg) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', msg)], ephemeral: true });
    }

    if (interaction.customId === 'btn_rename') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('Rename Your Channel');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('rename_input').setLabel('New channel name')
          .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(32)
          .setPlaceholder('e.g. Squad Gaming').setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_limit') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_limit').setTitle('Set User Limit');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('limit_input').setLabel('Max users (0 = unlimited)')
          .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2)
          .setPlaceholder('0').setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_lock') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      data.status = 'locked';
      await interaction.reply({ embeds: [errorEmbed('Channel Locked', 'No new users can join. Press **Unlock** to open again.')], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }

    if (interaction.customId === 'btn_unlock') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      data.status = 'open';
      await interaction.reply({ embeds: [successEmbed('Channel Unlocked', 'Your channel is now open for everyone.')], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }

    if (interaction.customId === 'btn_kick') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_kick').setTitle('Kick a Member');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('kick_input').setLabel('User ID to kick')
          .setStyle(TextInputStyle.Short).setMinLength(17).setMaxLength(20)
          .setPlaceholder('Right-click user → Copy ID').setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_transfer') {
      if (!isOwner) return deny('You must be the **owner** of this channel.');
      const modal = new ModalBuilder().setCustomId('modal_transfer').setTitle('Transfer Ownership');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('transfer_input').setLabel('New owner User ID')
          .setStyle(TextInputStyle.Short).setMinLength(17).setMaxLength(20)
          .setPlaceholder('Right-click user → Copy ID').setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_info') {
      if (!voiceCh || !data) return interaction.reply({ embeds: [errorEmbed('Not a Temp Channel', 'You are not in a temp voice channel.')], ephemeral: true });
      const owner   = await interaction.guild.members.fetch(data.ownerId);
      const limit   = data.limit === 0 ? 'Unlimited' : `${data.limit} users`;
      const members = voiceCh.members.map(m => m.displayName).join(', ') || 'None';
      const status  = data.status === 'locked' ? '🔒 Locked' : '🔓 Open';
      await interaction.reply({
        embeds: [infoEmbed('Channel Info', `**${voiceCh.name}**`).addFields(
          { name: 'Owner',   value: owner.displayName, inline: true },
          { name: 'Status',  value: status,            inline: true },
          { name: 'Limit',   value: limit,             inline: true },
          { name: 'Members', value: members,           inline: false },
        )],
        ephemeral: true,
      });
    }
  }

  if (interaction.isModalSubmit()) {
    const member  = interaction.member;
    const voiceCh = member.voice?.channel;
    const data    = voiceCh ? tempChannels.get(voiceCh.id) : null;

    if (interaction.customId === 'modal_rename') {
      const name = interaction.fields.getTextInputValue('rename_input');
      await voiceCh.setName(name);
      await interaction.reply({ embeds: [successEmbed('Channel Renamed', `Your channel is now called **${name}**.`)], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }

    if (interaction.customId === 'modal_limit') {
      const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
      if (isNaN(limit) || limit < 0 || limit > 99) return interaction.reply({ embeds: [errorEmbed('Invalid Limit', 'Enter a number between 0 and 99.')], ephemeral: true });
      await voiceCh.setUserLimit(limit);
      data.limit = limit;
      const display = limit === 0 ? 'unlimited' : `**${limit}** users`;
      await interaction.reply({ embeds: [successEmbed('Limit Set', `Channel limit is now ${display}.`)], ephemeral: true });
      await refreshPanel(voiceCh, member, data);
    }

    if (interaction.customId === 'modal_kick') {
      const userId = interaction.fields.getTextInputValue('kick_input').trim();
      const target = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Could not find that user ID.')], ephemeral: true });
      if (target.voice?.channelId !== voiceCh.id) return interaction.reply({ embeds: [errorEmbed('Not in Channel', 'That user is not in your channel.')], ephemeral: true });
      await target.voice.disconnect();
      await interaction.reply({ embeds: [successEmbed('Kicked', `**${target.displayName}** has been removed.`)], ephemeral: true });
    }

    if (interaction.customId === 'modal_transfer') {
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
});

client.login(process.env.DISCORD_TOKEN);
