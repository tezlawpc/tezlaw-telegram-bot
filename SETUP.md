# Tez Law P.C. — Telegram Bot Setup Guide

## What This Bot Does
- Answers general immigration questions in **English, Spanish, and Chinese**
- Collects lead info (name, visa type, situation) for follow-up
- Provides firm contact info when questions need attorney review
- Maintains conversation context per user

---

## Step 1: Create Your Telegram Bot (5 minutes)

1. Open Telegram and search for **@BotFather**
2. Send the message: `/newbot`
3. Choose a name for your bot, e.g.: `Tez Law Immigration Assistant`
4. Choose a username (must end in "bot"), e.g.: `TezLawBot`
5. BotFather will give you a **token** — copy it, you'll need it

Optional but recommended:
- `/setdescription` — add a description shown on the bot's profile
- `/setuserpic` — add your firm logo as the bot's avatar
- `/setcommands` — set the command menu:
  ```
  start - Start / restart the conversation
  contact - Get firm contact info
  reset - Clear conversation history
  ```

---

## Step 2: Get Your Anthropic API Key

1. Go to **console.anthropic.com**
2. Sign in or create an account
3. Go to **API Keys** → **Create Key**
4. Copy the key

---

## Step 3: Install & Run Locally

Make sure you have **Node.js 18+** installed.

```bash
# Navigate to the bot folder
cd tezlaw-telegram-bot

# Install dependencies
npm install

# Create your .env file
cp .env.example .env

# Edit .env and paste your tokens
nano .env   # or open in any text editor
```

Your `.env` file should look like:
```
TELEGRAM_BOT_TOKEN=7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
# Start the bot
npm start
```

Open Telegram, find your bot, and send `/start` — it should respond!

---

## Step 4: Deploy (So It Runs 24/7)

### Option A: Railway (Easiest — Free tier available)
1. Go to **railway.app** and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Push your bot folder to a GitHub repo first, then connect it
4. In Railway, go to **Variables** and add:
   - `TELEGRAM_BOT_TOKEN`
   - `ANTHROPIC_API_KEY`
5. Railway auto-deploys — your bot runs 24/7

### Option B: Render (Also free)
1. Go to **render.com**
2. Create a **Web Service** connected to your GitHub repo
3. Set **Start Command** to: `node bot.js`
4. Add environment variables in the dashboard

### Option C: Your own server / VPS
```bash
# Install PM2 to keep it running
npm install -g pm2

# Start with PM2
pm2 start bot.js --name tezlaw-bot

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Bot Commands Reference

| Command | What it does |
|---------|-------------|
| `/start` | Welcomes user, resets conversation |
| `/contact` | Shows firm phone, email, address |
| `/reset` | Clears conversation history |

---

## Costs

| Service | Cost |
|---------|------|
| Telegram Bot API | **Free** |
| Railway/Render hosting | **Free** (hobby tier) |
| Anthropic API | ~$0.003 per conversation turn (very low) |

For typical usage (50–100 inquiries/month), Anthropic API costs would be under **$5/month**.

---

## Customization

To change what the bot says or knows, edit the `SYSTEM_PROMPT` in `bot.js`. You can:
- Add specific practice areas to focus on
- Include your office hours
- Add instructions for specific visa types you handle most
- Adjust the tone (more formal, more casual)

---

## Questions?

Contact your developer or refer to:
- Telegram Bot API docs: https://core.telegram.org/bots
- Anthropic API docs: https://docs.anthropic.com
