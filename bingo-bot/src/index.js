import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY || 'changeme';
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DATA_FILE = './data/games.json';
if (!DISCORD_TOKEN) { console.error('DISCORD_TOKEN required'); process.exit(1); }

function ensureDataDir() { if (!existsSync('./data')) mkdirSync('./data', { recursive: true }); }
function loadGames() { ensureDataDir(); if (!existsSync(DATA_FILE)) return {}; try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return {}; } }
function saveGames() { ensureDataDir(); writeFileSync(DATA_FILE, JSON.stringify(games, null, 2)); }
let games = loadGames();

const COLUMNS = [
  { letter: 'B', min: 1, max: 15 }, { letter: 'I', min: 16, max: 30 },
  { letter: 'N', min: 31, max: 45 }, { letter: 'G', min: 46, max: 60 }, { letter: 'O', min: 61, max: 75 },
];

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function generateClassicCard() {
  const grid = [];
  for (let col = 0; col < 5; col++) {
    const { min, max } = COLUMNS[col]; const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    const picked = shuffle(pool).slice(0, 5);
    for (let row = 0; row < 5; row++) { if (!grid[row]) grid[row] = []; grid[row][col] = picked[row]; }
  }
  grid[2][2] = 'FREE'; return grid;
}

function generateCustomCard(itemPool) {
  const picked = shuffle(itemPool).slice(0, 24); const grid = []; let idx = 0;
  for (let r = 0; r < 5; r++) { grid[r] = []; for (let c = 0; c < 5; c++) { grid[r][c] = (r === 2 && c === 2) ? 'FREE' : picked[idx++]; } }
  return grid;
}

function generateCard(game) { return game.mode === 'custom' ? generateCustomCard(game.itemPool) : generateClassicCard(); }
function cardToId(grid) { return grid.flat().join('|'); }

function numberToCall(n) {
  if (typeof n === 'string') return n;
  if (n <= 15) return `B${n}`; if (n <= 30) return `I${n}`; if (n <= 45) return `N${n}`; if (n <= 60) return `G${n}`; return `O${n}`;
}

function isMarked(cell, called) { return cell === 'FREE' || called.includes(cell); }

function checkWin(grid, called, wc) {
  const m = grid.map(row => row.map(cell => isMarked(cell, called)));
  if (wc === 'line') {
    for (let r = 0; r < 5; r++) if (m[r].every(Boolean)) return true;
    for (let c = 0; c < 5; c++) if (m.every(row => row[c])) return true;
    if ([0,1,2,3,4].every(i => m[i][i])) return true;
    if ([0,1,2,3,4].every(i => m[i][4-i])) return true; return false;
  }
  if (wc === 'blackout') return m.every(row => row.every(Boolean));
  if (wc === 'four_corners') return m[0][0] && m[0][4] && m[4][0] && m[4][4];
  if (wc === 'x_pattern') return [0,1,2,3,4].every(i => m[i][i]) && [0,1,2,3,4].every(i => m[i][4-i]);
  if (wc === 'plus') return m[2].every(Boolean) && m.every(row => row[2]);
  return false;
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
  if (game.players[userId]) return interaction.reply({ content: `You already have ${game.players[userId].cards.length} card(s)! Check DMs.`, ephemeral: true });

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Could not fetch member info.', ephemeral: true });
  let cardCount = 0;
  for (const [roleId, count] of Object.entries(game.roleConfig)) { if (member.roles.cache.has(roleId) && count > cardCount) cardCount = count; }
  if (cardCount === 0) return interaction.reply({ content: '❌ You don\'t have a qualifying role.', ephemeral: true });

  const cards = [];
  for (let i = 0; i < cardCount; i++) { const grid = generateCard(game); cards.push({ id: cardToId(grid), grid }); }
  game.players[userId] = { username: interaction.user.username, displayName: interaction.user.displayName || interaction.user.username, cards, joinedAt: new Date().toISOString() };
  saveGames();

  try {
    const user = await client.users.fetch(userId);
    for (let i = 0; i < cards.length; i++) await user.send({ embeds: [buildCardEmbed(game, cards[i], i + 1, cardCount)] });
    await interaction.reply({ content: `🎰 You got **${cardCount} card(s)**! Check your DMs.`, ephemeral: true });
  } catch { await interaction.reply({ content: '❌ Couldn\'t DM you. Open your DMs!', ephemeral: true }); }
});

function buildCardEmbed(game, card, num, total) {
  const { grid } = card; const called = game.calledNumbers || []; const isCustom = game.mode === 'custom';
  let s = '```\n';
  if (!isCustom) {
    s += '  B    I    N    G    O\n┌────┬────┬────┬────┬────┐\n';
    for (let r = 0; r < 5; r++) {
      s += '│'; for (let c = 0; c < 5; c++) { const v = grid[r][c]; const mk = isMarked(v, called); const d = v === 'FREE' ? ' ★  ' : String(v).padStart(2,' ').padEnd(3,' '); s += mk ? `[${d}]` : ` ${d} `; if (c < 4) s += '│'; }
      s += '│\n'; if (r < 4) s += '├────┼────┼────┼────┼────┤\n';
    }
    s += '└────┴────┴────┴────┴────┘\n';
  } else {
    s += '┌──────────┬──────────┬──────────┬──────────┬──────────┐\n';
    for (let r = 0; r < 5; r++) {
      s += '│'; for (let c = 0; c < 5; c++) { const v = grid[r][c]; const mk = isMarked(v, called); const d = v === 'FREE' ? '  ★FREE★  ' : String(v).slice(0,10).padEnd(10,' '); s += mk ? `[${d}]` : ` ${d} `; if (c < 4) s += '│'; }
      s += '│\n'; if (r < 4) s += '├──────────┼──────────┼──────────┼──────────┼──────────┤\n';
    }
    s += '└──────────┴──────────┴──────────┴──────────┴──────────┘\n';
  }
  s += '```';
  const embed = new EmbedBuilder().setTitle(`🎱 BINGO — ${game.name}`).setDescription(`Card ${num}/${total} · \`${game.id}\`\n${s}`).setColor(0xFF6B35).setFooter({ text: `${game.winCondition} · [bracketed]=marked` });
  if (called.length > 0) embed.addFields({ name: `Called (${called.length})`, value: called.slice(-15).map(n => `**${numberToCall(n)}**`).join(', ') });
  return embed;
}

async function announceNumber(game, item) {
  if (!game.channelId || !game.guildId) return;
  try { const guild = await client.guilds.fetch(game.guildId); const ch = await guild.channels.fetch(game.channelId);
    const d = game.mode === 'custom' ? `"${item}"` : numberToCall(item);
    await ch.send({ embeds: [new EmbedBuilder().setTitle(`🎱 ${d}`).setDescription(`${game.calledNumbers.length} of ${game.mode === 'custom' ? game.itemPool.length : 75} called.`).setColor(0x00FF88)] });
  } catch (e) { console.error('Announce fail:', e.message); }
}

async function announceWinners(game, winners) {
  if (!game.channelId || !game.guildId) return;
  try { const guild = await client.guilds.fetch(game.guildId); const ch = await guild.channels.fetch(game.channelId);
    const list = winners.map(w => `<@${w.discordId}> (Card #${w.cardIndex + 1})`).join('\n');
    await ch.send({ embeds: [new EmbedBuilder().setTitle('🏆 BINGO! WE HAVE A WINNER!').setDescription(`**${game.name}**\n\n${list}`).setColor(0xFFD700)] });
  } catch (e) { console.error('Winner announce fail:', e.message); }
}

async function sendUpdatedCards(game) {
  for (const [uid, player] of Object.entries(game.players)) {
    try { const user = await client.users.fetch(uid); for (let i = 0; i < player.cards.length; i++) await user.send({ embeds: [buildCardEmbed(game, player.cards[i], i + 1, player.cards.length)] }); } catch {}
  }
}

// ─── Express API ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: FRONTEND_URL.split(',').map(s => s.trim()) }));
app.use(express.json());
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
  games[id] = { id, name, mode, status: 'open', winCondition, roleConfig, itemPool: mode === 'custom' ? itemPool : [], players: {}, calledNumbers: [], winners: [], channelId: null, guildId: null, messageId: null, createdAt: new Date().toISOString() };
  saveGames(); res.json(games[id]);
});

app.get('/api/games/:id', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); res.json(g); });

app.get('/api/games/:id/display', (req, res) => {
  const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' });
  res.json({ id: g.id, name: g.name, status: g.status, mode: g.mode || 'classic', winCondition: g.winCondition, calledNumbers: g.calledNumbers, itemPool: g.mode === 'custom' ? g.itemPool : [], playerCount: Object.keys(g.players).length, totalCards: Object.values(g.players).reduce((s, p) => s + p.cards.length, 0), winners: g.winners, lastCalledAt: g.lastCalledAt || null });
});

app.put('/api/games/:id/roles', auth, (req, res) => { const g = games[req.params.id]; if (!g) return res.status(404).json({ error: 'Not found' }); g.roleConfig = req.body.roleConfig || {}; saveGames(); res.json({ ok: true }); });

app.post('/api/games/:id/post', auth, async (req, res) => {
  const game = games[req.params.id]; if (!game) return res.status(404).json({ error: 'Not found' }); if (game.status !== 'open') return res.status(400).json({ error: 'Not open' });
  const { channelId } = req.body; if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    let channel; for (const guild of client.guilds.cache.values()) { channel = await guild.channels.fetch(channelId).catch(() => null); if (channel) { game.guildId = guild.id; break; } }
    if (!channel) return res.status(404).json({ error: 'Channel not found' }); game.channelId = channelId;
    const roleInfo = Object.entries(game.roleConfig).map(([rid, cnt]) => `<@&${rid}> → **${cnt}** card${cnt > 1 ? 's' : ''}`).join('\n') || 'No roles configured';
    const embed = new EmbedBuilder().setTitle(`🎱 BINGO — ${game.name}`).setDescription(`**ID:** \`${game.id}\`\n**Mode:** ${game.mode === 'custom' ? '🎨 Custom' : '🔢 Classic'}\n**Win:** ${game.winCondition}\n\n**Cards per role:**\n${roleInfo}\n\nClick below to join!`).setColor(0xFF6B35).setFooter({ text: 'Make sure your DMs are open!' });
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
  saveGames(); await announceNumber(game, item); if (newWinners.length > 0) await announceWinners(game, newWinners); await sendUpdatedCards(game);
  res.json({ item, display: numberToCall(item), calledCount: game.calledNumbers.length, total: isCustom ? game.itemPool.length : 75, newWinners, totalWinners: game.winners.length });
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
