const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename your temp voice channel')
    .addStringOption(opt =>
      opt.setName('name').setDescription('New channel name').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('limit')
    .setDescription('Set a user limit for your temp voice channel')
    .addIntegerOption(opt =>
      opt.setName('number')
        .setDescription('Max users (0 = unlimited)')
        .setMinValue(0).setMaxValue(99).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock your temp voice channel — no new users can join'),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock your temp voice channel'),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from your temp voice channel')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to kick').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer ownership of your temp voice channel')
    .addUserOption(opt =>
      opt.setName('user').setDescription('New owner').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show info about your current temp voice channel'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('✦ Registering Atlas Unit slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✦ All commands registered successfully!');
  } catch (err) {
    console.error(err);
  }
})();
