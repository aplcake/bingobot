import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { createCanvas } from 'canvas';
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY || 'changeme';
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DATA_FILE = './data/games.json';
const DEFAULTS_FILE = './data/defaults.json';
if (!DISCORD_TOKEN) { console.error('DISCORD_TOKEN required'); process.exit(1); }

function ensureDataDir() { if (!existsSync('./data')) mkdirSync('./data', { recursive: true }); }
function loadGames() { ensureDataDir(); if (!existsSync(DATA_FILE)) return {}; try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return {}; } }
function saveGames() { ensureDataDir(); writeFileSync(DATA_FILE, JSON.stringify(games, null, 2)); }
function loadDefaults() { ensureDataDir(); if (!existsSync(DEFAULTS_FILE)) return {}; try { return JSON.parse(readFileSync(DEFAULTS_FILE, 'utf8')); } catch { return {}; } }
function saveDefaults(d) { ensureDataDir(); writeFileSync(DEFAULTS_FILE, JSON.stringify(d, null, 2)); }
let games = loadGames();

const COL = [
  { letter: 'B', min: 1, max: 15, color: '#ff6b35', dark: '#cc4400' },
  { letter: 'I', min: 16, max: 30, color: '#00e5ff', dark: '#0091a1' },
  { letter: 'N', min: 31, max: 45, color: '#00ff88', dark: '#009e54' },
  { letter: 'G', min: 46, max: 60, color: '#ffd700', dark: '#b89a00' },
  { letter: 'O', min: 61, max: 75, color: '#ff3366', dark: '#c41048' },
];

function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function colFor(n){return COL.find(c=>n>=c.min&&n<=c.max);}
function ntc(n){if(typeof n==='string')return n;const c=colFor(n);return`${c.letter}${n}`;}

function generateClassicCard(){const grid=[];for(let c=0;c<5;c++){const{min,max}=COL[c];const pool=[];for(let n=min;n<=max;n++)pool.push(n);const p=shuffle(pool).slice(0,5);for(let r=0;r<5;r++){if(!grid[r])grid[r]=[];grid[r][c]=p[r];}}grid[2][2]='FREE';return grid;}
function generateCustomCard(pool){const p=shuffle(pool).slice(0,24);const grid=[];let i=0;for(let r=0;r<5;r++){grid[r]=[];for(let c=0;c<5;c++){grid[r][c]=(r===2&&c===2)?'FREE':p[i++];}}return grid;}
function generateCard(game){return game.mode==='custom'?generateCustomCard(game.itemPool):generateClassicCard();}

function isMarked(cell,called){return cell==='FREE'||called.includes(cell);}
function checkWin(grid,called,wc){const m=grid.map(r=>r.map(c=>isMarked(c,called)));
  if(wc==='line'){for(let r=0;r<5;r++)if(m[r].every(Boolean))return true;for(let c=0;c<5;c++)if(m.every(r=>r[c]))return true;if([0,1,2,3,4].every(i=>m[i][i]))return true;if([0,1,2,3,4].every(i=>m[i][4-i]))return true;return false;}
  if(wc==='blackout')return m.every(r=>r.every(Boolean));if(wc==='four_corners')return m[0][0]&&m[0][4]&&m[4][0]&&m[4][4];
  if(wc==='x_pattern')return[0,1,2,3,4].every(i=>m[i][i])&&[0,1,2,3,4].every(i=>m[i][4-i]);if(wc==='plus')return m[2].every(Boolean)&&m.every(r=>r[2]);return false;}

// ─── Image Generation ────────────────────────────────────────────────────────

function renderCardImage(game, card, cardNum, totalCards) {
  const called = game.calledNumbers || [];
  const isCustom = game.mode === 'custom';
  const cellW = isCustom ? 120 : 80;
  const cellH = isCustom ? 50 : 60;
  const headerH = 50;
  const titleH = 60;
  const padX = 20;
  const padY = 10;
  const w = padX * 2 + cellW * 5;
  const h = titleH + headerH + cellH * 5 + padY * 2;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a14';
  ctx.roundRect(0, 0, w, h, 12);
  ctx.fill();

  // Title bar
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${game.name} — Card ${cardNum}/${totalCards}`, w / 2, 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText(game.id, w / 2, 48);

  const startY = titleH;

  // Column headers
  for (let c = 0; c < 5; c++) {
    const x = padX + c * cellW;
    const col = COL[c];
    ctx.fillStyle = col.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isCustom ? '★' : col.letter, x + cellW / 2, startY + 34);
  }

  // Grid cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = padX + c * cellW;
      const y = startY + headerH + r * cellH;
      const val = card.grid[r][c];
      const marked = isMarked(val, called);
      const colInfo = (!isCustom && typeof val === 'number') ? colFor(val) : null;

      // Cell background
      if (val === 'FREE') {
        ctx.fillStyle = '#2a2a3a';
      } else if (marked && colInfo) {
        ctx.fillStyle = colInfo.color;
      } else if (marked) {
        ctx.fillStyle = '#ff6b35';
      } else {
        ctx.fillStyle = '#16162a';
      }
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
      ctx.fill();

      // Cell border
      ctx.strokeStyle = marked ? 'transparent' : '#2a2a3a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cell text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (val === 'FREE') {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('★ FREE', x + cellW / 2, y + cellH / 2);
      } else if (marked) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${isCustom ? 11 : 22}px sans-serif`;
        const display = isCustom ? String(val).slice(0, 14) : String(val);
        ctx.fillText(display, x + cellW / 2, y + cellH / 2);
      } else {
        ctx.fillStyle = '#666677';
        ctx.font = `${isCustom ? 11 : 18}px sans-serif`;
        const display = isCustom ? String(val).slice(0, 14) : String(val);
        ctx.fillText(display, x + cellW / 2, y + cellH / 2);
      }
    }
  }

  // Progress bar at bottom
  const markedCount = card.grid.flat().filter(c => isMarked(c, called)).length;
  ctx.fillStyle = '#888888';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${markedCount}/25 marked · ${game.winCondition}`, w / 2, h - 8);

  return canvas.toBuffer('image/png');
}

function renderBallImage(item, calledCount, total, isCustom) {
  const size = 200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const col = (!isCustom && typeof item === 'number') ? colFor(item) : null;
  const ballColor = col ? col.color : '#ff6b35';
  const ballDark = col ? col.dark : '#cc4400';

  // Ball shadow
  ctx.beginPath();
  ctx.arc(size/2, size/2 + 4, 75, 0, Math.PI * 2);
  ctx.fillStyle = '#00000044';
  ctx.fill();

  // Ball gradient
  const grad = ctx.createRadialGradient(size/2 - 20, size/2 - 20, 10, size/2, size/2, 75);
  grad.addColorStop(0, ballColor + 'cc');
  grad.addColorStop(0.5, ballColor);
  grad.addColorStop(1, ballDark);
  ctx.beginPath();
  ctx.arc(size/2, size/2, 75, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // White stripe
  ctx.beginPath();
  ctx.ellipse(size/2, size/2, 55, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffffdd';
  ctx.fill();

  // Letter
  if (col) {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(col.letter, size/2, size/2 - 20);
  }

  // Number
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${isCustom ? 16 : 48}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const display = isCustom ? String(item).slice(0, 12) : String(item);
  ctx.fillText(display, size/2, size/2 + (col ? 10 : 0));

  // Count text below ball
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${calledCount} of ${total}`, size/2, size - 12);

  return canvas.toBuffer('image/png');
}

// ─── Discord Bot ─────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
client.once('ready', () => console.log(`🎱 Bingo Bot online as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith('join_bingo_')) return;
  const gameId = interaction.customId.replace('join_bingo_', '');
  const game = games[gameId];
  if (!game) return interaction.reply({ content: '❌ Game not found.', ephemeral: true });
  if (game.status !== 'open') return interaction.reply({ content: '❌ Not accepting players.', ephemeral: true });
  const userId = interaction.user.id;
  if (game.players[userId]) return interaction.reply({ content: `Already joined with ${game.players[userId].cards.length} card(s)! Check DMs.`, ephemeral: true });

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Could not fetch member info.', ephemeral: true });

  // STACKING: sum all matching roles
  let cardCount = 0;
  for (const [roleId, count] of Object.entries(game.roleConfig)) {
    if (member.roles.cache.has(roleId)) cardCount += count;
  }
  if (cardCount === 0) return interaction.reply({ content: '❌ No qualifying role.', ephemeral: true });
  if (cardCount > 10) cardCount = 10; // cap at 10

  const cards = [];
  for (let i = 0; i < cardCount; i++) cards.push({ id: String(i), grid: generateCard(game) });
  game.players[userId] = { username: interaction.user.username, displayName: interaction.user.displayName || interaction.user.username, cards, joinedAt: new Date().toISOString() };
  saveGames();

  try {
    const user = await client.users.fetch(userId);
    for (let i = 0; i < cards.length; i++) {
      const img = renderCardImage(game, cards[i], i + 1, cardCount);
      const att = new AttachmentBuilder(img, { name: `card-${i + 1}.png` });
      await user.send({ content: `🎱 **${game.name}** — Card ${i + 1}/${cardCount}`, files: [att] });
    }
    await interaction.reply({ content: `🎰 You got **${cardCount} card(s)**! Check DMs.`, ephemeral: true });
  } catch { await interaction.reply({ content: '❌ Couldn\'t DM you. Open your DMs!', ephemeral: true }); }
});

async function announceNumber(game, item) {
  if (!game.channelId || !game.guildId) return;
  try {
    const guild = await client.guilds.fetch(game.guildId);
    const ch = await guild.channels.fetch(game.channelId);
    const isCustom = game.mode === 'custom';
    const total = isCustom ? game.itemPool.length : 75;
    const ballImg = renderBallImage(item, game.calledNumbers.length, total, isCustom);
    const att = new AttachmentBuilder(ballImg, { name: 'ball.png' });
    const embed = new EmbedBuilder()
      .setTitle(`🎱 ${ntc(item)}`)
      .setThumbnail('attachment://ball.png')
      .setColor(colFor(typeof item === 'number' ? item : 1)?.color ? parseInt(colFor(item)?.color.replace('#', ''), 16) : 0x00FF88);
    await ch.send({ embeds: [embed], files: [att] });
  } catch (e) { console.error('Announce fail:', e.message); }
}

async function announceWinners(game, winners) {
  if (!game.channelId || !game.guildId) return;
  try {
    const guild = await client.guilds.fetch(game.guildId);
    const ch = await guild.channels.fetch(game.channelId);
    const list = winners.map(w => `<@${w.discordId}> (Card #${w.cardIndex + 1})`).join('\n');
    await ch.send({ embeds: [new EmbedBuilder().setTitle('🏆 BINGO! WE HAVE A WINNER!').setDescription(`**${game.name}**\n\n${list}`).setColor(0xFFD700)] });
  } catch (e) { console.error('Winner announce fail:', e.message); }
}

// SMART DM: only send to players whose cards contain the called item
async function sendAffectedCards(game, item) {
  for (const [userId, player] of Object.entries(game.players)) {
    const affected = player.cards.some(card => card.grid.flat().includes(item));
    if (!affected) continue; // skip players who don't have this number
    try {
      const user = await client.users.fetch(userId);
      for (let i = 0; i < player.cards.length; i++) {
        if (!player.cards[i].grid.flat().includes(item)) continue; // skip unaffected cards
        const img = renderCardImage(game, player.cards[i], i + 1, player.cards.length);
        const att = new AttachmentBuilder(img, { name: `card-${i + 1}.png` });
        await user.send({ content: `📢 **${ntc(item)}** called! Your card ${i + 1} updated:`, files: [att] });
      }
    } catch {}
  }
}

// ─── Express API ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: FRONTEND_URL.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
function auth(req, res, next) { if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' }); next(); }

app.get('/api/health', (_, res) => res.json({ ok: true, games: Object.keys(games).length }));

app.get('/api/games', auth, (_, res) => {
  const list = Object.values(games).map(g => ({ id: g.id, name: g.name, status: g.status, mode: g.mode || 'classic', playerCount: Object.keys(g.players).length, calledCount: g.calledNumbers.length, totalItems: g.mode === 'custom' ? g.itemPool.length : 75, winCondition: g.winCondition, winnerCount: g.winners.length, winners: g.winners, createdAt: g.createdAt }));
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); res.json(list);
});

app.post('/api/games', auth, (req, res) => {
  const { name, winCondition = 'line', roleConfig = {}, mode = 'classic', itemPool = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (mode === 'custom' && (!itemPool || itemPool.length < 24)) return res.status(400).json({ error: 'Custom needs 24+ items' });
  const id = `BINGO-${Date.now().toString(36).toUpperCase()}`;
  // Use saved defaults for roleConfig if none provided
  const defaults = loadDefaults();
  const rc = Object.keys(roleConfig).length > 0 ? roleConfig : (defaults.roleConfig || {});
  games[id] = { id, name, mode, status: 'open', winCondition, roleConfig: rc, itemPool: mode === 'custom' ? itemPool : [], players: {}, calledNumbers: [], winners: [], channelId: null, guildId: null, messageId: null, createdAt: new Date().toISOString() };
  saveGames(); res.json(games[id]);
});

app.get('/api/games/:id', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); res.json(g); });

app.get('/api/games/:id/display', (req, res) => {
  const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' });
  // Build leaderboard: best card per player, sorted by most marks
  const leaderboard = Object.entries(g.players).map(([uid, p]) => {
    let bestMarks = 0;
    for (const card of p.cards) {
      const marks = card.grid.flat().filter(c => isMarked(c, g.calledNumbers)).length;
      if (marks > bestMarks) bestMarks = marks;
    }
    return { displayName: p.displayName || p.username, marks: bestMarks, cards: p.cards.length, isWinner: g.winners.some(w => w.discordId === uid) };
  }).sort((a, b) => b.marks - a.marks).slice(0, 15);
  res.json({ id: g.id, name: g.name, status: g.status, mode: g.mode || 'classic', winCondition: g.winCondition, calledNumbers: g.calledNumbers, itemPool: g.mode === 'custom' ? g.itemPool : [], playerCount: Object.keys(g.players).length, totalCards: Object.values(g.players).reduce((s, p) => s + p.cards.length, 0), winners: g.winners, lastCalledAt: g.lastCalledAt || null, leaderboard });
});

app.put('/api/games/:id/roles', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); g.roleConfig = req.body.roleConfig || {}; saveGames(); res.json({ ok: true }); });

// Save/load role defaults
app.post('/api/defaults/roles', auth, (req, res) => { const d = loadDefaults(); d.roleConfig = req.body.roleConfig || {}; saveDefaults(d); res.json({ ok: true }); });
app.get('/api/defaults/roles', auth, (_, res) => { const d = loadDefaults(); res.json({ roleConfig: d.roleConfig || {} }); });

app.post('/api/games/:id/post', auth, async (req, res) => {
  const game = games[req.params.id]; if (!game) return res.status(404).json({ error: 'Not found' }); if (game.status !== 'open') return res.status(400).json({ error: 'Not open' });
  const { channelId } = req.body; if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    let channel; for (const guild of client.guilds.cache.values()) { channel = await guild.channels.fetch(channelId).catch(() => null); if (channel) { game.guildId = guild.id; break; } }
    if (!channel) return res.status(404).json({ error: 'Channel not found' }); game.channelId = channelId;
    const roleInfo = Object.entries(game.roleConfig).map(([rid, cnt]) => `<@&${rid}> → **${cnt}** card${cnt > 1 ? 's' : ''}`).join('\n') || 'No roles configured';
    const embed = new EmbedBuilder().setTitle(`🎱 BINGO — ${game.name}`).setDescription(`**ID:** \`${game.id}\`\n**Mode:** ${game.mode === 'custom' ? '🎨 Custom' : '🔢 Classic'}\n**Win:** ${game.winCondition}\n\n**Cards per role (stacking):**\n${roleInfo}\n\nClick below to join!`).setColor(0xFF6B35).setFooter({ text: 'Cards stack! Multiple roles = more cards. DMs must be open.' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`join_bingo_${game.id}`).setLabel('🎰 Join Game').setStyle(ButtonStyle.Success));
    const msg = await channel.send({ embeds: [embed], components: [row] }); game.messageId = msg.id; saveGames();
    res.json({ ok: true, messageId: msg.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/games/:id/start', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); g.status = 'active'; saveGames(); res.json({ ok: true }); });

app.post('/api/games/:id/call', auth, async (req, res) => {
  const game = games[req.params.id]; if (!game) return res.status(404).json({ error: 'Not found' }); if (game.status !== 'active') return res.status(400).json({ error: 'Not active' });
  const isCustom = game.mode === 'custom'; let item;
  if (req.body.item !== undefined) { item = req.body.item; } else if (req.body.number !== undefined) { item = req.body.number; } else {
    const pool = isCustom ? game.itemPool.filter(i => !game.calledNumbers.includes(i)) : Array.from({ length: 75 }, (_, i) => i + 1).filter(i => !game.calledNumbers.includes(i));
    if (pool.length === 0) return res.status(400).json({ error: 'All called' }); item = pool[Math.floor(Math.random() * pool.length)];
  }
  if (game.calledNumbers.includes(item)) return res.status(400).json({ error: 'Already called' });
  game.calledNumbers.push(item); game.lastCalledAt = new Date().toISOString(); game.lastCalledItem = item;
  const newWinners = [];
  for (const [uid, player] of Object.entries(game.players)) {
    for (let i = 0; i < player.cards.length; i++) {
      if (!game.winners.some(w => w.discordId === uid && w.cardIndex === i) && checkWin(player.cards[i].grid, game.calledNumbers, game.winCondition)) {
        const w = { discordId: uid, username: player.username, displayName: player.displayName, cardIndex: i, wonAt: new Date().toISOString(), wonOnItem: item };
        game.winners.push(w); newWinners.push(w);
      }
    }
  }
  saveGames();
  await announceNumber(game, item);
  if (newWinners.length > 0) await announceWinners(game, newWinners);
  await sendAffectedCards(game, item); // only DM players who have this number
  res.json({ item, display: ntc(item), calledCount: game.calledNumbers.length, total: isCustom ? game.itemPool.length : 75, newWinners, totalWinners: game.winners.length });
});

app.post('/api/games/:id/end', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); g.status = 'ended'; g.endedAt = new Date().toISOString(); saveGames(); res.json({ ok: true, winners: g.winners }); });

app.get('/api/guilds', auth, async (_, res) => {
  const guilds = []; for (const guild of client.guilds.cache.values()) { const channels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread()).map(c => ({ id: c.id, name: c.name })); guilds.push({ id: guild.id, name: guild.name, channels }); } res.json(guilds);
});
app.get('/api/guilds/:id/roles', auth, async (req, res) => {
  try { const guild = await client.guilds.fetch(req.params.id); const roles = guild.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor, memberCount: r.members?.size || 0 })).sort((a, b) => b.memberCount - a.memberCount); res.json(roles); } catch { res.status(404).json({ error: 'Guild not found' }); }
});
app.delete('/api/games/:id', auth, (req, res) => { if (!games[req.params.id]) return res.status(404).json({ error: 'Not found' }); delete games[req.params.id]; saveGames(); res.json({ ok: true }); });

ensureDataDir(); app.listen(PORT, () => console.log(`🌐 API on port ${PORT}`)); client.login(DISCORD_TOKEN);
