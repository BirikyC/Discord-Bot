const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Bot działa!'));
app.listen(PORT, () => console.log(`Server nasłuchuje na porcie ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID;

const MESSAGE = 'Szuszekcwel poraz';
const SPECIAL_MESSAGE = 'Szuszek ale on ma Gyatt.';
const INTERVAL = 60 * 60 * 1000; // co godzine

function read_counter() {
  try {
    const data = fs.readFileSync('counter.json', 'utf8');
    return JSON.parse(data).count || 0;
  } catch (err) {
    return 0;
  }
}

function write_counter(count) {
  fs.writeFileSync('data/counter.json', JSON.stringify({ count }));
}

let counter = read_counter();

client.once('clientReady', () => {
  console.log(`Zalogowano jako ${client.user.tag}!`);

  // ===== Rejestracja komend =====
  (async () => {
    try {
      console.log('Rejestrowanie komend...');

      const rest = new REST({ version: '10' }).setToken(TOKEN);
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, GUILD_ID),
        { body: commands }
      );

      console.log('Komendy zarejestrowane!');
    } catch (err) {
      console.error('Błąd przy rejestracji komend:', err);
    }
  })();

  // ===== Cykliczne wysylanie wiadomosci co godzine =====
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error('Nie znaleziono kanału! Sprawdź ID.');
    return;
  }

  const sendMessage = () => {
    counter++;
    channel.send(`${MESSAGE} ${counter}.`);
    
    if(counter % 100 == 0) channel.send(`${SPECIAL_MESSAGE}`);
      
    write_counter(counter);
  };

  // zmienna nextFullHour: oznacza następna pełna godzina (np. 21:00, 22:00, itd.)
  const now = new Date();
  const nextFullHour = new Date(now);
  nextFullHour.setMinutes(0, 0, 0);
  nextFullHour.setHours(nextFullHour.getHours() + 1);

  const msUntilNextFullHour = nextFullHour - now;
  console.log(`Pierwsza wiadomosc nastapi za ${Math.round(msUntilNextFullHour / 1000)} sekund.`);

  setTimeout(() => {
    sendMessage();

    // cykliczne (co godzine) wysylanie wiadomosci
    setInterval(sendMessage, INTERVAL);
  }, msUntilNextFullHour);
});

client.login(TOKEN);

/* 
********************************* FILTROWANIE WIADOMOŚCI *********************************
*/

const WORDS_TO_FILTER = fs.readFileSync('./filter/szuszek_filter_words.txt', 'utf-8')
    .split('\n')
    .map(word => word.trim().toLocaleLowerCase())
    .filter(Boolean);
const RESPONSES_TO_FILTERED = fs.readFileSync('./filter/szuszek_filter_response.txt', 'utf-8')
    .split('\n')
    .filter(Boolean);

client.on('messageCreate', async (msg) => {
  if(msg.author.bot) return;

  const content = msg.content.toLocaleLowerCase();

  // Upewnic sie ze w wiadomosci zawarta jest wiadomosc "szuszek"
  const SZUSZEKS_TO_BE_FOUND = ["szuszek", "szuszke", "szyszka", "szuszu"];
  if(!SZUSZEKS_TO_BE_FOUND.find(word => content.includes(word))) return;

  const found_word = WORDS_TO_FILTER.find(word => content.includes(word));

  if(found_word){
    try{
      // 1/20 (5%) szans na wysłanie odpowiedzi
      let rand = Math.floor(Math.random() * 20);
      if(rand != 1) return;

      rand = Math.floor(Math.random() * RESPONSES_TO_FILTERED.length);
      const response = RESPONSES_TO_FILTERED[rand];

      await msg.channel.send(response);
    }
    catch (err){
      console.log("Error: ", err);
    }
  }
})

/* 
********************************* PONIŻEJ SKRYPT Z KOMENDAMI DLA BOTA *********************************
*/

const { REST, Routes, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');

const commands = [
  new SlashCommandBuilder()
    .setName('gyatt')
    .setDescription('Szuszek ale on ma gyatt 🗿.'),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Odpal fajna muzyke na kanale glosowym')
    .addIntegerOption(option => 
      option.setName('id')
        .setDescription('ID utworu')
        .setRequired(false)
    )
].map(cmd => cmd.toJSON());

/* 
********************************* KOMENDA: GYATT *********************************
*/

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'gyatt') {
    const GIFS_PATH = './img/gyatts';

    const gifs = fs.readdirSync(GIFS_PATH).filter(file => file.endsWith('.gif'));

    if (gifs.length === 0) {
      await interaction.reply('Brak plików GIF w folderze!');
      return;
    }

    const random_gif = gifs[Math.floor(Math.random() * gifs.length)];
    const gif_path = path.join(GIFS_PATH, random_gif);

    const attachment = new AttachmentBuilder(gif_path);

    await interaction.reply({
      content: `Szuszek ale on ma Gyatt.`,
      files: [attachment]
    });
  }
});

/* 
********************************* KOMENDA: PLAY *********************************
*/

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'play') {
    const voice_channel = interaction.member?.voice?.channel;

    if(!voice_channel){
      await interaction.reply(":x: Musisz być na kanale głosowym!");
      return;
    }

    const MUSIC_PATH = "./music";
    const files = fs.readdirSync(MUSIC_PATH).filter(file => file.endsWith(".mp3"));

    if(files.length <= 0){
      console.error(`Folder o ścieżke ${MUSIC_PATH} nie zawiera plikow .mp3`);
      return;
    }

    const id = interaction.options.getInteger('id');
    let music_file_path;

    if(id == null || id == undefined){
      const random_file = files[Math.floor(Math.random() * files.length)];
      music_file_path = path.join(MUSIC_PATH, random_file)
    }
    else{
      music_file_path = path.join(MUSIC_PATH, `${id}.mp3`);

      if(!fs.existsSync(music_file_path)){
        await interaction.reply(`Nie znaleziono pliku o id: ${id}. Aktualna ilość plików muzycznych wynosi: ${files.length}`);
        return;
      }
    }

    const connection = joinVoiceChannel({
      channelId: voice_channel.id,
      guildId: voice_channel.guild.id,
      adapterCreator: voice_channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(music_file_path);
    player.play(resource);
    connection.subscribe(player);

    await interaction.reply(`Ale to będzie banglać :moai:`);

    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    })

    player.on('error', error => {
      console.error("Błąd podczas odtwarzania muzyki: ", error);
      connection.destroy();
    })
  }
});