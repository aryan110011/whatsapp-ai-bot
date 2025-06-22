
// 📁 server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const startBot = require('./baileysHandler');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const botsDir = path.join(__dirname, 'bots');
if (!fs.existsSync(botsDir)) fs.mkdirSync(botsDir);

// Create bot
app.post('/bot/create', async (req, res) => {
  const { name, admin, mode, cred } = req.body;
  const taskId = 'bot_' + uuidv4().slice(0, 8);
  const botPath = path.join(botsDir, taskId);
  fs.mkdirSync(botPath);
  fs.writeFileSync(path.join(botPath, 'cred.json'), cred);
  fs.writeFileSync(path.join(botPath, 'config.json'), JSON.stringify({ name, adminNumber: admin, rudeMode: mode === 'rude' }));
  fs.writeFileSync(path.join(botPath, 'loader.txt'), '');
  startBot(taskId);
  res.json({ success: true, taskId });
});

// Change bot mode
app.post('/bot/mode', async (req, res) => {
  const { taskId, mode } = req.body;
  const configPath = path.join(botsDir, taskId, 'config.json');
  if (!fs.existsSync(configPath)) return res.status(404).json({ error: 'Invalid Task ID' });
  const config = JSON.parse(fs.readFileSync(configPath));
  config.rudeMode = mode === 'rude';
  fs.writeFileSync(configPath, JSON.stringify(config));
  res.json({ success: true });
});

// Get bot status
app.get('/bot/status/:id', (req, res) => {
  const configPath = path.join(botsDir, req.params.id, 'config.json');
  if (!fs.existsSync(configPath)) return res.status(404).json({ error: 'Not found' });
  const config = JSON.parse(fs.readFileSync(configPath));
  res.json({ name: config.name, admin: config.adminNumber, rudeMode: config.rudeMode });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌐 Server running on port', PORT));
