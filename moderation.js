const { EmbedBuilder } = require('discord.js');

const CYAN = 0x1dc9d8;

/**
 * Returns an error string if the actor cannot moderate `target`, else null.
 */
function hierarchyBlock(actor, target) {
  if (!target) return 'That member was not found.';
  if (target.id === actor.id) return 'You cannot use this on yourself.';
  if (target.id === actor.client.user.id) return 'You cannot moderate the bot.';
  if (target.id === actor.guild.ownerId) return 'You cannot moderate the server owner.';
  if (!target.manageable) return 'I cannot moderate this member.';
  if (actor.id !== actor.guild.ownerId) {
    if (target.roles.highest.position >= actor.roles.highest.position) {
      return 'Your highest role must be above the target member.';
    }
  }
  return null;
}

function modLogEmbed({ action, moderator, targetUser, targetTag, reason, extra }) {
  const icon = moderator.client.user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({ name: `◈ Atlas Unit · ${action}`, iconURL: icon })
    .addFields(
      { name: 'Moderator', value: `${moderator}`, inline: true },
      { name: 'Target', value: targetUser ? `${targetUser} (\`${targetUser.id}\`)` : `\`${targetTag || 'Unknown'}\``, inline: true },
    )
    .setTimestamp();
  if (reason) embed.addFields({ name: 'Reason', value: reason, inline: false });
  if (extra) embed.addFields({ name: 'Details', value: extra, inline: false });
  return embed;
}

async function sendModLog(guild, embed) {
  const id = process.env.MOD_LOG_CHANNEL_ID;
  if (!id) return;
  const ch = guild.channels.cache.get(id);
  if (ch?.isTextBased()) await ch.send({ embeds: [embed] }).catch(() => {});
}

/** Bulk-delete up to `amount` messages; optional filter by author ID. Respects 14-day limit. */
async function purgeMessages(channel, amount, userFilterId) {
  const collected = [];
  let before;
  const maxAge = 13 * 24 * 60 * 60 * 1000;
  while (collected.length < amount) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    const sorted = [...batch.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    const recent = sorted.filter((m) => Date.now() - m.createdTimestamp <= maxAge);
    if (recent.length === 0) break;
    for (const m of recent) {
      if (userFilterId && m.author.id !== userFilterId) continue;
      collected.push(m);
      if (collected.length >= amount) break;
    }
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  if (collected.length === 0) return 0;
  const ids = collected.slice(0, amount).map((m) => m.id);
  for (let i = 0; i < ids.length; i += 100) {
    await channel.bulkDelete(ids.slice(i, i + 100));
  }
  return collected.length;
}

module.exports = {
  hierarchyBlock,
  modLogEmbed,
  sendModLog,
  purgeMessages,
  CYAN,
};
