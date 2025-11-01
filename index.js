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

const COUNTER_FILE_PATH = "data/counter.json";

function read_counter() {
  try {
    const data = fs.readFileSync(COUNTER_FILE_PATH, 'utf8');
    return JSON.parse(data).count || 0;
  } catch (err) {
    return 0;
  }
}

function write_counter(count) {
  fs.writeFileSync(COUNTER_FILE_PATH, JSON.stringify({ count }));
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
    .addStringOption(option =>
      option.setName('all')
        .setDescription('Dodaje do kolejki wszystkie dostepne utwory (dopisz "random" aby je przetasować)')
        .setRequired(false)
        .addChoices(
          { name: 'normal', value: 'normal' },
          { name: 'random', value: 'random' }
        )
    ),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pomiń aktualnie grający utwór.'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Usuń całą kolejkę i rozłącz bota.')
].map(cmd => cmd.toJSON());

const music_queue = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  /* 
  ********************************* KOMENDA: GYATT *********************************
  */
  if(commandName === "gyatt"){
    const GIFS_PATH = './img/gyatts';

    const gifs = fs.readdirSync(GIFS_PATH).filter(file => file.endsWith('.gif'));

    if (gifs.length === 0) {
      await safe_reply(interaction, 'Brak plików GIF w folderze!');
      return;
    }

    const random_gif = gifs[Math.floor(Math.random() * gifs.length)];
    const gif_path = path.join(GIFS_PATH, random_gif);

    const attachment = new AttachmentBuilder(gif_path);

    await safe_reply(interaction, 'Szuszek ale on ma Gyatt', { files: [attachment] })
  }
  /* 
  ********************************* KOMENDA: PLAY *********************************
  */
  else if(commandName === "play"){
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    } catch (err) {
      console.error("Nie udało się deferować odpowiedzi:", err);
    }

    const voice_channel = interaction.member?.voice?.channel;
    if(!voice_channel){
      await safe_reply(interaction, ":x: Musisz być na kanale głosowym!");
      return;
    }

    const existing_connection = getVoiceConnection(interaction.guild.id);
    let guild_queue = music_queue.get(interaction.guild.id);

    if(existing_connection && guild_queue?.isPlaying){
      const current_channel_id = existing_connection.joinConfig.channelId;

      if(current_channel_id !== voice_channel.id){
        await safe_reply(interaction, ":x: Bot już gra muzykę na innym kanale głosowym!");
        return;
      }
    }

    let music_data;
    try{
      const data = fs.readFileSync('data/music.json', 'utf-8');
      music_data = JSON.parse(data).music;
    }
    catch(error){
      console.error("Błąd podczas wczytywania pliku music.json: ", error);
      await safe_reply(interaction, "Blad podczas wczytywania pliku music.json.");
      return;
    }

    const id = interaction.options.getInteger('id');
    const all_option = interaction.options.getString('all');

    let tracks_to_add = [];

    // -------------- TRYB /play all lub /play all random --------------
    if(all_option){
      tracks_to_add = [...music_data];

      if(all_option === 'random'){
        tracks_to_add.sort(() => Math.random() - 0.5);
      }

      await safe_reply(interaction, `Dodano wszystkie (${tracks_to_add.length}) dostępne utwory ${all_option === 'random' ? "w losowej kolejności " : ""}do kolejki.`)
    }
    // -------------- TRYB /play id --------------
    else if(id !== null && id !== undefined){
      const selected_music = music_data.find(m => m.id === id);
      if (!selected_music) {
        await safe_reply(interaction, `Nie znaleziono pliku o id ${id}. Dostępne wartości id są od 0 do ${music_data.length - 1}.`);
        return;
      }

      tracks_to_add.push(selected_music);
      await safe_reply(interaction, `Dodano do kolejki: ${selected_music.name} :moai:`);
    }
    // -------------- TRYB /play (bez argumentow) --------------
    else{
      const selected_music = music_data[Math.floor(Math.random() * music_data.length)];
      tracks_to_add.push(selected_music);
      await safe_reply(interaction, `Dodano do kolejki: ${selected_music.name} :moai:`);
    }

    if(!guild_queue){
      guild_queue = {
        queue: [],
        player: createAudioPlayer(),
        connection: null,
        isPlaying: false
      };
      music_queue.set(interaction.guild.id, guild_queue);

      guild_queue.player.on(AudioPlayerStatus.Idle, () => {
        guild_queue.isPlaying = false;
        play_next_music(interaction.guild.id, voice_channel);
      });

      guild_queue.player.on('error', (error) => {
        console.error("Blad podczas odtwarzania muzyki: ", error);
        guild_queue.isPlaying = false;
        play_next_music(interaction.guild.id, voice_channel);
      });
    }

    for (const track of tracks_to_add) {
      const track_path = path.resolve(track.src);
      if (fs.existsSync(track_path)) {
        guild_queue.queue.push({
          path: track_path,
          name: track.name
        });
      } else {
        console.error(`Nie znaleziono pliku: ${track.src}`);
      }
    }

    if(!guild_queue.isPlaying){
      play_next_music(interaction.guild.id, voice_channel);
    }
  }
  /* 
  ********************************* KOMENDA: SKIP *********************************
  */
  else if(commandName === "skip"){
    const guild_queue = music_queue.get(interaction.guild.id);
    if(!guild_queue){
      await safe_reply(interaction, "Aktualnie nie gra żaden utwór :japanese_goblin:");
      return;
    }

    const existing_connection = getVoiceConnection(interaction.guild.id);
    if(!existing_connection){
      await safe_reply(interaction, "Bot nie jest na żadnym kanale głosowym.");
      return;
    }

    const voice_channel = interaction.guild.channels.cache.get(existing_connection.joinConfig.channelId);

    if(!voice_channel){
      await safe_reply(interaction, "Nie udało się znaleźć kanału głosowego.");
      return;
    }

    guild_queue.player.stop();

    await safe_reply(interaction, "f");
  }
  /* 
  ********************************* KOMENDA: STOP *********************************
  */
  else if(commandName === "stop"){
    const guild_queue = music_queue.get(interaction.guild.id);
    if(!guild_queue){
      await safe_reply(interaction, "Aktualnie nie gra żaden utwór :japanese_goblin:");
      return;
    }

    const existing_connection = getVoiceConnection(interaction.guild.id);
    if(!existing_connection){
      await safe_reply(interaction, "Bot nie jest na żadnym kanale głosowym.");
      return;
    }

    guild_queue.player.stop();
    guild_queue.queue = [];

    guild_queue.connection.destroy();
    music_queue.delete(interaction.guild.id);

    await safe_reply(interaction, "Dobra to wypierdalam w takim razie :triumph:");
  }
})

function play_next_music(guild_id, voice_channel){
  const guild_queue = music_queue.get(guild_id);
  if(!guild_queue) return;

  if (!guild_queue.queue.length) {
    console.log(`Kolejka zakończona. Następuje rozłączenie z kanałem: ${voice_channel.name}.`);
    guild_queue.connection?.destroy();
    music_queue.delete(guild_id);
    return;
  }

  const next_music = guild_queue.queue.shift();
  if(!next_music){
    // Kolejka pusta, a wiec rozlacz
    if(guild_queue.connection){
      guild_queue.connection.destroy();
    }

    music_queue.delete(guild_id);
    return;
  }

  if(!guild_queue.connection){
    guild_queue.connection = joinVoiceChannel({
      channelId: voice_channel.id,
      guildId: voice_channel.guild.id,
      adapterCreator: voice_channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
  }

  const resource = createAudioResource(next_music.path);
  guild_queue.player.play(resource);
  guild_queue.connection.subscribe(guild_queue.player);
  guild_queue.isPlaying = true;

  console.log(`Odtwarzanie: ${next_music.name}`);
}

async function safe_reply(interaction, content, options = {}) {
  try {
    if (interaction.replied) {
      return await interaction.followUp({ content, ...options });
    } else if (interaction.deferred) {
      return await interaction.editReply({ content, ...options });
    } else {
      return await interaction.reply({ content, ...options });
    }
  } catch (err) {
    if (err?.code === 10062) {
      console.warn("Unknown interaction (10062) - token wygasł, próbuję followUp.");
      try {
        await interaction.followUp({ content, ...options });
      } catch (err2) {
        console.error("FollowUp też się nie udał:", err2);
      }
    } else {
      console.error("Błąd podczas odpowiedzi interakcji:", err);
    }
  }
}