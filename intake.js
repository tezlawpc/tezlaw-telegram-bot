// ============================================================
//  intake.js — Conversational Intake Form for Zara
//  Tez Law P.C.
//
//  HOW IT WORKS:
//  1. Zara detects when a client is ready for intake
//  2. Runs a short conversational flow to collect info
//  3. Saves to PostgreSQL and emails the team
//
//  HOW TO USE IN EACH BOT:
//  const { checkIntake, processIntake } = require("./intake");
//  In your processMessage function, call checkIntake() first.
// ============================================================

const axios  = require("axios");
const db     = require("./db");
const nodemailer = require("nodemailer");

// ── In-memory intake state per user (platform:id → state) ──
const intakeState = {};

// ── Phrases that trigger intake flow ────────────────────────
const INTAKE_TRIGGERS = [
  "i need help", "i want to talk", "i want to speak", "schedule a consultation",
  "schedule an appointment", "book a consultation", "free consultation",
  "speak to an attorney", "speak to a lawyer", "talk to someone",
  "call me", "contact me", "follow up", "get in touch",
  "i'm ready", "let's get started", "how do i start",
  "what do i need to do", "how much does it cost", "how much do you charge",
  "quiero hablar", "necesito ayuda", "llamarme", "consulta",
  "我想咨询", "联系我", "预约", "需要帮助",
];

function shouldTriggerIntake(message) {
  const m = message.toLowerCase();
  return INTAKE_TRIGGERS.some(t => m.includes(t));
}

// ── Intake flow questions ─────────────────────────────────
const INTAKE_STEPS = [
  {
    key: "name",
    question: {
      en: "I'd love to get you connected with our team! First, what's your name?",
      es: "¡Me encantaría conectarte con nuestro equipo! Primero, ¿cómo te llamas?",
      zh: "我很乐意帮你联系我们的团队！首先，请问你叫什么名字？",
    }
  },
  {
    key: "issue",
    question: {
      en: "Nice to meet you, {name}! In a sentence or two, what do you need help with?",
      es: "¡Mucho gusto, {name}! En pocas palabras, ¿en qué necesitas ayuda?",
      zh: "很高兴认识你，{name}！简单说一下，你需要什么方面的帮助？",
    }
  },
  {
    key: "contact",
    question: {
      en: "Got it. What's the best phone number or email to reach you? The team will follow up within 1 business day.",
      es: "Entendido. ¿Cuál es el mejor número de teléfono o correo electrónico para contactarte? El equipo se pondrá en contacto en 1 día hábil.",
      zh: "明白了。请留下你的电话号码或电子邮件，我们的团队会在1个工作日内联系你。",
    }
  },
];

// ── Detect client language from DB or default to 'en' ────────
async function getClientLang(platform, platformId) {
  try {
    const client = await db.getOrCreateClient(platform, platformId, "en");
    return client?.preferred_language || "en";
  } catch { return "en"; }
}

// ── Main: check if intake should be triggered ─────────────
// Returns: { triggered: true, message: "..." } or { triggered: false }
async function checkIntake(platform, platformId, userMessage) {
  const stateKey = `${platform}:${platformId}`;
  const state = intakeState[stateKey];

  // Already in intake flow — process the answer
  if (state && state.step < INTAKE_STEPS.length) {
    return { triggered: true, message: await processIntakeStep(platform, platformId, userMessage) };
  }

  // Intake just completed — don't retrigger
  if (state && state.completed) return { triggered: false };

  // Check if message triggers intake
  if (shouldTriggerIntake(userMessage)) {
    const lang = await getClientLang(platform, platformId);
    intakeState[stateKey] = { step: 0, lang, data: {} };
    const q = INTAKE_STEPS[0].question[lang] || INTAKE_STEPS[0].question.en;
    return { triggered: true, message: q };
  }

  return { triggered: false };
}

// ── Process each step of the intake flow ──────────────────
async function processIntakeStep(platform, platformId, userMessage) {
  const stateKey = `${platform}:${platformId}`;
  const state = intakeState[stateKey];
  const currentStep = INTAKE_STEPS[state.step];
  const lang = state.lang;

  // Save the answer
  state.data[currentStep.key] = userMessage.trim();
  state.step++;

  // More steps remaining
  if (state.step < INTAKE_STEPS.length) {
    let q = INTAKE_STEPS[state.step].question[lang] || INTAKE_STEPS[state.step].question.en;
    // Replace {name} placeholder
    q = q.replace("{name}", state.data.name || "");
    return q;
  }

  // All steps done — save and email
  state.completed = true;
  await finishIntake(platform, platformId, state.data, lang);

  const confirmations = {
    en: `✅ Got it! Here's a summary of what I've collected:\n\n👤 Name: ${state.data.name}\n📋 Issue: ${state.data.issue}\n📞 Contact: ${state.data.contact}\n\nI've sent this to the team and someone will reach out within 1 business day. In the meantime, feel free to keep asking me questions! 😊`,
    es: `✅ ¡Listo! Aquí hay un resumen:\n\n👤 Nombre: ${state.data.name}\n📋 Problema: ${state.data.issue}\n📞 Contacto: ${state.data.contact}\n\nLe he enviado esto al equipo y alguien se comunicará en 1 día hábil. ¡Mientras tanto, siéntete libre de seguir haciendo preguntas! 😊`,
    zh: `✅ 好的！以下是我收集到的信息摘要：\n\n👤 姓名：${state.data.name}\n📋 问题：${state.data.issue}\n📞 联系方式：${state.data.contact}\n\n我已将此信息发送给团队，有人将在1个工作日内与您联系。同时，欢迎继续向我提问！😊`,
  };

  return confirmations[lang] || confirmations.en;
}

// ── Save intake to DB and email team ─────────────────────
async function finishIntake(platform, platformId, data, lang) {
  try {
    // Save to DB
    await db.saveIntake(platform, platformId, data);

    // Update client record with name + contact
    const updates = {};
    if (data.name) updates.name = data.name;
    if (data.contact) {
      const emailMatch = data.contact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = data.contact.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
      if (emailMatch) updates.email = emailMatch[0];
      if (phoneMatch) updates.phone = phoneMatch[0];
    }
    await db.updateClient(platform, platformId, updates);

    // Detect case type from issue
    const caseType = detectCaseTypeFromText(data.issue);
    const attorney = getRoutedAttorney(caseType);

    // Email team
    await emailIntakeToTeam(platform, platformId, data, caseType, attorney);

    // Notify team on Telegram
    await notifyTeamTelegram(platform, platformId, data, caseType, attorney);

    console.log(`✅ Intake completed for ${platform}:${platformId}`);
  } catch (err) {
    console.error("finishIntake error:", err.message);
  }
}

// ── Case type detection ───────────────────────────────────
function detectCaseTypeFromText(text) {
  if (!text) return "General";
  const t = text.toLowerCase();
  if (/immigra|visa|green card|citizen|deport|asylum|daca|uscis|work permit/.test(t)) return "Immigration";
  if (/accident|crash|injury|hurt|hospital|car|slip|fall/.test(t)) return "Personal Injury";
  if (/business|contract|lawsuit|sue|litigation|employment/.test(t)) return "Business Litigation";
  if (/patent|trademark|copyright/.test(t)) return "Patents & Trademarks";
  if (/trust|will|estate|probate|inheritance/.test(t)) return "Estate Planning";
  return "General";
}

function getRoutedAttorney(caseType) {
  const routing = {
    "Immigration": "Jue Wang / Michael Liu — jue.wang@tezlawfirm.com / michael.liu@tezlawfirm.com",
    "Personal Injury": "Lin Mei — lin.mei@tezlawfirm.com",
    "Business Litigation": "JJ Zhang — jj@tezlawfirm.com",
    "Patents & Trademarks": "JJ Zhang — jj@tezlawfirm.com",
    "Estate Planning": "JJ Zhang — jj@tezlawfirm.com",
    "General": "JJ Zhang — jj@tezlawfirm.com",
  };
  return routing[caseType] || routing["General"];
}

// ── Email intake summary to team ──────────────────────────
async function emailIntakeToTeam(platform, platformId, data, caseType, attorney) {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("⚠️ SMTP not configured — skipping email. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.");
    return;
  }

  const transporter = nodemailer.createTransporter({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `🆕 New Client Intake — ${data.name} (${caseType}) via ${platform}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0C1C36; padding: 20px; text-align: center;">
    <h2 style="color: #B79C62; margin: 0;">New Client Intake</h2>
    <p style="color: #fff; margin: 5px 0 0;">Tez Law P.C. — Zara AI Assistant</p>
  </div>
  <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e0e0e0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 10px; color: #666; width: 140px;"><strong>Name</strong></td>
        <td style="padding: 10px;">${data.name}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 10px; color: #666;"><strong>Contact</strong></td>
        <td style="padding: 10px;">${data.contact}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 10px; color: #666;"><strong>Issue</strong></td>
        <td style="padding: 10px;">${data.issue}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 10px; color: #666;"><strong>Case Type</strong></td>
        <td style="padding: 10px;"><strong style="color: #0C1C36;">${caseType}</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 10px; color: #666;"><strong>Platform</strong></td>
        <td style="padding: 10px;">${platform} (ID: ${platformId})</td>
      </tr>
      <tr>
        <td style="padding: 10px; color: #666;"><strong>Routed to</strong></td>
        <td style="padding: 10px;">${attorney}</td>
      </tr>
    </table>
    <div style="margin-top: 20px; padding: 16px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #B79C62;">
      <strong>⚡ Action needed:</strong> Please follow up with ${data.name} within 1 business day.
    </div>
  </div>
  <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
    Tez Law P.C. · West Covina, CA · 626-678-8677
  </div>
</div>`;

  await transporter.sendMail({
    from: `"Zara — Tez Law" <${SMTP_USER}>`,
    to: "jj@tezlawfirm.com",
    cc: getCcForCaseType(caseType),
    subject,
    html,
  });

  console.log(`📧 Intake email sent for ${data.name}`);
}

function getCcForCaseType(caseType) {
  const cc = {
    "Immigration": "jue.wang@tezlawfirm.com,michael.liu@tezlawfirm.com",
    "Personal Injury": "lin.mei@tezlawfirm.com",
  };
  return cc[caseType] || "";
}

// ── Telegram notification to team ────────────────────────
async function notifyTeamTelegram(platform, platformId, data, caseType, attorney) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TEAM_TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return;

  const msg = `📋 *New Client Intake*\n\n` +
    `👤 *Name:* ${data.name}\n` +
    `📞 *Contact:* ${data.contact}\n` +
    `📝 *Issue:* ${data.issue}\n` +
    `⚖️ *Case Type:* ${caseType}\n` +
    `🔀 *Route to:* ${attorney}\n` +
    `📱 *Via:* ${platform}\n\n` +
    `⚡ Follow up within 1 business day!`;

  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: "Markdown",
  });
}

// ── Reset intake for a user (e.g. on /reset) ─────────────
function resetIntake(platform, platformId) {
  delete intakeState[`${platform}:${platformId}`];
}

module.exports = { checkIntake, resetIntake };
