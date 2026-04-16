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

// ── JJ Zhang's voice profile ─────────────────────────────────
const JJ_VOICE = `
You are rewriting a legal blog post in the voice of JJ Zhang, managing attorney at Tez Law P.C.

JJ's communication style:
- Conversational and direct — like talking to a friend who happens to be a lawyer
- Signature phrase: "Protect your rights — we handle the rest."
- Uses "we" and "our team" when referring to the firm, never "I"
- Short punchy sentences mixed with longer explanations
- Never uses AI buzzwords: "In today's complex landscape", "navigating", "it's important to note", "comprehensive", "multifaceted"
- Gets straight to the point — what happened, who it affects, what to do
- Empathetic but practical — acknowledges stress then gives action steps
- Ends sections with clear takeaways
- Uses contractions naturally (you're, don't, we'll, it's)
- Occasionally uses rhetorical questions to engage readers
- Never guarantees outcomes or makes promises about results
- JJ is an immigrant himself — occasionally references personal understanding of the immigration journey
- Has a business and real estate background — practical, results-oriented mindset
- Speaks English, Mandarin Chinese, and Shanghainese — naturally multilingual perspective
`;

// ── Static post footer (author box + disclaimer + schema) ───
function getStaticFooter(title) {
  const today = new Date().toISOString().split('T')[0];
  return `
<style>.tez-ab{display:flex;flex-direction:column;gap:16px;padding:28px 24px;margin:40px 0 28px;background:#f9fafb;border:1px solid #e2e6ea;border-left:5px solid #1B3A5C;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.06);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6}.tez-ab *{box-sizing:border-box}.tez-ab-label{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1B3A5C;background:#e8eef4;padding:2px 10px;border-radius:3px}.tez-ab-name{font-size:1.25rem;font-weight:800;color:#1B3A5C;margin:4px 0 2px}.tez-ab-cn{font-size:.9rem;font-weight:400;color:#666;margin-left:6px}.tez-ab-title{font-size:.9rem;color:#4a5568;margin-bottom:8px}.tez-ab-creds{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8rem;color:#555;margin-bottom:10px}.tez-ab-bio{font-size:.92rem;color:#333;margin:0 0 12px;line-height:1.7}.tez-ab-bio strong{color:#1B3A5C}.tez-ab-langs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.tez-lang{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #d1d9e0;border-radius:20px;padding:3px 12px;font-size:.78rem;font-weight:600;color:#1B3A5C}.tez-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.tez-dot-en{background:#1B3A5C}.tez-dot-zh{background:#DE2910}.tez-dot-sh{background:#D4A017}.tez-ab-tagline{font-size:.87rem;font-style:italic;color:#1B3A5C;font-weight:600;padding:7px 14px;background:rgba(27,58,92,.06);border-radius:6px;display:inline-block;margin-bottom:14px}.tez-ab-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}.tez-cta1{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#1B3A5C;color:#fff!important;font-size:.9rem;font-weight:700;padding:11px 22px;border-radius:6px;text-decoration:none!important}.tez-cta1:hover{background:#0f2740}.tez-cta2{display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#1B3A5C;font-size:.87rem;font-weight:600;padding:9px 18px;border:2px solid #1B3A5C;border-radius:6px;text-decoration:none!important}.tez-cta2:hover{background:#1B3A5C;color:#fff!important}.tez-ab-chat{font-size:.82rem;color:#4a5568;margin-bottom:8px}.tez-ab-chat a{color:#1B3A5C;font-weight:600;text-decoration:none}.tez-ab-areas{font-size:.78rem;color:#718096}@media(min-width:768px){.tez-ab{flex-direction:row;align-items:flex-start;text-align:left;gap:24px;padding:32px 28px}.tez-ab-ctas{flex-direction:row}.tez-cta1,.tez-cta2{width:auto}}</style>
<aside class="tez-ab" aria-label="About the author"><div>
<span class="tez-ab-label">About the Author</span>
<div class="tez-ab-name">JJ Zhang, Esq.<span class="tez-ab-cn">章律師</span></div>
<div class="tez-ab-title">Founding Attorney · Tez Law P.C.</div>
<div class="tez-ab-creds"><span>⚖️ California Bar #326666</span><span>🏛️ 9th Circuit Court of Appeals</span><span>🏢 CA RE Broker #01921248</span></div>
<p class="tez-ab-bio"><strong>JJ Zhang is an immigrant who built his American dream from the ground up</strong> — and now fights to protect yours. Before law, JJ operated businesses and developed residential and commercial real estate. Today he brings that real-world hustle and first-hand immigration experience to every client he represents at Tez Law P.C.</p>
<div class="tez-ab-langs"><span class="tez-lang"><span class="tez-dot tez-dot-en"></span>English</span><span class="tez-lang"><span class="tez-dot tez-dot-zh"></span>中文 Mandarin</span><span class="tez-lang"><span class="tez-dot tez-dot-sh"></span>上海话 Shanghainese</span></div>
<div class="tez-ab-tagline">"Protect your rights — we handle the rest."</div>
<div class="tez-ab-ctas"><a href="https://tezlawfirm.com/contact/" class="tez-cta1">📞 Free Consultation — 626-678-8677</a><a href="https://link.v1ce.co/tezintake" class="tez-cta2" target="_blank">📋 Start Intake Form →</a></div>
<div class="tez-ab-chat">💬 Chat with Zara 24/7: <a href="https://wa.me/16266788677" target="_blank">WhatsApp</a> · <a href="https://m.me/tezlawfirm" target="_blank">Messenger</a> · <a href="https://t.me/TEZJJBot" target="_blank">Telegram</a> · <a href="https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=gh_03f700f08037" target="_blank">WeChat</a></div>
<div class="tez-ab-areas"><strong>Immigration:</strong> Nationwide &nbsp;·&nbsp; <strong>PI &amp; Litigation:</strong> LA, Orange, San Bernardino &amp; Riverside Counties<br><em>我們也會說中文 · Puede hablar español</em></div>
</div></aside>
<p style="font-size:12px;color:#666;margin-top:20px;"><em>Disclaimer: This article is for informational purposes only and does not constitute legal advice. Contact Tez Law P.C. at 626-678-8677 or <a href="mailto:jj@tezlawfirm.com">jj@tezlawfirm.com</a> for advice specific to your situation. Results may vary.</em></p>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${title.replace(/"/g, '\"')}","author":{"@type":"Person","name":"JJ Zhang","alternateName":"章律師","jobTitle":"Founding Attorney","knowsLanguage":["English","Chinese","Shanghainese"],"worksFor":{"@type":"LegalService","name":"Tez Law P.C.","url":"https://tezlawfirm.com"}},"publisher":{"@type":"Organization","name":"Tez Law P.C.","url":"https://tezlawfirm.com"},"datePublished":"${today}","dateModified":"${today}"}</script>`;
}

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
    max_tokens: 4096,
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
async function publishToWordPress({ title, content, category, tags, metaDescription, focusKeyword }) {
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
  console.log("Publishing to WordPress:", title?.substring(0, 50));

  // Get or create category ID
  let categoryId = 1;
  try {
    const catRes = await axios.get(`${WP_URL}/wp-json/wp/v2/categories?search=${encodeURIComponent(category)}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (catRes.data.length > 0) {
      categoryId = catRes.data[0].id;
    } else {
      const newCat = await axios.post(`${WP_URL}/wp-json/wp/v2/categories`,
        { name: category },
        { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" } }
      );
      categoryId = newCat.data.id;
    }
  } catch (e) {
    console.log("Category lookup failed:", e.message);
  }

  // Convert tag names to tag IDs
  let tagIds = [];
  try {
    for (const tagName of (tags || [])) {
      await new Promise(r => setTimeout(r, 500)); // avoid WP rate limit
      const tagRes = await axios.get(`${WP_URL}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      if (tagRes.data.length > 0) {
        tagIds.push(tagRes.data[0].id);
      } else {
        const newTag = await axios.post(`${WP_URL}/wp-json/wp/v2/tags`,
          { name: tagName },
          { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" } }
        );
        tagIds.push(newTag.data.id);
      }
    }
  } catch (e) {
    console.log("Tag lookup failed, posting without tags:", e.message);
    tagIds = [];
  }

  // Build post data with Yoast SEO fields
  const postData = {
    title,
    content,
    status: "publish",
    categories: [categoryId],
    tags: tagIds,
    excerpt: metaDescription || "",
  };

  // Add Yoast SEO meta if available
  if (metaDescription || focusKeyword) {
    postData.meta = {};
    if (metaDescription) {
      postData.meta._yoast_wpseo_metadesc = metaDescription;
      postData.meta._yoast_wpseo_opengraph_description = metaDescription;
      postData.meta._yoast_wpseo_twitter_description = metaDescription;
    }
    if (focusKeyword) {
      postData.meta._yoast_wpseo_focuskw = focusKeyword;
    }
    if (title) {
      postData.meta._yoast_wpseo_title = title + " - Tez Law P.C.";
      postData.meta._yoast_wpseo_opengraph_title = title;
    }
  }

  try {
    const postRes = await axios.post(
      `${WP_URL}/wp-json/wp/v2/posts`,
      postData,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ WordPress published, ID:", postRes.data.id);
    return postRes.data;
  } catch (e) {
    console.error("WordPress post error:", e.response?.status, JSON.stringify(e.response?.data)?.substring(0, 300));
    throw e;
  }
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

// ── Duplicate detection ──────────────────────────────────────
function isDuplicateTitle(title, state) {
  const normalize = t => t.toLowerCase().replace(/[^a-z0-9一-鿿]/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalize(title);
  const history = state.titleHistory || [];
  return history.some(t => {
    const n = normalize(t);
    // Check if titles share 5+ consecutive words or are 80%+ similar
    const words = normalized.split(" ").filter(w => w.length > 3);
    const matches = words.filter(w => n.includes(w));
    return matches.length >= 3 || (matches.length / words.length) >= 0.6;
  });
}

async function checkWordPressDuplicate(title, auth) {
  try {
    const search = title.split(" ").slice(0, 5).join(" ");
    const res = await axios.get(
      `${WP_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(search)}&per_page=5&status=publish`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (res.data.length > 0) {
      const normalize = t => t.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      const normalized = normalize(title);
      for (const post of res.data) {
        const existing = normalize(post.title.rendered);
        const words = normalized.split(" ").filter(w => w.length > 3);
        const matches = words.filter(w => existing.includes(w));
        if (matches.length >= 4) {
          console.log(`⚠️ WP duplicate found: "${post.title.rendered}"`);
          return true;
        }
      }
    }
  } catch (e) {
    console.log("WP duplicate check failed:", e.message);
  }
  return false;
}

function isEvergreenTopicUsedRecently(topicKey, state) {
  const used = state.evergreenUsed || {};
  if (!used[topicKey]) return false;
  const daysSince = (Date.now() - used[topicKey]) / (1000 * 60 * 60 * 24);
  if (daysSince < 28) {
    console.log(`⚠️ Evergreen topic "${topicKey}" used ${Math.round(daysSince)} days ago — skipping`);
    return true;
  }
  return false;
}

function markEvergreenTopicUsed(topicKey, state) {
  if (!state.evergreenUsed) state.evergreenUsed = {};
  state.evergreenUsed[topicKey] = Date.now();
}

// ── Translate post to Chinese or Spanish ─────────────────────
async function translatePost(post, language) {
  const langConfig = {
    chinese: {
      label: "Chinese (Traditional)",
      instruction: "Translate this entire WordPress blog post to Traditional Chinese (繁體中文). Keep all HTML tags exactly as they are. Only translate visible text. For the author box, keep 章律師 as-is. Keep URLs, phone numbers, and email addresses unchanged. Make the translation natural and fluent for Chinese-speaking immigrants in the US.",
      categoryPrefix: "中文-",
      tagSuffix: " 中文",
      titleSuffix: " | 章律師移民法律事務所",
    },
    spanish: {
      label: "Spanish",
      instruction: "Translate this entire WordPress blog post to Spanish (Latin American Spanish). Keep all HTML tags exactly as they are. Only translate visible text. Keep URLs, phone numbers, and email addresses unchanged. Make the translation natural and fluent for Spanish-speaking immigrants in the US.",
      categoryPrefix: "Español-",
      tagSuffix: " español",
      titleSuffix: " | Tez Law P.C.",
    }
  };

  const cfg = langConfig[language];
  if (!cfg) return null;

  console.log(`🌐 Translating to ${cfg.label}...`);

  // Extract only the article body (before the static footer) for translation
  // Static footer (author box, disclaimer, schema) gets re-appended after translation
  const footerMarker = '<style>.tez-ab{';
  const footerIdx = post.content.indexOf(footerMarker);
  const articleBody = footerIdx > 0 ? post.content.substring(0, footerIdx) : post.content;

  const prompt = `${cfg.instruction}

ORIGINAL TITLE: ${post.title}

ORIGINAL ARTICLE BODY (HTML):
${articleBody}

Return ONLY a JSON object (no backticks):
{
  "title": "translated title here",
  "content": "translated HTML article body here (no author box or schema needed)",
  "metaDescription": "translated meta description (150-160 chars)",
  "focusKeyword": "primary keyword in ${cfg.label}"
}`;

  try {
    await new Promise(r => setTimeout(r, 8000)); // rate limit buffer
    const raw = await askClaude(prompt, false);
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const translated = JSON.parse(cleaned.substring(start, end + 1));

    // Append the static footer (in English — author box stays in English)
    const fullContent = (translated.content || "") + getStaticFooter(translated.title || post.title);

    return {
      title: translated.title,
      content: fullContent,
      category: cfg.categoryPrefix + post.category,
      tags: (post.tags || []).map(t => t + cfg.tagSuffix),
      metaDescription: translated.metaDescription,
      focusKeyword: translated.focusKeyword,
    };
  } catch (e) {
    console.log(`Translation to ${cfg.label} failed:`, e.message);
    return null;
  }
}

// ── Publish post in all 3 languages ──────────────────────────
async function publishAllLanguages(post, notifyPrefix) {
  const results = [];

  // Check for duplicates before publishing
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
  const wpDup = await checkWordPressDuplicate(post.title, auth);
  if (wpDup) {
    console.log("⚠️ Skipping — WordPress duplicate detected for:", post.title);
    return 0;
  }

  // Publish English first
  try {
    const published = await publishToWordPress(post);
    results.push({ lang: "English", link: published.link });
    console.log("✅ Published English:", post.title);
  } catch (e) {
    console.error("English publish failed:", e.message);
  }

  // Chinese version
  const chinesePost = await translatePost(post, "chinese");
  if (chinesePost) {
    try {
      const published = await publishToWordPress(chinesePost);
      results.push({ lang: "中文", link: published.link });
      console.log("✅ Published Chinese:", chinesePost.title);
    } catch (e) {
      console.error("Chinese publish failed:", e.message);
    }
  }

  // Spanish version
  const spanishPost = await translatePost(post, "spanish");
  if (spanishPost) {
    try {
      const published = await publishToWordPress(spanishPost);
      results.push({ lang: "Español", link: published.link });
      console.log("✅ Published Spanish:", spanishPost.title);
    } catch (e) {
      console.error("Spanish publish failed:", e.message);
    }
  }

  // Notify team with all links
  if (results.length > 0) {
    const links = results.map(r => `${r.lang}: ${r.link}`).join("\n");
    await notifyTeam(
      `${notifyPrefix}

📌 *${post.title}*

🌐 Published in ${results.length} language(s):
${links}`
    );
  }

  return results.length;
}

// ── Record title to history after publishing ──────────────────
function recordPublishedTitle(title, state) {
  if (!state.titleHistory) state.titleHistory = [];
  state.titleHistory.push(title);
  if (!state.publishedTitles) state.publishedTitles = [];
  state.publishedTitles.push(title);
  saveState(state);
}

// ── Generate SEO-optimized blog post with Claude ─────────────
async function generatePost({ topic, practiceArea, context, useSearch }) {

  // Determine location context based on practice area
  const locationContext = practiceArea === "Immigration Law" || practiceArea === "Immigration"
    ? "nationwide United States (Tez Law handles immigration cases across the entire US)"
    : "Southern California, specifically Los Angeles County, Orange County, San Bernardino County, and Riverside County (the Inland Empire). Key cities include West Covina, Los Angeles, Anaheim, San Bernardino, Riverside, Ontario, Pomona, and surrounding areas.";

  const prompt = `You are an expert legal content writer and SEO specialist for Tez Law P.C., a law firm in West Covina, California. JJ Zhang is the managing attorney (California Bar #326666).

Write a COMPREHENSIVE, SEO-optimized WordPress blog post about:

TOPIC: ${topic}
PRACTICE AREA: ${practiceArea}
CONTEXT: ${context || "None"}
LOCATION: ${locationContext}

STRICT REQUIREMENTS:

1. TITLE (under 65 characters, include primary keyword + location if PI/local, or keyword + year if immigration)

2. META DESCRIPTION (150-160 characters, includes keyword + clear CTA)

3. CONTENT STRUCTURE (1,000-1,400 words total):
   - Opening paragraph: hook + who this affects + what they should do
   - H2: Background/What This Means
   - H2: How This Affects [Specific Audience]
   - H2: What You Should Do Now (actionable steps)
   - H2: Why Choose Tez Law P.C.
   - H2: Frequently Asked Questions
     * Include 3 FAQ items as <div class="faq-item"><h3>Question?</h3><p>Answer</p></div>
   - Closing CTA paragraph

4. INTERNAL LINKS - include these exact links naturally in the content:
   - Immigration topics: <a href="https://tezlawfirm.com/immigration/">immigration services</a>
   - PI topics: <a href="https://tezlawfirm.com/home/personal-injury/">personal injury attorney serving LA, Orange, San Bernardino, and Riverside Counties</a>
   - General: <a href="https://tezlawfirm.com/contact/">free consultation</a>

5. AUTHOR BOX, DISCLAIMER, and JSON-LD SCHEMA will be appended automatically after your content. Do NOT include them.

6. TAGS: 5-7 highly specific tags including location + practice area keywords

Return ONLY this JSON (no markdown, no backticks, no other text):
{
  "title": "SEO title here",
  "metaDescription": "150-160 char meta description here",
  "content": "full HTML content here",
  "category": "Immigration|Personal Injury|Business Law|Trademarks|Estate Planning",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "focusKeyword": "main SEO keyword here"
}`;

  const raw = await askClaude(prompt, useSearch);

  let postData;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    postData = JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    console.error("Failed to parse Claude response:", e.message);
    console.error("Raw response:", raw.substring(0, 500));
    return null;
  }

  // Append static footer (author box + disclaimer + schema)
  postData.content = (postData.content || "") + getStaticFooter(postData.title || "");

  // Humanize only the intro paragraph to set JJ's tone
  // (avoid truncation by not rewriting the full post)
  await new Promise(r => setTimeout(r, 5000));
  console.log("✍️ Humanizing post in JJ Zhang's voice...");

  try {
    // Extract just the first 2 paragraphs to humanize
    const firstParaMatch = postData.content.match(/(<p>.*?<\/p>\s*<p>.*?<\/p>)/s);
    if (firstParaMatch) {
      const humanizePrompt = `${JJ_VOICE}

Rewrite ONLY these two opening paragraphs in JJ Zhang's voice. Return ONLY the rewritten HTML paragraphs, nothing else:

${firstParaMatch[1]}`;

      const humanizedIntro = await askClaude(humanizePrompt, false);
      if (humanizedIntro && humanizedIntro.includes("<p>")) {
        postData.content = postData.content.replace(firstParaMatch[1], humanizedIntro.trim());
        console.log("✅ Post intro humanized successfully");
      }
    }
  } catch (e) {
    console.log("Humanization failed, using original:", e.message);
  }

  // Add AI disclosure to excerpt/meta
  postData.metaDescription = postData.metaDescription || "";
  
  return postData;
}

// ─────────────────────────────────────────────────────────────
//  TRIGGER 1: Immigration News (event-driven, daily check)
// ─────────────────────────────────────────────────────────────
async function checkImmigrationNews(state) {
  console.log("📰 Checking immigration news...");

  // Single call: search AND generate post topic in one step
  const prompt = `Search for the most significant US immigration law news or development from the past 7 days.
Pick the single most newsworthy item relevant to people interested in US immigration (visas, green cards, deportation, work permits, asylum, etc.).

Then respond in this exact JSON format only (no other text):
{
  "hasNews": true,
  "headline": "brief headline here",
  "summary": "one sentence summary here"
}

If there is truly nothing noteworthy, respond:
{"hasNews": false}`;

  const result = await askClaude(prompt, true);
  console.log("News result:", result.substring(0, 200));

  let newsData;
  try {
    const cleaned = result.replace(/```json|```/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    newsData = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
  } catch (e) {
    console.log("Failed to parse news result:", e.message);
    return 0;
  }

  if (!newsData.hasNews) {
    console.log("No new immigration news today.");
    return 0;
  }

  const headline = newsData.headline;
  const summary = newsData.summary;

  // Check if we already posted about this
  if (isDuplicateTitle(headline, state)) {
    console.log("⚠️ Duplicate detected, skipping:", headline);
    return 0;
  }

  // Wait before generating post — avoid Anthropic rate limit
  await new Promise(r => setTimeout(r, 10000));

  let post = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      post = await generatePost({
        topic: headline,
        practiceArea: "Immigration Law",
        context: summary,
        useSearch: false,
      });
      if (post) break;
    } catch (e) {
      console.log(`Post generation attempt ${attempt} failed:`, e.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 15000));
    }
  }

  if (!post) return 0;

  try {
    console.log("Attempting to publish:", post?.title);
    console.log("Post category:", post?.category);
    console.log("Content length:", post?.content?.length);
    const count = await publishAllLanguages(post, "📢 *New Immigration Post Published!*");
    if (count > 0) recordPublishedTitle(post.title, state);
    return count > 0 ? 1 : 0;
  } catch (e) {
    console.error("Failed to publish:", e.message);
    return 0;
  }
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

    await publishAllLanguages(post, "🌧️ *Weather Post Published!*");
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

      await publishAllLanguages(post, "🎉 *Holiday Post Published!*");
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
      await publishAllLanguages(post, "📝 *PI Post Published!*");
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
        await publishAllLanguages(post, "📝 *Business Law Post Published!*");
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
        await publishAllLanguages(post, "📝 *Trademark Post Published!*");
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
        await publishAllLanguages(post, "📝 *Estate Planning Post Published!*");
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
//  MAIN SCHEDULER — runs daily at 7:50 AM
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
  next8am.setHours(7, 50, 0, 0);
  if (next8am <= now) next8am.setDate(next8am.getDate() + 1);

  const msUntil8am = next8am - now;
  console.log(`⏰ Next auto-post check in ${Math.round(msUntil8am / 1000 / 60)} minutes (7:50 AM Pacific)`);

  setTimeout(async () => {
    await runDailyScheduler();
    // Then repeat every 24 hours
    setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
  }, msUntil8am);
}

// ── Export for integration into bot.js ───────────────────────
module.exports = { runDailyScheduler, scheduleDaily };
