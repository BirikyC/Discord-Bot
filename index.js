const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Bot działa!'));
app.listen(PORT, () => console.log(`Server nasłuchuje na porcie ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const MESSAGE = 'Szuszekcwel poraz';
const INTERVAL = 5 * 60 * 1000; // co 5 minut

function read_counter() {
  try {
    const data = fs.readFileSync('counter.json', 'utf8');
    return JSON.parse(data).count || 0;
  } catch (err) {
    return 0;
  }
}

function write_counter(count) {
  fs.writeFileSync('counter.json', JSON.stringify({ count }));
}

let counter = read_counter();

client.once('ready', () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}!`);

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error('❌ Nie znaleziono kanału! Sprawdź ID.');
    return;
  }

  const sendMessage = () => {
    counter++;
    channel.send(`${MESSAGE} ${counter}.`);
    write_counter(counter);
  };

  // na starcie wyslanie wiadomosci
  sendMessage();

  // cykliczne wysylanie wiadomosci
  setInterval(sendMessage, INTERVAL);
});

client.login(TOKEN);
