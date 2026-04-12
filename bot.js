const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const conversations = {};

const SYSTEM_PROMPT = `You are a helpful immigration law assistant for Tez Law P.C., a law firm based in West Covina, California. The firm's contact information is:
- Phone: 626-678-8677
- Email: jj@tezlawfirm.com
- Attorney: JJ Zhang

Your role:
1. Answer general immigration questions clearly and helpfully (EB-1, EB-2, EB-3, asylum, withholding of removal, adjustment of status, family petitions, DACA, TPS, visas, etc.)
2. Proactively collect lead information when someone seems like a potential client: ask for their name, their immigration situation/visa type they need, their country of origin, and a contact email or phone.
3. When you cannot answer a question or the person needs legal representation, always provide the firm contact info AND offer to collect their information so the attorney can follow up.

IMPORTANT RULES:
- You are NOT a licensed attorney and cannot give legal advice. Always clarify that your answers are general information only and they should consult with Attorney JJ Zhang for advice specific to their situation.
- Do NOT quote specific fees or timelines unless they are well-established government filing fees.
- Do NOT make promises about case outcomes.
- Be warm, professional, and reassuring.
- Respond in whatever language the user writes in. You support English, Spanish, and Chinese Simplified.
- Keep responses concise - this is a messaging app, not a document.
- When collecting lead info, do it naturally in the conversation.

Firm focus areas: employment-based immigration, asylum, withholding of removal, family-based immigration, removal defense, civil litigation.`;

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    });
  } catch (err) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
  }
}

async function askClaude(chatId, userMessage) {
  if (!conversations[chatId]) {
    conversations[chatId] = [];
  }

  conversations[chatId].push({ role: "user", content: userMessage });

  const recentHistory = conversations[chatId].slice(-20);

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
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

  const assistantMessage = response.data.content[0].text;
  conversations[chatId].push({ role: "assistant", content: assistantMessage });

  return assistantMessage;
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  const userText = update.message.text;
  const firstName = update.message.from?.first_name || "there";

  try {
    if (userText === "/start") {
      conversations[chatId] = [];
      await sendMessage(
        chatId,
        `👋 Hi ${firstName}! Welcome to *Tez Law P.C.*\n\nI'm the firm's immigration assistant. I can help answer general questions about visas, green cards, asylum, and other immigration matters in English, Spanish, or Chinese.\n\nHow can I help you today?\n\n_Para español, escríbame en español. 如需中文服务，请用中文留言。_`
      );
      return;
    }

    if (userText === "/reset") {
      conversations[chatId] = [];
      await sendMessage(chatId, "Conversation reset. How can I help you?");
      return;
    }

    if (userText === "/contact") {
      await sendMessage(
        chatId,
        `📞 *Tez Law P.C.*\n\n• Attorney: JJ Zhang\n• Phone: 626-678-8677\n• Email: jj@tezlawfirm.com\n• Location: West Covina, California\n\nFeel free to call or email to schedule a consultation.`
      );
      return;
    }

    const reply = await askClaude(chatId, userText);
    await sendMessage(chatId, reply);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    await sendMessage(
      chatId,
      "Sorry, I'm having a technical issue. Please contact the firm directly:\n📞 626-678-8677\n📧 jj@tezlawfirm.com"
    );
  }
});

app.get("/", (req, res) => res.send("Tez Law Bot is running."));

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
