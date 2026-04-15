// ============================================================
//  TEZ LAW P.C. — WORDPRESS AUTO-POSTER
//  Handles: Immigration (news-driven), Personal Injury (weather +
//  holidays + evergreen), Business/Trademarks/Estate (evergreen)
//  Notifies JJ via Telegram after every post
// ============================================================

const axios = require("axios");

// ── Env vars (add these to Render) ───────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_TOKEN    = process.env.TELEGRAM_TOKEN;
const TEAM_CHAT_ID      = process.env.TEAM_TELEGRAM_CHAT_ID;
const WP_URL            = process.env.WP_URL;           // https://tezlawfirm.com
const WP_USER           = process.env.WP_USER;          // tezlawfirm
const WP_APP_PASSWORD   = process.env.WP_APP_PASSWORD;  // Application Password from WordPress

// ── State tracking (persisted to /var/data) ──────────────────
const fs   = require("fs");
const STATE_FILE = "/var/data/autoposter_state.json";

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (e) {}
  return {
    lastImmigrationCheck: null,
    lastWeatherCheck: null,
    publishedTitles: [],      // avoid duplicate posts
    weeklyEvergreen: {        // track which evergreen topics posted this week
      pi: null,
      business: null,
      trademark: null,
      estate: null,
    },
    lastHolidayPost: null,
  };
}

function saveState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

// ── Claude API call ───────────────────────────────────────────
async function askClaude(prompt, useWebSearch = false) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    body,
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );
  return response.data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");
}

// ── WordPress publish ─────────────────────────────────────────
async function publishToWordPress({ title, content, category, tags }) {
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");

  // Get or create category ID
  let categoryId = 1; // default: Uncategorized
  try {
    const catRes = await axios.get(`${WP_URL}/wp-json/wp/v2/categories?search=${encodeURIComponent(category)}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (catRes.data.length > 0) {
      categoryId = catRes.data[0].id;
    } else {
      // Create category
      const newCat = await axios.post(`${WP_URL}/wp-json/wp/v2/categories`,
        { name: category },
        { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" } }
      );
      categoryId = newCat.data.id;
    }
  } catch (e) {
    console.log("Category lookup failed, using default:", e.message);
  }

  const postRes = await axios.post(
    `${WP_URL}/wp-json/wp/v2/posts`,
    {
      title,
      content,
      status: "publish",
      categories: [categoryId],
      tags: tags || [],
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    }
  );
  return postRes.data;
}

// ── Telegram notification ─────────────────────────────────────
async function notifyTeam(message) {
  if (!TEAM_CHAT_ID || !TELEGRAM_TOKEN) {
    console.log("Telegram notify:", message);
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TEAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
  } catch (e) {
    console.error("Telegram notify failed:", e.message);
  }
}

// ── Generate blog post with Claude ────────────────────────────
async function generatePost({ topic, practiceArea, context, useSearch }) {
  const prompt = `You are a legal content writer for Tez Law P.C., an immigration and personal injury law firm in West Covina, California.

Write a high-quality, SEO-optimized WordPress blog post about the following topic:

TOPIC: ${topic}
PRACTICE AREA: ${practiceArea}
ADDITIONAL CONTEXT: ${context || "None"}

Requirements:
- Title: compelling, includes a primary keyword, under 65 characters for SEO
- Word count: 600-900 words
- Structure: Introduction, 3-4 main sections with H2 headings, conclusion with CTA
- Include practical information relevant to California residents
- End with a call-to-action to contact Tez Law P.C. at 626-678-8677 or jj@tezlawfirm.com
- Use natural language, not overly formal
- Include relevant keywords naturally throughout
- Mention West Covina or Los Angeles where appropriate
- Do NOT use placeholder text or say "insert X here"
- Write the full post, ready to publish

Return your response in this exact JSON format (no markdown, no backticks):
{
  "title": "post title here",
  "content": "full HTML post content here with <h2>, <p>, <ul> tags",
  "category": "category name (Immigration, Personal Injury, Business Law, Trademarks, or Estate Planning)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  const raw = await askClaude(prompt, useSearch);

  // Parse JSON from Claude's response
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    console.error("Failed to parse Claude response:", e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  TRIGGER 1: Immigration News (event-driven, daily check)
// ─────────────────────────────────────────────────────────────
async function checkImmigrationNews(state) {
  console.log("📰 Checking immigration news...");

  const prompt = `You are a news extraction tool. Search for US immigration law news from the past 48 hours.

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:
1. Search for recent immigration news now
2. Your response must ONLY contain one of these two formats - nothing else:

FORMAT A (if news found):
NEWS_ITEM_1: [exact headline] | [one sentence summary]
NEWS_ITEM_2: [exact headline] | [one sentence summary]

FORMAT B (if no news):
NO_NEW_NEWS

DO NOT explain your search process. DO NOT say "let me search". DO NOT add any other text.
ONLY output NEWS_ITEM lines or NO_NEW_NEWS. Nothing else.

Search for: USCIS policy changes, executive orders, visa rule changes, H-1B updates, EB-5 news, deportation policy, immigration court decisions from the past 48 hours.`;

  const newsCheck = await askClaude(prompt, true);
  console.log("News check result:", newsCheck.substring(0, 200));

  if (newsCheck.includes("NO_NEW_NEWS")) {
    console.log("No new immigration news today.");
    return 0;
  }

  // Extract news items
  const newsItems = newsCheck.match(/NEWS_ITEM_\d+: (.+)/g) || [];
  let postsPublished = 0;

  for (const item of newsItems.slice(0, 2)) { // max 2 posts per day
    const headline = item.replace(/NEWS_ITEM_\d+: /, "").split(" | ")[0];

    // Check if we already posted about this
    if (state.publishedTitles.some(t => t.toLowerCase().includes(headline.toLowerCase().substring(0, 20)))) {
      console.log("Already posted about:", headline);
      continue;
    }

    const post = await generatePost({
      topic: headline,
      practiceArea: "Immigration Law",
      context: item,
      useSearch: true,
    });

    if (!post) continue;

    try {
      const published = await publishToWordPress(post);
      state.publishedTitles.push(post.title);
      postsPublished++;
      console.log("✅ Published immigration post:", post.title);
      await notifyTeam(
        `📢 *New Auto-Post Published!*\n\n` +
        `📌 *${post.title}*\n` +
        `🏷️ Category: ${post.category}\n` +
        `🔗 ${published.link}\n\n` +
        `_Review and edit if needed._`
      );
    } catch (e) {
      console.error("Failed to publish:", e.message);
    }
  }

  return postsPublished;
}

// ─────────────────────────────────────────────────────────────
//  TRIGGER 2: Weather / Rain Events (Personal Injury)
// ─────────────────────────────────────────────────────────────
async function checkWeather(state) {
  console.log("🌦️ Checking weather for West Covina...");

  try {
    // National Weather Service API - free, no key needed
    // West Covina area: gridpoint
    const pointRes = await axios.get("https://api.weather.gov/points/34.0686,-117.9390");
    const forecastUrl = pointRes.data.properties.forecast;
    const forecastRes = await axios.get(forecastUrl);
    const periods = forecastRes.data.properties.periods.slice(0, 3); // next 3 periods

    const weatherText = periods.map(p => p.detailedForecast).join(" ");
    const isRainy = /rain|storm|shower|thunderstorm|flood|wet/i.test(weatherText);

    if (!isRainy) {
      console.log("No rain forecast, skipping weather post.");
      return 0;
    }

    // Check if we posted a weather post in last 3 days
    const now = Date.now();
    if (state.lastWeatherCheck && (now - state.lastWeatherCheck) < 3 * 24 * 60 * 60 * 1000) {
      console.log("Weather post recently published, skipping.");
      return 0;
    }

    const rainType = /thunderstorm|flood/i.test(weatherText) ? "severe storm" : "rain";
    const post = await generatePost({
      topic: `Car Accidents During ${rainType === "severe storm" ? "Storms" : "Rain"} in California — What You Need to Know`,
      practiceArea: "Personal Injury",
      context: `Weather forecast for West Covina/Los Angeles: ${weatherText.substring(0, 200)}. Write a timely post about wet weather driving safety and accident claims in California.`,
      useSearch: false,
    });

    if (!post) return 0;

    const published = await publishToWordPress(post);
    state.lastWeatherCheck = now;
    state.publishedTitles.push(post.title);
    console.log("✅ Published weather post:", post.title);
    await notifyTeam(
      `🌧️ *Weather Alert Post Published!*\n\n` +
      `📌 *${post.title}*\n` +
      `🔗 ${published.link}\n\n` +
      `_Triggered by rain forecast for LA/West Covina area._`
    );
    return 1;
  } catch (e) {
    console.error("Weather check failed:", e.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  TRIGGER 3: Holiday Weekend Posts (PI / DUI)
// ─────────────────────────────────────────────────────────────
const HOLIDAYS = [
  { month: 1,  day: 1,  name: "New Year's Day",  topic: "New Year's DUI Accidents in California — What to Do If You're Hit by a Drunk Driver" },
  { month: 5,  day: 25, name: "Memorial Day",     topic: "Memorial Day Weekend Car Accidents in California — Your Legal Rights" },
  { month: 7,  day: 4,  name: "July 4th",         topic: "Fourth of July DUI Accidents in Los Angeles — What Victims Need to Know" },
  { month: 9,  day: 1,  name: "Labor Day",        topic: "Labor Day Weekend Accidents in California — Personal Injury Rights and Deadlines" },
  { month: 11, day: 27, name: "Thanksgiving",     topic: "Thanksgiving Travel Accidents in California — Know Your Rights" },
  { month: 12, day: 24, name: "Christmas Eve",    topic: "Holiday Season DUI Accidents in Los Angeles — Legal Options for Victims" },
];

async function checkHolidays(state) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Check if today is within 2 days before a holiday
  for (const holiday of HOLIDAYS) {
    const holidayDate = new Date(now.getFullYear(), holiday.month - 1, holiday.day);
    const daysUntil = Math.ceil((holidayDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntil >= 0 && daysUntil <= 2) {
      // Check if we already posted for this holiday this year
      const holidayKey = `${now.getFullYear()}-${holiday.name}`;
      if (state.lastHolidayPost === holidayKey) continue;

      console.log(`🎉 Holiday approaching: ${holiday.name}, publishing PI post...`);

      const post = await generatePost({
        topic: holiday.topic,
        practiceArea: "Personal Injury",
        context: `${holiday.name} is in ${daysUntil} day(s). This is a high-risk period for DUI and traffic accidents in California.`,
        useSearch: false,
      });

      if (!post) continue;

      const published = await publishToWordPress(post);
      state.lastHolidayPost = holidayKey;
      state.publishedTitles.push(post.title);
      console.log("✅ Published holiday post:", post.title);
      await notifyTeam(
        `🎉 *Holiday Post Published!*\n\n` +
        `📌 *${post.title}*\n` +
        `🔗 ${published.link}\n\n` +
        `_Timed for ${holiday.name} weekend._`
      );
      return 1;
    }
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
//  TRIGGER 4: Evergreen Posts (scheduled rotation)
// ─────────────────────────────────────────────────────────────
const EVERGREEN_TOPICS = {
  pi: [
    "How Long Does a Personal Injury Case Take in California?",
    "What Is California's Pure Comparative Negligence Rule?",
    "Uber and Lyft Accident Claims in Los Angeles — A Complete Guide",
    "Slip and Fall Accidents in California — What You Need to Prove",
    "How Much Is My Car Accident Case Worth in California?",
    "Hit and Run Accidents in California — Your Legal Options",
    "Truck Accident Claims in Los Angeles — Why They're Different",
    "What to Do Immediately After a Car Accident in California",
  ],
  business: [
    "Non-Compete Agreements Are Void in California — What Employers and Employees Need to Know",
    "What to Do When Your Business Gets Served in California",
    "Trade Secret Theft in California — How to Protect Your Business",
    "Breach of Contract Claims in California — A Practical Guide",
  ],
  trademark: [
    "How to Register a Trademark in the United States — Step by Step",
    "Trademark vs. Copyright vs. Patent — What's the Difference?",
    "How to Respond to a Cease and Desist Letter for Trademark Infringement",
    "Common Trademark Mistakes Small Businesses Make in California",
  ],
  estate: [
    "Why Every California Homeowner Needs a Living Trust",
    "How Probate Works in California — And How to Avoid It",
    "Prop 19 and California Property Tax — What Families Need to Know in 2026",
    "What Happens If You Die Without a Will in California?",
  ],
};

async function checkEvergreen(state) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  let postsPublished = 0;

  // PI post: every Tuesday
  if (dayOfWeek === 2 && state.weeklyEvergreen.pi !== now.toDateString()) {
    const usedTopics = state.publishedTitles;
    const available = EVERGREEN_TOPICS.pi.filter(t => !usedTopics.includes(t));
    const topic = available.length > 0 ? available[0] : EVERGREEN_TOPICS.pi[Math.floor(Math.random() * EVERGREEN_TOPICS.pi.length)];

    const post = await generatePost({ topic, practiceArea: "Personal Injury", useSearch: false });
    if (post) {
      const published = await publishToWordPress(post);
      state.weeklyEvergreen.pi = now.toDateString();
      state.publishedTitles.push(post.title);
      postsPublished++;
      await notifyTeam(`📝 *Evergreen PI Post Published!*\n\n📌 *${post.title}*\n🔗 ${published.link}`);
    }
  }

  // Business post: every other Thursday
  if (dayOfWeek === 4 && state.weeklyEvergreen.business !== now.toDateString()) {
    const weekNum = Math.floor(now.getDate() / 7);
    if (weekNum % 2 === 0) {
      const topic = EVERGREEN_TOPICS.business[Math.floor(Math.random() * EVERGREEN_TOPICS.business.length)];
      const post = await generatePost({ topic, practiceArea: "Business Law", useSearch: false });
      if (post) {
        const published = await publishToWordPress(post);
        state.weeklyEvergreen.business = now.toDateString();
        state.publishedTitles.push(post.title);
        postsPublished++;
        await notifyTeam(`📝 *Business Law Post Published!*\n\n📌 *${post.title}*\n🔗 ${published.link}`);
      }
    }
  }

  // Trademark post: every other Thursday (alternating with Business)
  if (dayOfWeek === 4 && state.weeklyEvergreen.trademark !== now.toDateString()) {
    const weekNum = Math.floor(now.getDate() / 7);
    if (weekNum % 2 === 1) {
      const topic = EVERGREEN_TOPICS.trademark[Math.floor(Math.random() * EVERGREEN_TOPICS.trademark.length)];
      const post = await generatePost({ topic, practiceArea: "Trademarks", useSearch: false });
      if (post) {
        const published = await publishToWordPress(post);
        state.weeklyEvergreen.trademark = now.toDateString();
        state.publishedTitles.push(post.title);
        postsPublished++;
        await notifyTeam(`📝 *Trademark Post Published!*\n\n📌 *${post.title}*\n🔗 ${published.link}`);
      }
    }
  }

  // Estate Planning post: every other Friday
  if (dayOfWeek === 5 && state.weeklyEvergreen.estate !== now.toDateString()) {
    const weekNum = Math.floor(now.getDate() / 7);
    if (weekNum % 2 === 0) {
      const topic = EVERGREEN_TOPICS.estate[Math.floor(Math.random() * EVERGREEN_TOPICS.estate.length)];
      const post = await generatePost({ topic, practiceArea: "Estate Planning", useSearch: false });
      if (post) {
        const published = await publishToWordPress(post);
        state.weeklyEvergreen.estate = now.toDateString();
        state.publishedTitles.push(post.title);
        postsPublished++;
        await notifyTeam(`📝 *Estate Planning Post Published!*\n\n📌 *${post.title}*\n🔗 ${published.link}`);
      }
    }
  }

  return postsPublished;
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCHEDULER — runs daily at 8 AM
// ─────────────────────────────────────────────────────────────
async function runDailyScheduler() {
  console.log("\n🚀 TEZ LAW AUTO-POSTER running:", new Date().toLocaleString());

  const state = loadState();
  let totalPublished = 0;

  try {
    // 1. Immigration news (event-driven)
    totalPublished += await checkImmigrationNews(state);
  } catch (e) { console.error("Immigration check error:", e.message); }

  try {
    // 2. Weather/rain (event-driven, Personal Injury)
    totalPublished += await checkWeather(state);
  } catch (e) { console.error("Weather check error:", e.message); }

  try {
    // 3. Holiday posts (Personal Injury / DUI)
    totalPublished += await checkHolidays(state);
  } catch (e) { console.error("Holiday check error:", e.message); }

  try {
    // 4. Evergreen posts (scheduled rotation)
    totalPublished += await checkEvergreen(state);
  } catch (e) { console.error("Evergreen check error:", e.message); }

  saveState(state);
  console.log(`✅ Auto-poster complete. Published ${totalPublished} post(s) today.\n`);
}

// ── Schedule: run every day at 8 AM Pacific ──────────────────
function scheduleDaily() {
  const now = new Date();
  const next8am = new Date();
  next8am.setHours(8, 0, 0, 0);
  if (next8am <= now) next8am.setDate(next8am.getDate() + 1);

  const msUntil8am = next8am - now;
  console.log(`⏰ Next auto-post check in ${Math.round(msUntil8am / 1000 / 60)} minutes (8 AM Pacific)`);

  setTimeout(async () => {
    await runDailyScheduler();
    // Then repeat every 24 hours
    setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
  }, msUntil8am);
}

// ── Export for integration into bot.js ───────────────────────
module.exports = { runDailyScheduler, scheduleDaily };
