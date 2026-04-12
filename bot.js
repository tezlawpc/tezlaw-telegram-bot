require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Anthropic = require("@anthropic-ai/sdk");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory conversation store (use Redis/DB for production)
const conversations = {};
const leadData = {};

const FIRM_INFO = {
  name: "Tez Law P.C.",
  attorney: "JJ Zhang",
  phone: "626-678-8677",
  email: "jj@tezlawfirm.com",
  location: "West Covina, California",
};

const SYSTEM_PROMPT = `You are an immigration law assistant for ${FIRM_INFO.name}, a law firm in ${FIRM_INFO.location} run by attorney ${FIRM_INFO.attorney}. 

YOUR ROLE:
- Answer general immigration questions helpfully and accurately
- Handle inquiries about: family-based immigration, employment-based visas (EB-1, EB-2, EB-3), asylum, removal defense, green cards, naturalization, deportation defense, and related matters
- Collect lead information when appropriate (name, visa type of interest, brief situation)
- Communicate fluently in English, Spanish, and Chinese (Simplified) — detect the user's language and respond in kind

IMPORTANT BOUNDARIES:
- You are NOT providing legal advice — always clarify this when discussing specific situations
- Do NOT quote specific filing fees (they change) — say fees vary and a consultation is needed
- Do NOT make promises about case outcomes
- For complex or specific legal situations, always recommend a consultation

LEAD COLLECTION:
When a user has a specific situation or seems interested in hiring the firm, naturally collect:
1. Their first name
2. What type of immigration matter they need help with
3. A brief description of their situation
Then let them know the firm will follow up.

WHEN YOU CAN'T ANSWER or the question requires legal advice:
- Provide the firm's contact info: phone ${FIRM_INFO.phone}, email ${FIRM_INFO.email}
- Offer to take their name and contact situation so the firm can follow up
- Always be warm and helpful, never dismissive

TONE: Professional but approachable. Concise — this is a messaging app, not an essay. Use plain language.

Start conversations warmly. If the user writes in Spanish, respond fully in Spanish. If they write in Chinese, respond fully in Chinese (Simplified).`;

async function getClaudeResponse(chatId, userMessage) {
  if (!conversations[chatId]) {
    conversations[chatId] = [];
  }

  conversations[chatId].push({
    role: "user",
    content: userMessage,
  });

  // Keep last 20 messages to manage context
  if (conversations[chatId].length > 20) {
    conversations[chatId] = conversations[chatId].slice(-20);
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: conversations[chatId],
  });

  const assistantMessage = response.content[0].text;

  conversations[chatId].push({
    role: "assistant",
    content: assistantMessage,
  });

  return assistantMessage;
}

// Welcome message on /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  conversations[chatId] = []; // Reset conversation

  const welcomeMessage = `👋 Welcome to ${FIRM_INFO.name}!

I'm the firm's virtual assistant. I can help answer general immigration questions in English, Spanish, or Chinese (中文 / Español).

You can ask me about:
• 🇺🇸 Green cards & family petitions
• 💼 Work visas (EB-1, EB-2, EB-3, H-1B)
• 🛡️ Asylum & removal defense
• 📋 Naturalization & citizenship
• And more...

For a consultation with Attorney ${FIRM_INFO.attorney}, contact us:
📞 ${FIRM_INFO.phone}
📧 ${FIRM_INFO.email}

How can I help you today?`;

  bot.sendMessage(chatId, welcomeMessage);
});

// Reset conversation
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  conversations[chatId] = [];
  bot.sendMessage(
    chatId,
    "Conversation reset. How can I help you? / ¿En qué puedo ayudarte? / 我能帮您什么？"
  );
});

// Contact info command
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `📍 ${FIRM_INFO.name}\n👨‍⚖️ Attorney: ${FIRM_INFO.attorney}\n📞 ${FIRM_INFO.phone}\n📧 ${FIRM_INFO.email}\n📍 ${FIRM_INFO.location}`
  );
});

// Handle all other messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Skip commands
  if (!text || text.startsWith("/")) return;

  // Show typing indicator
  bot.sendChatAction(chatId, "typing");

  try {
    const response = await getClaudeResponse(chatId, text);
    bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error:", error);
    bot.sendMessage(
      chatId,
      `Sorry, I encountered an error. Please try again or contact us directly:\n📞 ${FIRM_INFO.phone}\n📧 ${FIRM_INFO.email}`
    );
  }
});

console.log(`✅ ${FIRM_INFO.name} Telegram bot is running...`);
