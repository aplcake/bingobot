import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'assets');

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

// Load all winner banners from assets/winner-banners/
let winnerBanners = [];
const bannersDir = join(ASSETS_DIR, 'winner-banners');
if (existsSync(bannersDir)) {
  import('fs').then(fs => {
    const files = fs.readdirSync(bannersDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    Promise.all(files.map(f => loadImage(join(bannersDir, f)).catch(() => null)))
      .then(imgs => { winnerBanners = imgs.filter(Boolean); console.log(`🖼️ Loaded ${winnerBanners.length} winner banner(s)`); });
  });
} else { console.log('ℹ️ No assets/winner-banners/ folder, using generated fallback'); }

const COL = [
  { letter: 'B', min: 1, max: 15, color: '#ff6b35', dark: '#cc4400', hex: 0xFF6B35 },
  { letter: 'I', min: 16, max: 30, color: '#00e5ff', dark: '#0091a1', hex: 0x00E5FF },
  { letter: 'N', min: 31, max: 45, color: '#00ff88', dark: '#009e54', hex: 0x00FF88 },
  { letter: 'G', min: 46, max: 60, color: '#ffd700', dark: '#b89a00', hex: 0xFFD700 },
  { letter: 'O', min: 61, max: 75, color: '#ff3366', dark: '#c41048', hex: 0xFF3366 },
];

function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function colFor(n){if(typeof n!=='number')return null;return COL.find(c=>n>=c.min&&n<=c.max)||null;}
function ntc(n){if(typeof n==='string')return n;const c=colFor(n);return c?`${c.letter}${n}`:String(n);}

function generateClassicCard(){const grid=[];for(let c=0;c<5;c++){const{min,max}=COL[c];const pool=[];for(let n=min;n<=max;n++)pool.push(n);const p=shuffle(pool).slice(0,5);for(let r=0;r<5;r++){if(!grid[r])grid[r]=[];grid[r][c]=p[r];}}grid[2][2]='FREE';return grid;}
function generateCustomCard(pool){const p=shuffle(pool).slice(0,24);const grid=[];let i=0;for(let r=0;r<5;r++){grid[r]=[];for(let c=0;c<5;c++){grid[r][c]=(r===2&&c===2)?'FREE':p[i++];}}return grid;}
function generateCard(game){return game.mode==='custom'?generateCustomCard(game.itemPool):generateClassicCard();}

function isMarked(cell,called){return cell==='FREE'||called.includes(cell);}
function checkWin(grid,called,wc){const m=grid.map(r=>r.map(c=>isMarked(c,called)));
  if(wc==='line'){for(let r=0;r<5;r++)if(m[r].every(Boolean))return true;for(let c=0;c<5;c++)if(m.every(r=>r[c]))return true;if([0,1,2,3,4].every(i=>m[i][i]))return true;if([0,1,2,3,4].every(i=>m[i][4-i]))return true;return false;}
  if(wc==='blackout')return m.every(r=>r.every(Boolean));if(wc==='four_corners')return m[0][0]&&m[0][4]&&m[4][0]&&m[4][4];
  if(wc==='x_pattern')return[0,1,2,3,4].every(i=>m[i][i])&&[0,1,2,3,4].every(i=>m[i][4-i]);if(wc==='plus')return m[2].every(Boolean)&&m.every(r=>r[2]);return false;}

// ─── Image: Cards (horizontal grid layout) ──────────────────────────────────

function renderStackedCards(game, cards, totalCards) {
  const isCustom = game.mode === 'custom';
  const cellW = isCustom ? 100 : 70;
  const cellH = isCustom ? 42 : 52;
  const headerH = 38;
  const labelH = 26;
  const cardPadX = 12;
  const singleCardW = cardPadX * 2 + cellW * 5;
  const singleCardH = labelH + headerH + cellH * 5;

  const cols = cards.length <= 2 ? cards.length : 2;
  const rows = Math.ceil(cards.length / cols);
  const gap = 15;
  const titleH = 50;
  const w = gap + (singleCardW + gap) * cols;
  const h = titleH + gap + (singleCardH + gap) * rows;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 12); ctx.fill();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(game.name, w / 2, 22);
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.fillText(`${game.id} · ${game.winCondition}`, w / 2, 38);

  // Render cards in grid
  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const offsetX = gap + col * (singleCardW + gap);
    const offsetY = titleH + gap + row * (singleCardH + gap);

    // Card background
    ctx.fillStyle = '#0e0e1c';
    ctx.beginPath(); ctx.roundRect(offsetX - 4, offsetY - 4, singleCardW + 8, singleCardH + 8, 8); ctx.fill();
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1; ctx.stroke();

    renderSingleCardAt(ctx, game, cards[i], i + 1, totalCards, offsetX, offsetY, cellW, cellH, headerH, labelH, cardPadX, isCustom);
  }

  return canvas.toBuffer('image/png');
}

function renderSingleCardAt(ctx, game, card, cardNum, totalCards, ox, oy, cellW, cellH, headerH, labelH, padX, isCustom) {
  const called = game.calledNumbers || [];

  // Label
  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Card ${cardNum}/${totalCards}`, ox + padX, oy + 16);
  const markedCount = card.grid.flat().filter(c => isMarked(c, called)).length;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#666677';
  ctx.font = '10px sans-serif';
  ctx.fillText(`${markedCount}/25`, ox + padX + cellW * 5, oy + 16);

  const gridTop = oy + labelH;

  // Column headers
  for (let c = 0; c < 5; c++) {
    ctx.fillStyle = COL[c].color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isCustom ? '*' : COL[c].letter, ox + padX + c * cellW + cellW / 2, gridTop + 24);
  }

  // Grid
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = ox + padX + c * cellW;
      const y = gridTop + headerH + r * cellH;
      const val = card.grid[r][c];
      const marked = isMarked(val, called);
      const ci = (!isCustom && typeof val === 'number') ? colFor(val) : null;

      ctx.fillStyle = val === 'FREE' ? '#2a2a3a' : marked ? (ci ? ci.color : '#ff6b35') : '#16162a';
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 5); ctx.fill();
      ctx.strokeStyle = marked ? 'transparent' : '#2a2a3a'; ctx.lineWidth = 1; ctx.stroke();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (val === 'FREE') { ctx.fillStyle = '#ffd700'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('FREE', x + cellW/2, y + cellH/2); }
      else if (marked) { ctx.fillStyle = '#fff'; ctx.font = `bold ${isCustom?9:18}px sans-serif`; ctx.fillText(isCustom?String(val).slice(0,12):String(val), x+cellW/2, y+cellH/2); }
      else { ctx.fillStyle = '#666677'; ctx.font = `${isCustom?9:15}px sans-serif`; ctx.fillText(isCustom?String(val).slice(0,12):String(val), x+cellW/2, y+cellH/2); }
    }
  }
}

// ─── Image: Bingo Ball ──────────────────────────────────────────────────────

function renderBallImage(item, calledCount, total, isCustom) {
  const size = 200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const col = (!isCustom && typeof item === 'number') ? colFor(item) : null;
  const ballColor = col ? col.color : '#ff6b35';
  const ballDark = col ? col.dark : '#cc4400';

  // Shadow
  ctx.beginPath(); ctx.arc(size/2, size/2+4, 75, 0, Math.PI*2); ctx.fillStyle='#00000044'; ctx.fill();
  // Ball
  const grad = ctx.createRadialGradient(size/2-20, size/2-20, 10, size/2, size/2, 75);
  grad.addColorStop(0, ballColor+'cc'); grad.addColorStop(0.5, ballColor); grad.addColorStop(1, ballDark);
  ctx.beginPath(); ctx.arc(size/2, size/2, 75, 0, Math.PI*2); ctx.fillStyle=grad; ctx.fill();
  // Stripe
  ctx.beginPath(); ctx.ellipse(size/2, size/2, 55, 16, 0, 0, Math.PI*2); ctx.fillStyle='#ffffffdd'; ctx.fill();
  // Letter
  if(col){ctx.fillStyle='#222';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(col.letter,size/2,size/2-20);}
  // Number
  ctx.fillStyle='#1a1a1a';ctx.font=`bold ${isCustom?16:48}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(isCustom?String(item).slice(0,12):String(item),size/2,size/2+(col?10:0));
  // Count
  ctx.fillStyle='#aaa';ctx.font='13px sans-serif';ctx.fillText(`${calledCount} of ${total}`,size/2,size-12);
  return canvas.toBuffer('image/png');
}

// ─── Image: Winner Banner ───────────────────────────────────────────────────

function renderWinnerImage(gameName, displayName) {
  const w = 800, h = 400;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const safeName = String(displayName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')
    .trim() || 'Winner';

  const banner = winnerBanners.length > 0 ? winnerBanners[Math.floor(Math.random() * winnerBanners.length)] : null;

  if (banner) {
    // Draw uploaded banner as background
    ctx.drawImage(banner, 0, 0, w, h);
    // Dark overlay for text readability
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h);
  } else {
    // Generated fallback
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(0.5, '#1a1028'); grad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    // Gold border
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.strokeStyle = '#ffd70044'; ctx.lineWidth = 1;
    ctx.strokeRect(25, 25, w - 50, h - 50);
  }

  // Trophy symbols (canvas can't render emoji, use gold stars/text)
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 80px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 100, h/2);
  ctx.fillText('★', w - 100, h/2);
  // Small stars
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#ffd700aa';
  ctx.fillText('★', 60, h/2 - 60);
  ctx.fillText('★', 140, h/2 + 50);
  ctx.fillText('★', w - 60, h/2 - 60);
  ctx.fillText('★', w - 140, h/2 + 50);

  // "BINGO!" title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BINGO!', w/2, 120);

  // Glow effect on title
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30;
  ctx.fillText('BINGO!', w/2, 120);
  ctx.shadowBlur = 0;

  // Winner name
  ctx.fillStyle = '#ffffff';
  const nameSize = safeName.length > 20 ? 36 : safeName.length > 12 ? 48 : 56;
  ctx.font = `bold ${nameSize}px sans-serif`;
  ctx.fillText(safeName, w/2, h/2 + 20);

  // Game name
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '20px sans-serif';
  ctx.fillText(gameName, w/2, h - 70);

  // Subtitle
  ctx.fillStyle = '#ffd70088';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('★ WINNER ★', w/2, h/2 + 70);

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
  if (cardCount > 10) cardCount = 10;

  const cards = [];
  for (let i = 0; i < cardCount; i++) cards.push({ id: String(i), grid: generateCard(game) });
  game.players[userId] = { username: interaction.user.username, displayName: interaction.user.displayName || interaction.user.username, cards, joinedAt: new Date().toISOString() };
  saveGames();

  try {
    const user = await client.users.fetch(userId);
    // Send ALL cards as one stacked image
    const img = renderStackedCards(game, cards, cardCount);
    const att = new AttachmentBuilder(img, { name: 'bingo-cards.png' });
    await user.send({ content: `🎱 **${game.name}** — You have **${cardCount} card(s)**!\nNumbers that appear on your cards will be highlighted as they're called.`, files: [att] });
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
    const col = colFor(typeof item === 'number' ? item : 0);
    const embedColor = col ? col.hex : 0xFF6B35;

    const ballImg = renderBallImage(item, game.calledNumbers.length, total, isCustom);
    const att = new AttachmentBuilder(ballImg, { name: 'ball.png' });
    const embed = new EmbedBuilder()
      .setTitle(`🎱 ${ntc(item)}`)
      .setThumbnail('attachment://ball.png')
      .setDescription(`**${game.calledNumbers.length}** of ${total} called`)
      .setColor(embedColor);
    await ch.send({ embeds: [embed], files: [att] });
  } catch (e) { console.error('Announce fail:', e.message); }
}

async function announceWinners(game, winners) {
  if (!game.channelId || !game.guildId) return;
  try {
    const guild = await client.guilds.fetch(game.guildId);
    const ch = await guild.channels.fetch(game.channelId);

    for (const w of winners) {
      const name = w.displayName || w.username;
      const winImg = renderWinnerImage(game.name, name);
      const att = new AttachmentBuilder(winImg, { name: 'winner.png' });
      const embed = new EmbedBuilder()
        .setTitle('🏆 BINGO! WE HAVE A WINNER!')
        .setDescription(`**${name}**\n<@${w.discordId}> (Card #${w.cardIndex + 1})`)
        .setImage('attachment://winner.png')
        .setColor(0xFFD700);
      await ch.send({ embeds: [embed], files: [att] });
    }
  } catch (e) { console.error('Winner announce fail:', e.message); }
}

// SMART DM: only affected players, one stacked image per message
async function sendAffectedCards(game, item) {
  for (const [userId, player] of Object.entries(game.players)) {
    const affectedCards = player.cards.filter(card => card.grid.flat().includes(item));
    if (affectedCards.length === 0) continue;
    try {
      const user = await client.users.fetch(userId);
      // Send ALL their cards (not just affected ones) so they see full state
      const img = renderStackedCards(game, player.cards, player.cards.length);
      const att = new AttachmentBuilder(img, { name: 'bingo-cards.png' });
      await user.send({ content: `📢 **${ntc(item)}** called! You have it!`, files: [att] });
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
  const defaults = loadDefaults();
  const rc = Object.keys(roleConfig).length > 0 ? roleConfig : (defaults.roleConfig || {});
  games[id] = { id, name, mode, status: 'open', winCondition, roleConfig: rc, itemPool: mode === 'custom' ? itemPool : [], players: {}, calledNumbers: [], winners: [], channelId: null, guildId: null, messageId: null, createdAt: new Date().toISOString() };
  saveGames(); res.json(games[id]);
});

app.get('/api/games/:id', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); res.json(g); });

app.get('/api/games/:id/display', (req, res) => {
  const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' });
  const leaderboard = Object.entries(g.players).map(([uid, p]) => {
    let bestMarks = 0;
    for (const card of p.cards) { const marks = card.grid.flat().filter(c => isMarked(c, g.calledNumbers)).length; if (marks > bestMarks) bestMarks = marks; }
    return { displayName: p.displayName || p.username, marks: bestMarks, cards: p.cards.length, isWinner: g.winners.some(w => w.discordId === uid) };
  }).sort((a, b) => b.marks - a.marks).slice(0, 15);
  res.json({ id: g.id, name: g.name, status: g.status, mode: g.mode || 'classic', winCondition: g.winCondition, calledNumbers: g.calledNumbers, itemPool: g.mode === 'custom' ? g.itemPool : [], playerCount: Object.keys(g.players).length, totalCards: Object.values(g.players).reduce((s, p) => s + p.cards.length, 0), winners: g.winners, lastCalledAt: g.lastCalledAt || null, leaderboard });
});

app.put('/api/games/:id/roles', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); g.roleConfig = req.body.roleConfig || {}; saveGames(); res.json({ ok: true }); });
app.post('/api/defaults/roles', auth, (req, res) => { const d = loadDefaults(); d.roleConfig = req.body.roleConfig || {}; saveDefaults(d); res.json({ ok: true }); });
app.get('/api/defaults/roles', auth, (_, res) => { const d = loadDefaults(); res.json({ roleConfig: d.roleConfig || {} }); });

app.post('/api/games/:id/post', auth, async (req, res) => {
  const game = games[req.params.id]; if (!game) return res.status(404).json({ error: 'Not found' }); if (game.status !== 'open') return res.status(400).json({ error: 'Not open' });
  const { channelId } = req.body; if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    let channel; for (const guild of client.guilds.cache.values()) { channel = await guild.channels.fetch(channelId).catch(() => null); if (channel) { game.guildId = guild.id; break; } }
    if (!channel) return res.status(404).json({ error: 'Channel not found' }); game.channelId = channelId;
    const roleInfo = Object.entries(game.roleConfig).map(([rid, cnt]) => `<@&${rid}> → **${cnt}** card${cnt > 1 ? 's' : ''}`).join('\n') || 'No roles configured';
    const embed = new EmbedBuilder()
      .setTitle(`🎱 BINGO — ${game.name}`)
      .setDescription(`**ID:** \`${game.id}\`\n**Mode:** ${game.mode === 'custom' ? '🎨 Custom' : '🔢 Classic'}\n**Win:** ${game.winCondition}\n\n**Cards per role (stacking):**\n${roleInfo}\n\nClick below to join!`)
      .setColor(0xFF6B35)
      .setFooter({ text: '⚠️ Participating will result in DM messages from Bingo Bot when your numbers are called. Cards stack across roles. Make sure your DMs are open!' });
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
  await sendAffectedCards(game, item);
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
