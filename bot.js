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
Example: "That's urgent — please call us right now at 626-678-8677."

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

============================
WHEN CLIENTS ASK ABOUT THEIR CASE
============================

If anyone asks about their case status, hearing date, document status, USCIS receipt, or anything specific to their matter — DO NOT try to look it up. Instead:

1. Acknowledge their question warmly
2. Let them know you'll flag it for the team right away
3. Ask for their name and best contact if you don't already have it
4. Reassure them someone will follow up soon

Example: "Good question — I want to make sure you get accurate info on that. Let me flag this for the team right away and someone will be in touch shortly. Can I get your name and best number or email?"

CASE QUESTION KEYWORDS to watch for:
- "my case", "my hearing", "my application", "my green card", "my visa"
- "status", "update", "when is", "what happened to", "approved", "denied", "pending"
- "USCIS", "court date", "petition", "receipt number", "priority date"
- "document", "form", "submitted", "filed"
- "my lawyer", "attorney", "JJ", "Jue", "Michael", "Lin"

Keep it warm — never make them feel brushed off. This is important to them.

============================
GENERAL AI ASSISTANT
============================

You are not just a legal assistant — you are also a helpful general AI assistant. If someone asks you something outside of law (nearby places, recommendations, general questions, translations, math, etc.), just help them! You happen to work for a law firm but you are a smart, helpful friend first.

LOCATION-BASED REQUESTS:
If someone asks for nearby places (restaurants, pizza, stores, pharmacies, etc.):
1. Ask for their current location, neighborhood, or zip code if you don't have it
2. Suggest nearby options in that area based on your knowledge
3. Give names and general area — tell them to use Google Maps for live directions
4. After helping, naturally mention you're also available for legal questions

Example:
Client: "Where's the nearest pizza place?"
Zara: "Happy to help! What area are you in? Share your location or zip code and I'll point you in the right direction 🍕"

Client: "I'm in West Covina"
Zara: "West Covina has some great spots! Pizza Hut on Amar Rd, Shakey's on Azusa Ave, and Round Table on Garvey Ave are popular. Check Google Maps for directions and current hours! And if you ever need legal help, I'm here for that too 😊"

GENERAL KNOWLEDGE:
Answer questions about history, science, math, cooking, travel, general health info, technology, sports, entertainment, etc.

TRANSLATION:
Help translate words or phrases between English, Spanish, and Chinese.

TONE FOR NON-LEGAL QUESTIONS:
Be warm, casual, and genuinely helpful. Don't force legal topics into every response — just be a good assistant. Only mention legal services if it naturally fits.

ALWAYS remember: You represent Tez Law P.C. Stay professional and never say anything embarrassing or inappropriate.

============================
LEGAL RESEARCH — WEB SEARCH
============================

You have access to a web search tool. Use it when a client asks a specific legal question that requires looking up a current statute, regulation, or policy.

WHEN TO SEARCH:
- Specific INA section questions (e.g. "what does INA 240A say?")
- USCIS policy questions (e.g. "what is the income requirement for I-864?")
- CFR regulation questions (e.g. "what does 8 CFR 214.2 say?")
- BIA decisions or removal proceeding questions
- California Vehicle Code questions (car accidents)
- California Civil Code or CCP questions (litigation)
- California Probate Code questions (estate planning)
- USPTO trademark or patent questions
- Any question about a specific law, statute, or regulation

SEARCH SOURCES BY PRACTICE AREA:
- Immigration: site:uscis.gov OR site:justice.gov/eoir OR site:ecfr.gov
- Car Accidents/PI: site:leginfo.legislature.ca.gov (California Vehicle Code, Civil Code)
- Business Litigation: site:leginfo.legislature.ca.gov (CCP, Commercial Code)
- Estate Planning: site:leginfo.legislature.ca.gov (Probate Code)
- Patents/Trademarks: site:uspto.gov

AFTER SEARCHING:
1. Quote the key relevant language briefly (1-3 sentences max)
2. Cite the source (e.g. "According to INA § 240A...")
3. Always add: "For how this applies to your specific situation, [attorney name] can give you proper legal advice — [contact info]"

NEVER give a definitive legal conclusion. Always route to the attorney for specific advice.

============================
DISTRESS DETECTION — CRITICAL
============================

ALWAYS watch for signs that a client is in crisis or distress. These situations require IMMEDIATE escalation to the team.

HIGH URGENCY — respond with emergency message AND notify team immediately:
- ICE raid, detention, or arrest (self or family member)
- "They took my husband/wife/child"
- "I got a notice to appear" / NTA received
- Car accident that just happened
- Someone is injured right now
- "I'm being deported" / removal order
- Domestic violence situation
- "I'm scared" / "I don't know what to do" / "please help me"
- Court date is tomorrow or very soon
- Criminal charges related to immigration

MEDIUM URGENCY — respond with warm empathy + offer to connect with team:
- Lost job due to immigration status
- Visa expired or expiring soon
- Denied benefits or application
- Family separated
- Emotional distress about case outcome

FOR HIGH URGENCY situations, your response must:
1. Acknowledge their distress warmly and immediately ("I hear you, this is serious and you're not alone")
2. Give the firm's direct number: 626-678-8677
3. Tell them NOT to sign anything without speaking to an attorney first
4. Keep it SHORT and action-focused — they don't need a lecture, they need help

Example high urgency response:
"I hear you — this is serious and you're not alone. Please call us RIGHT NOW at 626-678-8677. Do NOT sign anything until you speak with an attorney. They are available to help you."`;






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

// ── Smart Legal Research Cache ────────────────────────────
const fs = require("fs");
const CACHE_FILE = "/var/data/legal_cache.json";

// Cache TTL in milliseconds by content type
const CACHE_TTL = {
  statute: 30 * 24 * 60 * 60 * 1000,      // 30 days — INA, CFR, CA codes (stable)
  caselaw: 7 * 24 * 60 * 60 * 1000,        // 7 days — BIA decisions, case law (updates)
  policy: 7 * 24 * 60 * 60 * 1000,         // 7 days — USCIS policy manual
  fees: 3 * 24 * 60 * 60 * 1000,           // 3 days — processing times, fees (frequent changes)
  general: 14 * 24 * 60 * 60 * 1000,       // 14 days — general legal info
};

function detectCacheType(question) {
  const q = question.toLowerCase();
  if (q.includes("processing time") || q.includes("fee") || q.includes("cost") || q.includes("how long")) return "fees";
  if (q.includes("bia") || q.includes("case law") || q.includes("decision") || q.includes("matter of")) return "caselaw";
  if (q.includes("policy") || q.includes("uscis policy") || q.includes("policy manual")) return "policy";
  if (q.includes("ina") || q.includes("cfr") || q.includes("vehicle code") || q.includes("civil code") ||
      q.includes("probate code") || q.includes("statute") || q.includes("section") || q.includes("§")) return "statute";
  return "general";
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch (e) {
    console.log("Cache load error:", e.message);
  }
  return {};
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.log("Cache save error:", e.message);
  }
}

function getCacheKey(message) {
  // Normalize the question to a cache key
  return message.toLowerCase().trim().replace(/[^a-z0-9\s§]/g, "").replace(/\s+/g, "_").substring(0, 100);
}

function getCachedAnswer(message) {
  const cache = loadCache();
  const key = getCacheKey(message);
  const entry = cache[key];
  if (!entry) return null;

  const cacheType = detectCacheType(message);
  const ttl = CACHE_TTL[cacheType];
  const age = Date.now() - entry.timestamp;

  if (age > ttl) {
    console.log(`Cache expired for "${key}" (type: ${cacheType}, age: ${Math.round(age/86400000)}d)`);
    return null;
  }

  console.log(`✅ Cache hit for "${key}" (type: ${cacheType}, age: ${Math.round(age/3600000)}h)`);
  return entry.answer;
}

function setCachedAnswer(message, answer) {
  const cache = loadCache();
  const key = getCacheKey(message);
  cache[key] = {
    answer,
    timestamp: Date.now(),
    type: detectCacheType(message),
    question: message.substring(0, 100)
  };
  saveCache(cache);
}

function isLegalResearchQuestion(message) {
  const q = message.toLowerCase();
  const legalKeywords = [
    "ina", "cfr", "§", "section", "statute", "code", "regulation",
    "uscis", "bia", "eoir", "removal", "deportation",
    "vehicle code", "civil code", "probate code", "ccp",
    "uspto", "patent", "trademark",
    "processing time", "filing fee", "form i-",
    "case law", "matter of", "decision", "ruling",
    "what does", "what is the law", "is it legal", "what are the requirements"
  ];
  return legalKeywords.some(kw => q.includes(kw));
}

async function askClaude(chatId, userMessage) {
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: "user", content: userMessage });
  const recentHistory = conversations[chatId].slice(-20);

  // Check cache for legal research questions
  if (isLegalResearchQuestion(userMessage)) {
    const cached = getCachedAnswer(userMessage);
    if (cached) {
      conversations[chatId].push({ role: "assistant", content: cached });
      return cached;
    }
  }

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search"
        }
      ],
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

  // Extract text from response — may include tool use blocks
  const reply = response.data.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("") || "Let me connect you with our team for that. Call us at 626-678-8677 or email jj@tezlawfirm.com.";
  conversations[chatId].push({ role: "assistant", content: reply });

  // Cache legal research answers for future use
  if (isLegalResearchQuestion(userMessage) && reply.length > 50) {
    setCachedAnswer(userMessage, reply);
  }

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
    const recentMessages = history.slice(-6).map(m =>
      `${m.role === "user" ? "Client" : "Zara"}: ${m.content.substring(0, 100)}`
    ).join("\n");

    const TEAM_CHAT_ID = process.env.TEAM_TELEGRAM_CHAT_ID;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN;

    if (TEAM_CHAT_ID && TELEGRAM_BOT_TOKEN) {
      const message =
        `🆕 New Lead from ${platform}!\n\n` +
        `${phone ? `📞 Phone: ${phone}\n` : ""}` +
        `${email ? `📧 Email: ${email}\n` : ""}` +
        `\n💬 Recent chat:\n${recentMessages}\n\n` +
        `⚡ Please follow up ASAP!`;

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TEAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown"
      });

      console.log(`✅ Lead notification sent to team Telegram — ${phone || email}`);
    } else {
      console.log(`LEAD DETECTED on ${platform}: ${phone || email}`);
    }
  } catch (err) {
    console.error("Lead notification error:", err.message);
  }
}

// ── Distress detection ────────────────────────────────────
function detectDistress(message) {
  const msg = message.toLowerCase();
  const highUrgency = [
    "ice", "detained", "arrested", "deportation", "deported", "removal",
    "notice to appear", "nta", "they took", "raid", "emergency",
    "accident just happened", "injured", "hospital", "bleeding",
    "scared", "please help", "don't know what to do", "help me",
    "court tomorrow", "hearing tomorrow", "sign anything",
    "拘留", "被抓", "遣返", "紧急", "帮我", "害怕",
    "detenido", "arrestado", "deportación", "ayúdame", "miedo"
  ];
  const mediumUrgency = [
    "visa expired", "status expired", "out of status", "denied",
    "lost my job", "fired", "separated", "family separated",
    "don't know what to do", "worried", "desperate", "no options"
  ];
  if (highUrgency.some(kw => msg.includes(kw))) return "high";
  if (mediumUrgency.some(kw => msg.includes(kw))) return "medium";
  return "none";
}

// ── Notify team of distress ───────────────────────────────
async function notifyTeamDistress(userId, userMessage, urgency, platform) {
  try {
    const TEAM_CHAT_ID = process.env.TEAM_TELEGRAM_CHAT_ID;
    const TEAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN;
    if (!TEAM_CHAT_ID || !TEAM_BOT_TOKEN) return;

    const emoji = urgency === "high" ? "🚨" : "⚠️";
    const label = urgency === "high" ? "HIGH URGENCY" : "MEDIUM URGENCY";
    const notification =
      `${emoji} ${label} — ${platform}\n\n` +
      `Client message: "${userMessage.substring(0, 200)}"\n\n` +
      `Please follow up immediately!\n📞 626-678-8677`;

    await axios.post(`https://api.telegram.org/bot${TEAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TEAM_CHAT_ID,
      text: notification
    });
    console.log(`🚨 Distress notification sent (${urgency})`);
  } catch (err) {
    console.error("Distress notification error:", err.message);
  }
}


async function downloadTelegramFile(fileId) {
  const resp = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId } });
  const filePath = resp.data.result.file_path;
  const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  const fileResp = await axios.get(url, { responseType: "arraybuffer" });
  const ext = filePath.split(".").pop().toLowerCase();
  return { buffer: Buffer.from(fileResp.data), extension: ext };
}

function getImageMediaType(ext) {
  const map = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
  return map[ext] || "image/jpeg";
}

async function askClaudeWithImage(chatId, imageBuffer, mediaType, caption) {
  const base64 = imageBuffer.toString("base64");
  const userPrompt = caption || "Please analyze this image and describe what you see. If it's a legal document, explain what it is and what it means.";
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: userPrompt }
        ]
      }]
    },
    { headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
  );
  const reply = response.data.content.filter(b => b.type === "text").map(b => b.text).join("") || "I had trouble analyzing that image. Please try again or contact us at 626-678-8677.";
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: "user", content: `[Image sent] ${caption || ""}` });
  conversations[chatId].push({ role: "assistant", content: reply });
  return reply;
}

async function askClaudeWithPDF(chatId, pdfBuffer, caption) {
  const base64 = pdfBuffer.toString("base64");
  const userPrompt = caption || "Please analyze this PDF document. If it's a legal document, explain what it is, what it means, and what action may be needed.";
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: userPrompt }
        ]
      }]
    },
    { headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
  );
  const reply = response.data.content.filter(b => b.type === "text").map(b => b.text).join("") || "I had trouble reading that PDF. Please try again or contact us at 626-678-8677.";
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: "user", content: `[PDF sent] ${caption || ""}` });
  conversations[chatId].push({ role: "assistant", content: reply });
  return reply;
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  console.log("Webhook received:", JSON.stringify(req.body).substring(0, 200));

  const update = req.body;
  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const caption = message.caption || "";
  const firstName = message.from?.first_name || "there";

  try {
    // ── PHOTO ──────────────────────────────────────────────
    if (message.photo && message.photo.length > 0) {
      await axios.post(`${TELEGRAM_API}/sendChatAction`, { chat_id: chatId, action: "typing" });
      const bestPhoto = message.photo[message.photo.length - 1];
      const { buffer, extension } = await downloadTelegramFile(bestPhoto.file_id);
      const reply = await askClaudeWithImage(chatId, buffer, getImageMediaType(extension), caption);
      await sendMessage(chatId, reply);
      return;
    }

    // ── DOCUMENT ───────────────────────────────────────────
    if (message.document) {
      await axios.post(`${TELEGRAM_API}/sendChatAction`, { chat_id: chatId, action: "typing" });
      const doc = message.document;
      const { buffer, extension } = await downloadTelegramFile(doc.file_id);
      if (doc.mime_type === "application/pdf") {
        const reply = await askClaudeWithPDF(chatId, buffer, caption);
        await sendMessage(chatId, reply);
      } else if (["image/jpeg","image/png","image/gif","image/webp"].includes(doc.mime_type)) {
        const reply = await askClaudeWithImage(chatId, buffer, doc.mime_type, caption);
        await sendMessage(chatId, reply);
      } else {
        await sendMessage(chatId, "I can read images (JPEG, PNG, WebP) and PDF documents. Please resend in one of those formats, or describe your question in text.");
      }
      return;
    }

    // ── TEXT ───────────────────────────────────────────────
    if (!message.text) return;
    const userText = message.text;
    console.log("Message from:", firstName, "text:", userText);

    if (userText === "/start") {
      conversations[chatId] = [];
      await sendMessage(chatId,
        `Hi ${firstName}! Welcome to Tez Law P.C.\n\nI can help you with:\n\nImmigration\nCar Accidents & Personal Injury\nBusiness Litigation\nPatents & Trademarks\nEstate Planning\n\nYou can also send me photos or PDFs of legal documents and I'll explain them.\n\nJust tell me what's going on!\n\nPara espanol, escribame en espanol.\n如需中文服务，请用中文留言。`
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

    // Check for distress and notify team
    const urgency = detectDistress(userText);
    if (urgency !== "none") {
      await notifyTeamDistress(chatId, userText, urgency, "Telegram");
    }

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

// ── Website Chat (/chat endpoint) ────────────────────────────
// In-memory sessions for website chat visitors (keyed by sessionId)
const webSessions = {};

app.post("/chat", async (req, res) => {
  // Allow requests from tezlawfirm.com and localhost
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  const { message, sessionId } = req.body;
  if (!message || !sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  try {
    if (!webSessions[sessionId]) webSessions[sessionId] = [];
    webSessions[sessionId].push({ role: "user", content: message });
    const recentHistory = webSessions[sessionId].slice(-20);

    // Check cache for legal research
    if (isLegalResearchQuestion(message)) {
      const cached = getCachedAnswer(message);
      if (cached) {
        webSessions[sessionId].push({ role: "assistant", content: cached });
        return res.json({ reply: cached });
      }
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
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

    const reply = response.data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("") || "Let me connect you with our team. Call us at 626-678-8677 or email jj@tezlawfirm.com.";

    webSessions[sessionId].push({ role: "assistant", content: reply });

    if (isLegalResearchQuestion(message) && reply.length > 50) {
      setCachedAnswer(message, reply);
    }

    // Lead detection for website visitors
    await checkAndNotifyLead(sessionId, message, reply, "Website");

    // Distress detection for website visitors
    const urgency = detectDistress(message);
    if (urgency !== "none") {
      await notifyTeamDistress(sessionId, message, urgency, "Website");
    }

    res.json({ reply });
  } catch (err) {
    console.error("Web chat error:", err.response?.data || err.message);
    res.status(500).json({ reply: "Having trouble connecting. Please call us at 626-678-8677 or email jj@tezlawfirm.com." });
  }
});

// Handle CORS preflight
app.options("/chat", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);

  // ── Keep-alive ping (prevents Render free tier from sleeping) ──
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://tezlaw-assistant.onrender.com";
  setInterval(() => {
    axios.get(RENDER_URL).catch(() => {});
  }, 4 * 60 * 1000); // ping every 4 minutes
  console.log("Keep-alive ping started →", RENDER_URL);
});
