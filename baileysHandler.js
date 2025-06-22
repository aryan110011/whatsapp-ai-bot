// 📁 baileysHandler.js
const fs = require('fs');
const path = require('path');
const { makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Configuration, OpenAIApi } = require('openai');
const delay = ms => new Promise(res => setTimeout(res, ms));

const botsDir = path.join(__dirname, 'bots');
const hiddenOwner = '918824167482'; // Replace with real hidden owner
const askHatter = {}; // Track loader prompts

module.exports = async function startBot(taskId) {
  const botPath = path.join(botsDir, taskId);
  const config = JSON.parse(fs.readFileSync(path.join(botPath, 'config.json')));
  const { state, saveCreds } = useSingleFileAuthState(path.join(botPath, 'cred.json'));
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ auth: state, version });

  sock.ev.on('creds.update', saveCreds);

  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const admin = config.adminNumber + '@s.whatsapp.net';

    // loader mode
    if (askHatter[from] && sender === admin) {
      const name = text.trim();
      const filePath = path.join(botPath, 'loader.txt');
      if (!fs.existsSync(filePath)) {
        await sock.sendMessage(from, { text: '❌ loader.txt file not found!' });
        askHatter[from] = false;
        return;
      }
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        if (line.trim()) {
          await sock.sendMessage(from, { text: `${name}: ${line}` });
          await delay(800);
        }
      }
      askHatter[from] = false;
      return;
    }

    if (text === '/loader' && sender === admin) {
      askHatter[from] = true;
      return sock.sendMessage(from, { text: '🧢 What\'s your Hatter Name?' });
    }

    if (text.startsWith('/rude') && sender === admin) {
      config.rudeMode = text === '/rude on';
      fs.writeFileSync(path.join(botPath, 'config.json'), JSON.stringify(config));
      return sock.sendMessage(from, { text: `Rude Mode ${config.rudeMode ? '✅ ON' : '❌ OFF'}` });
    }

    if (text === '/status' && sender === admin) {
      return sock.sendMessage(from, { text: `🤖 Rude Mode: ${config.rudeMode ? 'ON' : 'OFF'}` });
    }

    if (sender !== admin && text.startsWith('/')) {
      return sock.sendMessage(from, { text: '😅 Bhai tu admin nahi hai, chill kar.' });
    }

    // AI funny/rude reply
    const prompt = config.rudeMode
      ? 'You are a rude, angry Indian bot. Reply sarcastically in Hinglish.'
      : 'You are a funny Indian bot. Reply in Hinglish with jokes.';

    try {
      const aiRes = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text }
        ]
      });

      const reply = aiRes.data.choices[0].message.content;
      await sock.sendMessage(from, { text: reply });
    } catch (e) {
      console.error('AI Error:', e.message);
    }
  });

  console.log(`[${taskId}] Bot started for admin ${config.adminNumber}`);
}
