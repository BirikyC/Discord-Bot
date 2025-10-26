const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const MESSAGE = 'Szuszekcwel';
const INTERVAL = 15 * 60 * 1000; // co 15 minut

client.once('ready', () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}!`);

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error('❌ Nie znaleziono kanału! Sprawdź ID.');
    return;
  }

  channel.send(MESSAGE);

  setInterval(() => {
    channel.send(MESSAGE);
  }, INTERVAL);
});

client.login(TOKEN);
