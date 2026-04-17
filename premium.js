const { EmbedBuilder } = require('discord.js');

const DEFAULT_BOOST_COLOR = 0xff73fa;
const ACCENT = 0x00e5ff;

function parseHexColor(raw, fallback) {
  if (!raw) return fallback;
  const hex = raw.trim().replace(/^#/, '');
  const n = parseInt(hex, 16);
  return Number.isNaN(n) ? fallback : n;
}

function formatBoostBody(template, member, guild) {
  const boosts = guild.premiumSubscriptionCount;
  const tier = guild.premiumTier;
  const u = member.user;
  return template
    .replace(/\{user\}/g, u.username)
    .replace(/\{username\}/g, member.displayName)
    .replace(/\{mention\}/g, `<@${u.id}>`)
    .replace(/\{server\}/g, guild.name)
    .replace(/\{boostCount\}/gi, String(boosts))
    .replace(/\{tier\}/gi, String(tier));
}

/**
 * Premium thank-you when someone boosts the server (Nitro).
 */
function buildBoostEmbed(member, guild, client) {
  const color = parseHexColor(process.env.BOOST_COLOR, DEFAULT_BOOST_COLOR);
  const logo = process.env.WELCOME_LOGO_URL;
  const defaultBody = [
    '**The server just leveled up thanks to you.**',
    '',
    `**${guild.name}** now holds **${guild.premiumSubscriptionCount}** boost${guild.premiumSubscriptionCount === 1 ? '' : 's'} · **Tier ${guild.premiumTier}**`,
    '',
    '_Atlas Unit · Elite support · Thank you_',
  ].join('\n');

  const body = process.env.BOOST_MESSAGE
    ? formatBoostBody(process.env.BOOST_MESSAGE, member, guild)
    : defaultBody;

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: '◈  ATLAS UNIT  ·  NITRO BOOST',
      iconURL: logo && logo.startsWith('http') ? logo : client.user.displayAvatarURL(),
    })
    .setTitle(`✨  ${member.displayName}  ·  New boost`)
    .setDescription(body)
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Booster', value: `${member.user.tag}`, inline: true },
      { name: 'Server tier', value: `**${guild.premiumTier}** / 3`, inline: true },
      { name: 'Total boosts', value: `**${guild.premiumSubscriptionCount}**`, inline: true }
    )
    .setFooter({ text: 'Atlas Unit · Premium' })
    .setTimestamp();
}

function serverInfoEmbed(guild, client) {
  const owner = guild.members.cache.get(guild.ownerId);
  const channels = guild.channels.cache.size;
  const text = guild.channels.cache.filter((c) => c.isTextBased()).size;
  const voice = guild.channels.cache.filter((c) => c.isVoiceBased()).size;

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: '◈  ATLAS UNIT  ·  Server intel', iconURL: client.user.displayAvatarURL() })
    .setTitle(guild.name);
  const icon = guild.iconURL({ size: 256 });
  if (icon) embed.setThumbnail(icon);
  return embed
    .setDescription(
      guild.description
        ? guild.description.slice(0, 400)
        : '_No server description._'
    )
    .addFields(
      { name: 'Owner', value: owner ? `${owner.user.tag}` : `<@${guild.ownerId}>`, inline: true },
      { name: 'Members', value: `**${guild.memberCount}**`, inline: true },
      { name: 'Boosts', value: `**${guild.premiumSubscriptionCount}** · Tier **${guild.premiumTier}**`, inline: true },
      { name: 'Channels', value: `**${channels}** (${text} text · ${voice} voice)`, inline: true },
      { name: 'Roles', value: `**${guild.roles.cache.size}**`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: `ID ${guild.id} · Atlas Unit` })
    .setTimestamp();
}

function userInfoEmbed(member, client) {
  const u = member.user;
  const roles = member.roles.cache
    .filter((r) => r.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => r.toString())
    .slice(0, 12)
    .join(' ') || '—';

  let badges = '—';
  try {
    if (u.flags?.bitfield !== undefined && u.flags.toArray().length) {
      badges = u.flags.toArray().join(' · ');
    }
  } catch (_) { /* flags may be empty until fetch */ }

  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: '◈  ATLAS UNIT  ·  Profile', iconURL: client.user.displayAvatarURL() })
    .setTitle(u.tag)
    .setThumbnail(u.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: `\`${u.id}\``, inline: true },
      { name: 'Nickname', value: member.nickname || '—', inline: true },
      { name: 'Bot', value: u.bot ? 'Yes' : 'No', inline: true },
      { name: 'Joined server', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '—', inline: true },
      { name: 'Account created', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Boosting', value: member.premiumSince ? `Since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : '—', inline: true },
      { name: `Roles (${member.roles.cache.size - 1})`, value: roles.length > 1024 ? roles.slice(0, 1020) + '…' : roles },
      { name: 'Badges', value: badges }
    )
    .setFooter({ text: 'Atlas Unit · Premium' })
    .setTimestamp();
}

module.exports = {
  buildBoostEmbed,
  serverInfoEmbed,
  userInfoEmbed,
  formatBoostBody,
};
