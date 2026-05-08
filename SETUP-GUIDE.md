# 🎱 BINGO SYSTEM — Full Setup Guide

Everything you need to go from zero to running. Two services:
- **Vercel** hosts the admin website + stream display page (free)
- **Railway** hosts the Discord bot + API ($5/mo)

---

## PART 1: Create the Discord Bot (5 min)

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** → name it **"BINGO"** → Create
3. Left sidebar → **"Bot"**
4. Click **"Reset Token"** → copy the token → **save it somewhere safe** (you'll need it in Part 3)
5. Scroll down to **"Privileged Gateway Intents"** and enable ALL THREE:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
   - Click **Save Changes**
6. Left sidebar → **"OAuth2"** → **"URL Generator"**
7. Under **Scopes**, check:
   - ✅ `bot`
   - ✅ `applications.commands`
8. Under **Bot Permissions**, check:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ View Channels
   - ✅ Use External Emojis
   - ✅ Mention Everyone
9. Copy the **Generated URL** at the bottom
10. Open that URL in your browser → select your Discord server → **Authorize**

The bot now appears in your server (offline until we deploy it).

---

## PART 2: Push to GitHub (3 min)

1. Create a **new repo** on GitHub (e.g. `bingo-system`), set it to **Private**
2. On your PC, extract the tar.gz, then:

```bash
cd bingo-system
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bingo-system.git
git branch -M main
git push -u origin main
```

---

## PART 3: Deploy the Bot on Railway (5 min)

1. Go to https://railway.com → **Sign in with GitHub**
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `bingo-system` repo
4. Railway will detect files — it might try to deploy the whole repo. We need to point it at just the bot folder:
   - Click on the service that appeared
   - Go to **Settings** tab
   - Under **Source**, set **Root Directory** to: `bingo-bot`
   - Under **Networking**, click **"Generate Domain"** (gives you a public URL like `bingo-bot-production-xxxx.up.railway.app`)
   - **Copy that URL** — you'll need it for Vercel
5. Go to the **Variables** tab and add these:

| Variable | Value |
|----------|-------|
| `DISCORD_TOKEN` | The token you saved from Part 1, step 4 |
| `API_KEY` | Make up a long random string (e.g. `bingo-x7k9m2p4`) |
| `PORT` | `3001` |
| `FRONTEND_URL` | `http://localhost:3000` (we'll update this after Vercel) |

6. Railway auto-deploys. Wait ~1 minute.
7. Check it works: open `https://YOUR-RAILWAY-URL.up.railway.app/api/health` in your browser. You should see:
   ```
   {"ok":true,"games":0}
   ```
8. Your bot should now show as **online** in your Discord server!

---

## PART 4: Deploy the Website on Vercel (5 min)

1. Go to https://vercel.com → **Sign in with GitHub**
2. Click **"Import Project"** → select your `bingo-system` repo
3. Vercel will ask for configuration:
   - **Root Directory**: click **Edit** and set it to `bingo-web`
   - **Framework Preset**: should auto-detect Next.js
4. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway URL from Part 3 (e.g. `https://bingo-bot-production-xxxx.up.railway.app`) — **no trailing slash** |
| `NEXT_PUBLIC_API_KEY` | The same `API_KEY` you set in Railway |

5. Click **Deploy**. Wait ~1 minute.
6. Vercel gives you a URL like `bingo-system.vercel.app` — **copy it**

---

## PART 5: Connect them (1 min)

Go back to **Railway** → your bot service → **Variables** tab:

Update `FRONTEND_URL` from `http://localhost:3000` to your Vercel URL:
```
https://bingo-system.vercel.app
```

Railway auto-redeploys with the new value. Done.

---

## PART 6: Verify everything works

1. Open your **Vercel URL** in a browser — you should see the admin panel with **● connected** in green
2. In the admin panel:
   - Click **"+ New Game"**
   - Name it "Test Game", pick Classic mode, Line win condition
   - Click **Create**
3. You'll land on the game management page
4. Under **"Role → Card Config"**, your Discord server's roles should appear in the dropdown
   - Pick a role → set card count → click Add
5. Under **"Post Join Message"**, pick a channel → click **Post**
6. Go check that Discord channel — you should see the bingo embed with a green Join button
7. Click the Join button → you should get DM'd your bingo card(s)
8. Back in the admin panel, click **"Lock Players & Start Game"**
9. Click **"Open Display →"** to see the stream page
10. Click **"Draw Random"** — the number should appear on the display page AND announce in Discord

If all that works, you're live!

---

## How to run a weekly bingo game

1. Open your Vercel admin page
2. Click **"+ New Game"**
3. Choose Classic (numbers) or Custom (your own items)
4. Set the win condition
5. Add role → card mappings
6. Post the join message to your Discord channel
7. Wait for players to join
8. Lock & start
9. Open the display page → share screen in a Discord voice channel or use OBS
10. Click Draw Random for each call
11. Bot auto-detects and announces winners
12. End game → winners show in the History tab with Discord IDs for payout

---

## Auto-deploy on push

Both services auto-deploy when you push to `main`:
- **Vercel** watches `bingo-web/` automatically
- **Railway** watches `bingo-bot/` automatically

So after initial setup, updating is just:
```bash
# edit files
git add .
git commit -m "your change"
git push
```

Both redeploy automatically. No CLI tools, no dashboards needed.

---

## Costs

- **Vercel**: Free (hobby tier)
- **Railway**: $5/mo (includes $5 usage credit, bot uses ~$1-2/mo)
- **Total: $5/mo**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Admin shows "○ disconnected" | Check `NEXT_PUBLIC_API_URL` in Vercel matches your Railway URL. Check `API_KEY` matches on both sides. |
| Bot offline in Discord | Railway → check deploy logs. Usually a wrong `DISCORD_TOKEN`. |
| "CORS error" in browser console | `FRONTEND_URL` in Railway must exactly match your Vercel URL (no trailing slash). |
| Join button does nothing | Bot might have crashed — check Railway logs. Also make sure bot intents are enabled (Part 1 step 5). |
| DMs not arriving | Player needs to have "Allow DMs from server members" enabled in their Discord privacy settings. |
| Roles dropdown empty | The bot needs the Server Members intent enabled AND needs to be in the server. |
| Display page says "Game not found" | The `/api/games/:id/display` endpoint is public (no auth). Check the game ID in the URL matches a real game. |
