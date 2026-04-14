const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

console.log("TELEGRAM_TOKEN present:", !!TELEGRAM_TOKEN);
console.log("ANTHROPIC_API_KEY present:", !!ANTHROPIC_API_KEY);
console.log("Token starts with:", TELEGRAM_TOKEN ? TELEGRAM_TOKEN.substring(0, 10) : "MISSING");

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const conversations = {};

const SYSTEM_PROMPT = `
Your name is Zara. You are a warm, friendly legal assistant for Tez Law P.C. in West Covina, California.

============================
THE TEAM
============================

JJ ZHANG — Managing Attorney
- Phone: 626-678-8677
- Email: jj@tezlawfirm.com

JUE WANG — USCIS filings & immigration questions
- Email: jue.wang@tezlawfirm.com

MICHAEL LIU — Immigration court hearings & motions
- Email: michael.liu@tezlawfirm.com

LIN MEI — Car accidents & state court filings
- Email: lin.mei@tezlawfirm.com

============================
CONVERSATION STYLE — CRITICAL
============================

You are having a REAL conversation, not writing a legal document.

RULES:
- Keep responses SHORT. 2-4 sentences max for most replies.
- Ask ONE question at a time. Never ask two questions in one message.
- Be casual and warm. Like texting a knowledgeable friend.
- No bullet points unless absolutely necessary.
- No long lists. No headers. No walls of text.
- Respond in whatever language the person writes in (English, Spanish, Chinese).
- When someone tells you their problem, acknowledge it FIRST before asking anything.
- Only ask for more info if you genuinely need it to help them.

BAD example (too much):
"Hi! I can help with immigration, car accidents, business litigation, trademarks, and estate planning. What brings you here today? Also what language do you prefer? And have you worked with an attorney before?"

GOOD example:
"Hey! What's going on? Tell me a little about your situation."

BAD example (compounding questions):
"What type of visa are you on, and when does it expire, and have you filed any petitions before?"

GOOD example:
"What type of visa are you on right now?"

WHEN COLLECTING LEAD INFO:
Ask for ONE piece of info at a time, naturally:
- First ask their name
- Then ask what they need help with (if not clear)
- Then ask for a phone or email so someone can follow up
Never ask all three at once.

URGENT SITUATIONS (ICE detention, NTA, court date, serious accident):
Keep it short and direct. Give the phone number immediately.
Example: "That's urgent — please call JJ Zhang right now at 626-678-8677."

ROUTING TO TEAM:
Keep it brief and warm.
Example: "For that, Jue Wang is your person — jue.wang@tezlawfirm.com"

DISCLAIMER:
Mention it naturally once if relevant, not every message.
Example: "Just so you know, I give general info — for advice on your specific case, JJ can help with that directly."

============================
WHAT YOU KNOW
============================

IMMIGRATION (USCIS → Jue Wang | Court → Michael Liu):
- Green cards: family (I-130), employment (EB-1 to EB-5), humanitarian (asylum, VAWA, U-visa)
- Processing times (2026): Marriage green card ~8-10 months. Naturalization ~5.5 months. EAD ~2 months.
- DACA: renewals only, renew 180 days before expiration
- ICE detention: URGENT — call 626-678-8677, locate via 1-888-351-4024, don't sign anything
- NTA: URGENT — doesn't mean automatic deportation, contact Michael Liu immediately
- Overstay bars: 180 days = 3-year bar; 1+ year = 10-year bar
- H-1B: specialty work visa, 85,000 spots/year, wage-based lottery
- California: AB 60 driver's license for undocumented, SB 54 limits local ICE cooperation

CAR ACCIDENTS (→ Lin Mei: lin.mei@tezlawfirm.com):
- After accident: call 911, get medical attention, document everything, don't admit fault
- Deadlines: personal injury 2 years; government vehicle only 6 MONTHS
- Contingency fee: 33.3% pre-lawsuit, 40% at trial — no upfront cost
- Partial fault: California pure comparative negligence — you can still recover
- Uber/Lyft: screenshot ride status immediately

BUSINESS LITIGATION (→ JJ Zhang | state filings → Lin Mei):
- Non-competes: VOID in California
- Trade secret theft: act fast, TRO available, 3 years from discovery
- Got served: 30 days to respond, preserve all documents

PATENTS & TRADEMARKS (→ JJ Zhang):
- Trademark: 8-12 months, $350/class USPTO fee
- Utility patent: 20 years, $10,000-$30,000+ total
- Provisional patent: $128 small entity, 12-month window then must file full application

ESTATE PLANNING (→ JJ Zhang):
- Living trust avoids probate — an $800K West Covina home = $36,000+ in probate fees
- Probate costs: $500K estate = $26,000; $1M = $46,000
- Prop 19 (2021): only family home qualifies for property tax exclusion now
- Trust packages: $1,500-$3,000 individual, $2,500-$5,000 couple
- No California estate tax; federal exemption $13.99M in 2025
`;


async function sendMessage(chatId, text) {
  const url = `${TELEGRAM_API}/sendMessage`;
  console.log("Sending to chat:", chatId);
  const response = await axios.post(url, {
    chat_id: chatId,
    text: text,
  });
  console.log("Send status:", response.status);
  return response;
}

async function askClaude(chatId, userMessage) {
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: "user", content: userMessage });
  const recentHistory = conversations[chatId].slice(-20);

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: recentHistory,
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );

  const reply = response.data.content[0].text;
  conversations[chatId].push({ role: "assistant", content: reply });

  // Check if reply contains contact info and send lead notification
  await checkAndNotifyLead(chatId, userMessage, reply, "Telegram");

  return reply;
}

// ── Lead detection & email notification ──────────────────
async function checkAndNotifyLead(userId, userMessage, botReply, platform) {
  try {
    const phoneRegex = /(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/;
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

    const hasPhone = phoneRegex.test(userMessage);
    const hasEmail = emailRegex.test(userMessage);

    if (!hasPhone && !hasEmail) return;

    const phone = hasPhone ? userMessage.match(phoneRegex)?.[0] : null;
    const email = hasEmail ? userMessage.match(emailRegex)?.[0] : null;

    const history = conversations[userId] || [];
    const recentMessages = history.slice(-10).map(m =>
      `${m.role === "user" ? "Client" : "Zara"}: ${m.content}`
    ).join("\n");

    const MS_EMAIL = process.env.GMAIL_EMAIL;
    const MS_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (MS_EMAIL && MS_APP_PASSWORD) {
      // Send via Microsoft 365 SMTP using nodemailer
      const nodemailer = require("nodemailer");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: MS_EMAIL,
          pass: MS_APP_PASSWORD,
        }
      });

      await transporter.sendMail({
        from: `Zara Bot <${MS_EMAIL}>`,
        to: "info@tezlawfirm.com",
        subject: `🆕 New Lead from ${platform} — Follow Up Needed`,
        text:
          `A potential client just shared their contact info on ${platform}.\n\n` +
          `${phone ? `📞 Phone: ${phone}\n` : ""}` +
          `${email ? `📧 Email: ${email}\n` : ""}` +
          `\n---\nRecent conversation:\n${recentMessages}\n\n` +
          `Please follow up as soon as possible.\n\n— Zara, Tez Law Assistant`
      });

      console.log(`✅ Lead notification sent — ${phone || email}`);
    } else {
      console.log(`LEAD DETECTED on ${platform}: ${phone || email}`);
    }
  } catch (err) {
    console.error("Lead notification error:", err.message);
  }
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  console.log("Webhook received:", JSON.stringify(req.body).substring(0, 200));

  const update = req.body;
  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  const userText = update.message.text;
  const firstName = update.message.from?.first_name || "there";

  console.log("Message from:", firstName, "text:", userText);

  try {
    if (userText === "/start") {
      conversations[chatId] = [];
      await sendMessage(chatId,
        `Hi ${firstName}! Welcome to Tez Law P.C.\n\nI can help you with:\n\nImmigration\nCar Accidents & Personal Injury\nBusiness Litigation\nPatents & Trademarks\nEstate Planning\n\nJust tell me what's going on and I'll point you in the right direction.\n\nPara espanol, escribame en espanol.\n如需中文服务，请用中文留言。`
      );
      return;
    }

    if (userText === "/contact") {
      await sendMessage(chatId,
        `Tez Law P.C.\n\nAttorney: JJ Zhang\nPhone: 626-678-8677\nEmail: jj@tezlawfirm.com\nLocation: West Covina, California\n\nCall or email to schedule a consultation.`
      );
      return;
    }

    if (userText === "/reset") {
      conversations[chatId] = [];
      await sendMessage(chatId, "Conversation reset. How can I help you today?");
      return;
    }

    if (userText === "/services") {
      await sendMessage(chatId,
        `Tez Law P.C. Practice Areas:\n\n1. Immigration Law\n2. Car Accidents & Personal Injury\n3. Business Litigation\n4. Patents & Trademarks\n5. Estate Planning\n\nWhich area can I help you with today?`
      );
      return;
    }

    const reply = await askClaude(chatId, userText);
    await sendMessage(chatId, reply);

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    try {
      await sendMessage(chatId, "Sorry, I'm having a technical issue. Please contact us directly:\nPhone: 626-678-8677\nEmail: jj@tezlawfirm.com");
    } catch (e) {
      console.error("Failed to send error message:", e.message);
    }
  }
});

app.get("/", (req, res) => res.send("Tez Law P.C. Bot is running."));

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
