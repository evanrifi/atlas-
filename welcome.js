const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

/** Electric cyan + gunmetal palette (matches ATLAS ULTIMATE branding) */
const DEFAULT_ACCENT = 0x00e5ff;

const LOCAL_LOGO = path.join(__dirname, 'assets', 'welcome-logo.png');

/**
 * Probot-style placeholders: {user} {username} {usertag} {mention} {server}
 * {memberCount} {created} {createdRelative}
 */
function formatWelcomeText(text, member, guild) {
  if (!text) return '';
  const u = member.user;
  const createdMs = u.createdTimestamp;
  const createdSec = Math.floor(createdMs / 1000);
  return text
    .replace(/\{user\}/g, u.username)
    .replace(/\{username\}/g, member.displayName)
    .replace(/\{usertag\}/g, u.tag)
    .replace(/\{mention\}/g, `<@${u.id}>`)
    .replace(/\{server\}/g, guild.name)
    .replace(/\{memberCount\}/gi, String(guild.memberCount))
    .replace(/\{created\}/g, `<t:${createdSec}:D>`)
    .replace(/\{createdRelative\}/g, `<t:${createdSec}:R>`);
}

function parseAccentColor() {
  const raw = process.env.WELCOME_COLOR;
  if (!raw) return DEFAULT_ACCENT;
  const hex = raw.trim().replace(/^#/, '');
  const n = parseInt(hex, 16);
  return Number.isNaN(n) ? DEFAULT_ACCENT : n;
}

/**
 * Rich welcome embed: author bar, title, body, member thumbnail, stats row, footer.
 */
function buildWelcomeEmbed(member, guild, client) {
  const accent = parseAccentColor();
  const title = formatWelcomeText(
    process.env.WELCOME_TITLE || '◆ Welcome to {server}',
    member,
    guild
  );

  const defaultBody = [
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '{mention}  ·  **Access granted.**',
    '',
    'Read the rules, grab your roles, and settle in.',
    '',
    'You are member **{memberCount}**.',
    '',
    '_ATLAS ULTIMATE · precision · community_',
  ].join('\n');

  const body = formatWelcomeText(process.env.WELCOME_BODY || defaultBody, member, guild);

  const logoUrl = process.env.WELCOME_LOGO_URL;
  const bannerUrl = process.env.WELCOME_BANNER_URL;
  const authorIcon = logoUrl && logoUrl.startsWith('http') ? logoUrl : client.user.displayAvatarURL({ size: 128 });

  const embed = new EmbedBuilder()
    .setColor(accent)
    .setAuthor({ name: '◈  ATLAS ULTIMATE  ·  WELCOME', iconURL: authorIcon })
    .setTitle(title)
    .setDescription(body)
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: 'Account',
        value: formatWelcomeText('{createdRelative}', member, guild),
        inline: true,
      },
      {
        name: 'Members',
        value: `\`${guild.memberCount}\``,
        inline: true,
      },
      {
        name: 'User',
        value: `\`${member.user.username}\``,
        inline: true,
      }
    )
    .setFooter({ text: 'ATLAS ULTIMATE · Verified entry' })
    .setTimestamp();

  if (bannerUrl && bannerUrl.startsWith('http')) embed.setImage(bannerUrl);

  return embed;
}

/**
 * If `assets/welcome-logo.png` exists and no WELCOME_LOGO_URL, attach file and bind author icon.
 */
function buildWelcomePayload(member, guild, client) {
  const embed = buildWelcomeEmbed(member, guild, client);
  const files = [];

  const useLocalLogo = !process.env.WELCOME_LOGO_URL && fs.existsSync(LOCAL_LOGO);
  if (useLocalLogo) {
    files.push(new AttachmentBuilder(LOCAL_LOGO, { name: 'welcome-logo.png' }));
    embed.setAuthor({
      name: '◈  ATLAS ULTIMATE  ·  WELCOME',
      iconURL: 'attachment://welcome-logo.png',
    });
  }

  return { embeds: [embed], files: files.length ? files : [] };
}

module.exports = {
  formatWelcomeText,
  buildWelcomeEmbed,
  buildWelcomePayload,
};
