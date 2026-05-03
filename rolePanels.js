const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const DATA_PATH = path.join(__dirname, 'role-panels.json');

let cache = null;

function loadRolePanels() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    cache = { guilds: {} };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!cache.guilds) cache.guilds = {};
  } catch {
    cache = { guilds: {} };
  }
  return cache;
}

function reloadRolePanels() {
  cache = null;
  return loadRolePanels();
}

function getPanelsForGuild(guildId) {
  const db = cache ?? loadRolePanels();
  const g = db.guilds[guildId] || db.guilds.default;
  if (!g || !Array.isArray(g.panels)) return [];
  return g.panels;
}

function getPanel(guildId, panelId) {
  return getPanelsForGuild(guildId).find((p) => p.id === panelId) || null;
}

/** Fallback accent when a panel omits `color` (deep violet) */
const DEFAULT_PANEL_COLOR = 0x6d28d9;

function buildPanelPayload(panel, guild, client) {
  const color = typeof panel.color === 'number' ? panel.color : DEFAULT_PANEL_COLOR;
  const lines =
    panel.bodyLines && panel.bodyLines.length
      ? panel.bodyLines
      : panel.options.map((o) => `\`${o.emoji || '▫'}\` **${o.label}**`);

  const quoted = lines.map((line) => {
    const t = line.replace(/^\s*>\s?/, '');
    return `> ${t}`;
  });

  const parts = [];
  if (panel.description) parts.push(`**${panel.description}**`);
  if (quoted.length) {
    if (parts.length) parts.push('');
    parts.push(quoted.join('\n'));
  }
  const desc = (parts.length ? parts.join('\n') : '> _Pick a role from the menu below._').slice(0, 4096);

  const icon = client.user.displayAvatarURL({ size: 256 });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'ATLAS ULTIMATE', iconURL: icon })
    .setTitle(panel.title || 'Roles')
    .setDescription(desc)
    .setFooter({ text: 'ATLAS ULTIMATE' })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`au_rr:${panel.id}`)
    .setPlaceholder(panel.placeholder || 'Choose a role')
    .setMinValues(1)
    .setMaxValues(1);

  for (const opt of panel.options) {
    const role = guild.roles.cache.get(opt.roleId);
    menu.addOptions({
      label: opt.label.slice(0, 100),
      value: opt.roleId,
      description: opt.description ? opt.description.slice(0, 100) : undefined,
      emoji: opt.emoji || undefined,
    });
    if (!role) {
      console.warn(`[role-panels] Missing role ${opt.roleId} for panel "${panel.id}" in ${guild.name}`);
    }
  }

  const row = new ActionRowBuilder().addComponents(menu);
  return { embeds: [embed], components: [row] };
}

/**
 * Post all panels for this guild into a channel.
 */
async function postRolePanels(channel, guild, client) {
  const panels = getPanelsForGuild(guild.id);
  if (!panels.length) {
    throw new Error(
      'No panels for this server. Copy role-panels.example.json to role-panels.json and set your role IDs.'
    );
  }
  let n = 0;
  for (const panel of panels) {
    if (!panel.id || !panel.options?.length) continue;
    if (panel.options.length > 25) {
      console.warn(`[role-panels] Panel "${panel.id}" has more than 25 options — Discord limit.`);
    }
    const payload = buildPanelPayload(panel, guild, client);
    await channel.send(payload);
    n++;
  }
  return n;
}

/**
 * Handle StringSelectMenu for role panels.
 */
async function handleRolePanelSelect(interaction) {
  const panelId = interaction.customId.replace(/^au_rr:/, '');
  const panel = getPanel(interaction.guild.id, panelId);
  if (!panel) {
    await interaction.reply({
      content: 'This role panel is outdated. Ask an admin to run `/roles post` again.',
      ephemeral: true,
    });
    return;
  }

  const roleId = interaction.values[0];
  const allowed = new Set(panel.options.map((o) => o.roleId));
  if (!allowed.has(roleId)) {
    await interaction.reply({ content: 'Invalid selection.', ephemeral: true });
    return;
  }

  const member = interaction.member;
  const targetRole = interaction.guild.roles.cache.get(roleId);
  if (!targetRole) {
    await interaction.reply({ content: 'That role no longer exists. Tell an admin.', ephemeral: true });
    return;
  }

  const me = interaction.guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: 'I need **Manage Roles** permission.', ephemeral: true });
    return;
  }
  if (targetRole.position >= me.roles.highest.position) {
    await interaction.reply({
      content: 'My highest role must be **above** the roles I assign. Move the bot role up.',
      ephemeral: true,
    });
    return;
  }

  const exclusive = panel.exclusive !== false;
  try {
    if (exclusive) {
      for (const opt of panel.options) {
        if (member.roles.cache.has(opt.roleId)) {
          await member.roles.remove(opt.roleId);
        }
      }
    } else if (member.roles.cache.has(targetRole.id)) {
      await interaction.reply({
        content: `You already have **${targetRole.name}**. Open the menu again to add another game.`,
        ephemeral: true,
      });
      return;
    }
    await member.roles.add(targetRole);
    await interaction.reply({
      content: `**${targetRole.name}** has been assigned to you.`,
      ephemeral: true,
    });
  } catch (e) {
    console.error('role panel assign:', e);
    await interaction.reply({
      content: 'Could not update your roles. Check that my role is above these roles.',
      ephemeral: true,
    });
  }
}

module.exports = {
  loadRolePanels,
  reloadRolePanels,
  getPanelsForGuild,
  getPanel,
  postRolePanels,
  handleRolePanelSelect,
};
