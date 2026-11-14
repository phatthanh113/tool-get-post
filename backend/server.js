const path = require("path");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const os = require("os");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Add detailed environment logging
console.log("Environment Check:");
console.log("Current working directory:", process.cwd());
console.log(".env path:", path.resolve(__dirname, "../.env"));
console.log("All environment variables:", Object.keys(process.env));
console.log(
  "YOUTUBE_API_KEY length:",
  process.env.YOUTUBE_API_KEY ? process.env.YOUTUBE_API_KEY.length : 0,
);

const app = express();
const port = process.env.PORT || 3000;
app.use("/font", express.static(path.join(__dirname, "..", "font")));
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 },
  }),
);

const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");
[uploadsDir, outputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe"),
  path.join(__dirname, "..", "ffmpeg", "bin", "ffmpeg.exe"),
];
const ffprobeCandidates = [
  process.env.FFPROBE_PATH,
  path.join(__dirname, "ffmpeg", "bin", "ffprobe.exe"),
  path.join(__dirname, "..", "ffmpeg", "bin", "ffprobe.exe"),
];

let ffmpegPath = null;
let ffprobePath = null;

for (const candidate of ffmpegCandidates) {
  if (candidate && fs.existsSync(candidate)) {
    ffmpegPath = candidate;
    break;
  }
}

for (const candidate of ffprobeCandidates) {
  if (candidate && fs.existsSync(candidate)) {
    ffprobePath = candidate;
    break;
  }
}

if (ffmpegPath && ffprobePath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  console.log(`Using ffmpeg from: ${ffmpegPath}`);
  console.log(`Using ffprobe from: ${ffprobePath}`);
} else {
  console.warn(
    "FFmpeg executables not found at the local path. Relying on system PATH for ffmpeg/ffprobe.",
  );
  console.log("Checked ffmpeg candidates:", ffmpegCandidates.filter(Boolean));
  console.log("Checked ffprobe candidates:", ffprobeCandidates.filter(Boolean));
}

const storyAudioCandidates = [
  path.join(__dirname, "..", "hard-to-miss.mp3"),
  path.join(__dirname, "hard-to-miss.mp3"),
];
const sportsAudioCandidates = [
  path.join(__dirname, "..", "hard-to-miss.mp3"),
  path.join(__dirname, "hard-to-miss.mp3"),
];

function resolveAudioPath(audioCandidates, label) {
  const audioPath = audioCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  const hasAudio = Boolean(audioPath);

  if (hasAudio) {
    console.log(`Using ${label} audio track from: ${audioPath}`);
  } else {
    console.warn(
      `${label} audio track not found in backend or parent directory.`,
    );
  }

  return { audioPath, hasAudio };
}

const storyAudio = resolveAudioPath(storyAudioCandidates, "Story");
const sportsAudio = resolveAudioPath(sportsAudioCandidates, "Sports");

function getAudioForMode(generationMode = "story") {
  const mode = String(generationMode || "story").toLowerCase();
  if (mode === "sports") {
    return { audioPath: sportsAudio.audioPath, hasAudio: sportsAudio.hasAudio };
  }

  return { audioPath: storyAudio.audioPath, hasAudio: storyAudio.hasAudio };
}

function safeDeleteFile(filePath, maxRetries = 5, delay = 1000) {
  return new Promise((resolve) => {
    let attempts = 0;

    const attemptDelete = () => {
      attempts++;
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        resolve(true);
      } catch (error) {
        if (error.code === "EBUSY" && attempts < maxRetries) {
          setTimeout(attemptDelete, delay);
        } else {
          console.warn(`Could not delete file ${filePath}: ${error.message}`);
          resolve(false);
        }
      }
    };

    attemptDelete();
  });
}

function getRandomDuration(min = 8, max = 15) {
  return Math.random() * (max - min) + min;
}

// Timeout values for clickbait generation
const DEFAULT_CLICKBAIT_TIMEOUT = parseInt(
  process.env.CLICKBAIT_TIMEOUT_MS || "30000",
  10,
);

async function runWithTimeout(promiseFactory, ms) {
  return new Promise((resolve) => {
    let finished = false;

    promiseFactory()
      .then((v) => {
        if (!finished) {
          finished = true;
          resolve({ timedOut: false, value: v });
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          resolve({ timedOut: false, error: err });
        }
      });

    setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve({ timedOut: true });
      }
    }, ms);
  });
}

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

function extractVideoId(url) {
  const value = String(url || "").trim();
  if (!value) return null;

  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
    const host = parsed.hostname.toLowerCase();
    let videoId = null;

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0];
    } else if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      videoId =
        parsed.searchParams.get("v") ||
        parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    }

    return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

function getLanguageName(languageCode) {
  const code = String(languageCode || "").toLowerCase();
  const primaryCode = code.split(/[-_]/)[0];
  if (["en", "eng"].includes(primaryCode)) return "English";
  if (["de", "deu", "ger"].includes(primaryCode)) return "German";

  try {
    return new Intl.DisplayNames(["vi"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

async function detectLanguageFromText(text) {
  const { franc } = await import("franc-min");
  return franc(String(text || ""), { minLength: 40 });
}

app.post("/detect-video-language", async (req, res) => {
  const videoId = extractVideoId(req.body?.youtubeUrl);
  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    return res.status(503).json({ error: "YouTube API key is not configured" });
  }

  try {
    const query = new URLSearchParams({
      part: "snippet",
      id: videoId,
      key: youtubeApiKey,
    });
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${query.toString()}`,
    );
    if (!ytRes.ok) {
      console.error("YouTube language metadata API error:", ytRes.status);
      return res.status(502).json({ error: "YouTube metadata lookup failed" });
    }

    const ytData = await ytRes.json();
    const snippet = ytData.items?.[0]?.snippet;
    if (!snippet) {
      return res.status(404).json({ error: "Video not found on YouTube" });
    }

    const metadataLanguage =
      snippet.defaultAudioLanguage || snippet.defaultLanguage || "";
    const source = metadataLanguage ? "metadata" : "title-description";
    const languageCode =
      metadataLanguage ||
      (await detectLanguageFromText(
        `${snippet.title || ""}\n${snippet.description || ""}`,
      ));

    if (!languageCode || languageCode === "und") {
      return res.json({
        detected: false,
        languageCode: null,
        languageName: null,
        supported: false,
        source,
      });
    }

    const normalizedCode = String(languageCode).toLowerCase();
    const primaryCode = normalizedCode.split(/[-_]/)[0];
    const language =
      ["en", "eng"].includes(primaryCode)
        ? "English"
        : ["de", "deu", "ger"].includes(primaryCode)
          ? "German"
          : null;

    return res.json({
      detected: true,
      language,
      languageCode: normalizedCode,
      languageName: getLanguageName(normalizedCode),
      supported: Boolean(language),
      source,
    });
  } catch (error) {
    console.error("YouTube language detection failed:", error.message);
    return res.status(502).json({ error: "Unable to detect video language" });
  }
});

function getSportsThumbnailTextRequirement(language = "English") {
  const targetLanguage = normalizePromptLanguage(language);
  const headlineFormulas =
    targetLanguage === "German"
      ? [
          "[Team-/Figurenname]s [Plan/Saison/Zukunft] ist gerade ZUSAMMENGEBROCHEN – [schockierendes Ereignis] könnte alles verändern!",
          "[Team-/Figurenname] steht nach [schockierendem Ereignis] vor einem gewaltigen SCHOCK – was passiert jetzt?",
          "Niemand hat das kommen sehen: [schockierendes Ereignis] stellt [Team-/Figurenname]s Zukunft auf den Kopf!",
          "[Team-/Figurenname] in der KRISE: [schockierendes Ereignis] könnte alles auf den Kopf stellen!",
          "[Team-/Figurenname]s Saison nimmt nach [schockierendem Ereignis] eine verheerende Wende!",
          "Ist das das ENDE für [Team-/Figurenname]? [Schockierendes Ereignis] lässt alle sprachlos zurück!",
          "[Team-/Figurenname] droht alles zu verlieren – [schockierendes Ereignis] verändert jetzt alles!",
          "Ein unerwarteter SCHOCK trifft [Team-/Figurenname] – die Folgen könnten gewaltig sein!",
        ]
      : [
          "[Team/Character Name]'s [Plan/Season/Future] Just COLLAPSED—[Shocking Event] Could Change Everything!",
          "[Team/Character Name] Hit With a SHOCKING Setback—[Major Consequence] Now Looms!",
          "Nobody Saw This Coming: [Shocking Event] Just Changed [Team/Character Name]'s Future!",
          "[Team/Character Name] in CRISIS After [Shocking Event]—What Happens Next?",
          "[Team/Character Name]'s Season Takes a DEVASTATING Turn After [Shocking Event]!",
          "Is This the END for [Team/Character Name]? [Shocking Event] Leaves Everyone Stunned!",
          "[Team/Character Name] Could Lose Everything After [Shocking Event]—The Fallout Begins!",
          "A Massive SHOCK Rocks [Team/Character Name]—The Consequences Could Be Unbelievable!",
        ];
  const headlineFormula =
    headlineFormulas[Math.floor(Math.random() * headlineFormulas.length)];

  return `
### THUMBNAIL_TEXT_REQUIREMENT:
- At the very end of the response, include one marker block in this format:
  [[THUMBNAIL_TEXT: <headline>
  <body paragraph>]]
- Write the headline first on its own line, followed by the body on the next line. Keep the body as one paragraph with no line breaks.
- Randomly selected headline formula, written entirely in ${targetLanguage}: ${headlineFormula}
- Make the headline approximately 8–15 words, powerful, dramatic, and attention-grabbing.
- Write the body in approximately 90-120 words. In order, cover: [SHOCK] the main shocking development in one sentence; [EVIDENCE] 1–2 of the strongest supported details, facts, or numbers; [STAKES] why this could have serious consequences; [CONFLICT] escalating tension, conflict, or pressure; [CONSEQUENCE] what could happen next; and [CLIFFHANGER] a suspenseful question.
- Use a dramatic, high-impact storytelling style with emotional hooks, urgency, escalating tension, and curiosity. Do not print the bracketed beat labels.
- Do not invent facts, details, or statistics.
`;
}

function normalizePromptLanguage(language) {
  return String(language || "English").toLowerCase() === "german"
    ? "German"
    : "English";
}

function getPrompt(
  youtubeUrl,
  title,
  truncatedDescription,
  thumbnailText,
  generationMode = "story",
  language = "English",
) {
  const targetLanguage = normalizePromptLanguage(language);
  let topicInstruction = "";
  let languageInstruction = "";
  let roleInstruction = "";
  let taskInstruction = "";

  if (generationMode === "sports") {
    roleInstruction = `
### SYSTEM ROLE:
You are an elite sports journalist and viral clickbait writer specializing in dramatic, high-engagement sports coverage.
`;
    taskInstruction = `
### TASK:
Transform this YouTube video into a highly dramatic sports article with a strong hook, cinematic pacing, and massive clickbait energy.
`;
    topicInstruction = `
- The article should be based on the video title, description, and the emotional stakes of the sports story.`;
    languageInstruction = `
  - The article MUST be written entirely in ${targetLanguage}. Do not use another language, even if the video title uses another language.`;

    taskInstruction += `${getSportsThumbnailTextRequirement(targetLanguage)}\n- Write the headline and body in ${targetLanguage}.`;
  } else {
    roleInstruction = `
### SYSTEM ROLE:
You are an elite multimedia storyteller and viral content architect. Your expertise spans across multiple high-stakes arenas: MLB insider baseball, blockbuster cinema, geopolitical chess matches, tech disruptors, and pop culture frenzies. You write with the urgency of a breaking-news desk, the flair of a screenwriter, and the analytical depth of a Harvard case study. Every piece you craft is designed to stop the scroll, ignite comment sections, and dominate Twitter/X trends within 60 minutes of publication. Your tone is bold, provocative, and unapologetically dramatic—turning dry statistics into bloody rivalries, corporate earnings into gladiator battles, and celebrity feuds into Shakespearean tragedies. You don't just report news; you weaponize it into must-read, shareable, water-cooler content.
`;
    taskInstruction = `
### TASK:
Transform this YouTube video into a highly dramatic long-form sports article.
`;
  }

  if (thumbnailText) {
    topicInstruction = `
- The topic and focus of the article MUST depend on and revolve around the text found on the video's thumbnail image: "${thumbnailText}". Make sure this concept/player/event is central to the article's narrative.`;

    languageInstruction = `
  - The article MUST be written entirely in ${targetLanguage}. Treat the thumbnail text only as source information; do not copy its language into the article.`;
  } else {
    topicInstruction = `
- The topic of the article should be based on the video title and description.`;
    languageInstruction = `
  - The article MUST be written entirely in ${targetLanguage}. Do not use another language, even if the video title uses another language.`;
  }

  return `${roleInstruction}${taskInstruction}

### CONTEXT:
VIDEO URL: ${youtubeUrl}
VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${truncatedDescription}${thumbnailText ? `\nTEXT OVERLAY ON THUMBNAIL IMAGE: "${thumbnailText}"` : ""}

### CRITICAL WRITING STYLE:
- Make everything feel MASSIVE and franchise-altering.${topicInstruction}${languageInstruction}
- Use cinematic, emotional, and urgent language.
- The article must feel smooth and continuous from beginning to end.
- Do NOT write like dialogue or scripted conversation.
- Do NOT structure paragraphs like people talking back and forth.
- Avoid excessive quoting or interview-style writing.
- Avoid “he said / she said” repetition.
- Write like a real long-form sports feature article with seamless narrative flow.
- Every paragraph should naturally connect to the next with fluid transitions.
- The storytelling should feel immersive, emotional, and continuous.

### EXTREMELY IMPORTANT - FORMATTING RULES:
1. OUTPUT ONLY CLEAN HTML CONTENT.
2. DO NOT USE: <html>, <body>, <head>, <!DOCTYPE>, <title>, or <style> tags.
3. DO NOT USE: markdown blocks like \`\`\`html or \`\`\`.
4. DO NOT USE: section titles (h1, h2, h3), bullet points, or lists.
5. WRITE USING ONLY SHORT CINEMATIC PARAGRAPHS (2–5 lines max).
6. Length: 800 words.
7. End with a powerful dramatic line. (DO NOT append any URLs or "Original video" text at the end).

### OUTPUT START:
(Only output the <p> and <img> tags here)`;
}

async function generateWithOpenRouter(
  youtubeUrl,
  title,
  truncatedDescription,
  thumbnailText,
  generationMode = "story",
  language = "English",
) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!openRouterKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  // Model ưu tiên + fallback
  const openRouterModels = [
    process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
  ];

  const prompt = getPrompt(
    youtubeUrl,
    title,
    truncatedDescription,
    thumbnailText,
    generationMode,
    language,
  );

  console.log(`📡 Sending request to OpenRouter for: ${title}`);

  console.log(`🔄 Model fallback chain: ${openRouterModels.join(" → ")}`);

  const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/phatthanh113/tool-get-post",
      "X-Title": "YouTube Article Generator",
    },
    body: JSON.stringify({
      model: openRouterModels[0],

      // OpenRouter sẽ fallback sang model tiếp theo
      // nếu model trước đó không khả dụng
      models: openRouterModels,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const apiData = await apiRes.json().catch(() => ({}));

  if (!apiRes.ok) {
    const errorCode = apiData?.error?.code;
    const providerError = apiData?.error?.metadata?.provider_error_code;
    const providerName = apiData?.error?.metadata?.provider_name;
    const retryAfter = apiData?.error?.metadata?.retry_after_seconds;

    console.error(`❌ OpenRouter failed`, {
      httpStatus: apiRes.status,
      errorCode,
      providerError,
      providerName,
      retryAfter,
      error: apiData,
    });

    throw new Error(`OpenRouter API Error: ${JSON.stringify(apiData)}`);
  }

  const content = apiData?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      `OpenRouter returned empty content: ${JSON.stringify(apiData)}`,
    );
  }

  console.log(
    `✅ OpenRouter success - model used: ${apiData.model || "unknown"}`,
  );

  return content;
}

// API Key Rotation Logic
const groqKeys = (process.env.GROQ_API_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k);
let currentKeyIndex = 0;

function getNextGroqKey() {
  if (groqKeys.length === 0) return null;
  const key = groqKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % groqKeys.length;
  return key;
}

function extractChatCompletionText(apiData) {
  const content = apiData?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }

  return "";
}

function detectTitleLanguage(title) {
  return "en";
}

function buildEnglishFallbackClickbait(title, article) {
  const rawTitle = (title || article || "This story")
    .replace(/<[^>]+>/g, " ")
    .trim();
  const shortTitle =
    rawTitle.length > 90 ? `${rawTitle.slice(0, 87).trimEnd()}...` : rawTitle;
  return `The shocking story behind ${shortTitle} is about to change everything and leave fans stunned.`;
}

function buildLanguageFallbackClickbait(title, language) {
  if (normalizePromptLanguage(language) === "German") {
    const rawTitle = (title || "Diese Geschichte")
      .replace(/<[^>]+>/g, " ")
      .trim();
    const shortTitle =
      rawTitle.length > 90 ? `${rawTitle.slice(0, 87).trimEnd()}...` : rawTitle;
    return `Die schockierende Geschichte hinter ${shortTitle} wird alles verändern und die Fans verblüffen.`;
  }
  return buildEnglishFallbackClickbait(title);
}

function isVietnameseText(text) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text || "",
  );
}

function buildSportsClickbaitPrompt(sourceText, title, language = "English") {
  const safeSource = (sourceText || title || "This story").trim();
  const targetLanguage = normalizePromptLanguage(language);
  return `Rewrite the content below into dramatic, high-impact sports thumbnail text in ${targetLanguage}. Follow the required headline and body format exactly. The body must contain 90-120 words; never replace it with a short summary. Count the body words before responding and return only the required marker block.\n${getSportsThumbnailTextRequirement(targetLanguage)}\nWrite the headline and body in ${targetLanguage}. The title is: "${title}".\n\nOriginal content:\n${safeSource}`;
}

function extractSportsThumbnailText(articleText = "") {
  if (!articleText) return "";

  const directMatch = articleText.match(
    /\[\[THUMBNAIL_TEXT:\s*([\s\S]*?)\s*\]\]/i,
  );
  if (directMatch && directMatch[1]) {
    return directMatch[1].trim();
  }

  const playersMatch = articleText.match(/\[\[PLAYERS:\s*([\s\S]*?)\s*\]\]/i);
  if (playersMatch && playersMatch[1]) {
    return playersMatch[1].trim();
  }

  return "";
}

function validateSportsThumbnailText(text = "") {
  const candidate = (extractSportsThumbnailText(text) || text)
    .replace(/```(?:\w+)?/gi, "")
    .trim();
  const lines = candidate
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const headline = lines[0];
  const body = lines.slice(1).join(" ");
  const countWords = (value) =>
    (value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  const headlineWordCount = countWords(headline);
  const bodyWordCount = countWords(body);

  if (
    headlineWordCount < 8 ||
    headlineWordCount > 15 ||
    bodyWordCount < 80 ||
    bodyWordCount > 100
  ) {
    return null;
  }

  return `${headline}\n${body}`;
}

function stripHtmlToText(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateValidatedSportsThumbnailText(
  sourceText,
  title,
  provider,
  language = "English",
  options = {},
) {
  const { allowInvalid = false } = options;
  // Strip HTML tags so the model reads clean text instead of markup noise.
  const cleanSource = stripHtmlToText(sourceText);
  let previousDraft = "";

  for (let attempt = 0; attempt < 1; attempt++) {
    const prompt = buildSportsClickbaitPrompt(cleanSource, title, language);
    const targetLanguage = normalizePromptLanguage(language);
    const retryPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Write the headline and body entirely in ${targetLanguage}. Do not switch to English or any other language.\nHeadline: 8-15 words.\nBody: one paragraph containing exactly 6 complete sentences.\nMake each sentence approximately 16-18 words so the body reaches 90-120 words.\nBefore responding, silently check that the headline and body meet these requirements. If they do not, revise them before providing the final answer.\nReturn only the required marker block containing the headline and body. Do not include a word count or explanation.\nPrevious draft:\n${previousDraft}`;
    const draft = await generateClickbaitText(
      retryPrompt,
      title,
      provider,
      language,
    );
    const validatedText = validateSportsThumbnailText(draft);

    if (validatedText) return validatedText;

    previousDraft = draft;
    console.warn(
      "⚠️ Sports thumbnail text failed word-count validation (attempt 1/1).",
    );
  }

  // Fallback: hand back the raw (unvalidated) draft instead of failing outright.
  if (allowInvalid && previousDraft) {
    const cleanedDraft = (
      extractSportsThumbnailText(previousDraft) || previousDraft
    )
      .replace(/```(?:\w+)?/gi, "")
      .trim();
    if (cleanedDraft) {
      console.warn(
        "⚠️ Returning unvalidated sports thumbnail text (allowInvalid).",
      );
      return cleanedDraft;
    }
  }

  throw new Error(
    "AI failed to generate sports thumbnail text with an 8-15 word headline and a 80-100 word body.",
  );
}

async function generateClickbaitText(
  prompt,
  title,
  provider = "groq",
  language = "English",
) {
  if (provider === "openrouter") {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const openRouterModel =
      process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";

    const openRouterModels = [openRouterModel, "google/gemma-4-31b-it:free"];

    const apiRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/phatthanh113/tool-get-post",
          "X-Title": "YouTube Article Generator",
        },
        body: JSON.stringify({
          model: openRouterModel,
          models: openRouterModels,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
    );

    if (!apiRes.ok) {
      const errorData = await apiRes.json().catch(() => ({}));
      throw new Error(
        `OpenRouter clickbait error: ${JSON.stringify(errorData)}`,
      );
    }

    const apiData = await apiRes.json();
    const rawText = apiData.choices?.[0]?.message?.content?.trim() || "";
    return isVietnameseText(rawText)
      ? buildLanguageFallbackClickbait(title, language)
      : rawText;
  }

  let activeKey = null;
  try {
    activeKey = getNextGroqKey();
  } catch (keyErr) {
    console.warn("⚠️ Failed to get Groq key for clickbait:", keyErr.message);
  }

  if (!activeKey) {
    throw new Error("No Groq API key available for clickbait.");
  }

  const apiRes = await fetch(
    process.env.CUSTOM_API_URL ||
      "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
      }),
    },
  );

  if (!apiRes.ok) {
    const errorData = await apiRes.json().catch(() => ({}));
    throw new Error(`Groq clickbait API error: ${JSON.stringify(errorData)}`);
  }

  const apiData = await apiRes.json();
  const rawText = apiData.choices?.[0]?.message?.content?.trim() || "";
  return isVietnameseText(rawText)
    ? buildLanguageFallbackClickbait(title, language)
    : rawText;
}

app.post("/convert-download", async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];
    if (files.length !== 1) {
      return res.status(400).json({
        error: "Please upload exactly one file for download conversion.",
      });
    }

    let duration = parseFloat(req.body.duration);
    const randomDuration = req.body.randomDuration === "true";
    const generationMode = req.body.generationMode || req.body.mode || "story";
    const { audioPath: selectedAudioPath, hasAudio: selectedHasAudio } =
      getAudioForMode(generationMode);
    if (randomDuration || Number.isNaN(duration)) {
      duration = null;
    }

    const file = files[0];
    const fileExt = path.extname(file.name).toLowerCase();
    const isWebm = fileExt === ".webm";
    const outputFilename = isWebm
      ? `${path.basename(file.name, ".webm")}.mp4`
      : `video_${path.basename(file.name, path.extname(file.name))}.mp4`;
    const safeFilename = outputFilename.replace(/[^a-zA-Z0-9-_.]/g, "_");

    const tempPath = path.join(
      uploadsDir,
      `temp_${Date.now()}_${Math.random().toString(36).slice(2)}${fileExt}`,
    );
    const tempOutputPath = path.join(
      os.tmpdir(),
      `download_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`,
    );

    await file.mv(tempPath);

    const ffmpegCommand = ffmpeg();
    const effectiveDuration = duration || getRandomDuration();

    if (isWebm) {
      ffmpegCommand.input(tempPath);
    } else {
      ffmpegCommand.input(tempPath).loop(effectiveDuration);
    }

    if (selectedHasAudio && !isWebm) {
      ffmpegCommand.input(selectedAudioPath);
    }

    const outputOptions = [
      "-c:v libx264",
      "-pix_fmt yuv420p",
      "-preset medium",
      "-movflags +faststart",
      "-framerate 24",
    ];

    if (selectedHasAudio && !isWebm) {
      outputOptions.push("-c:a aac", "-shortest");
    }

    if (!isWebm) {
      outputOptions.push(`-t ${effectiveDuration}`);
    }

    ffmpegCommand
      .outputOptions(outputOptions)
      .videoBitrate("2000k")
      .save(tempOutputPath)
      .on("end", async () => {
        try {
          const stats = fs.statSync(tempOutputPath);
          if (stats.size > 0) {
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${safeFilename}"`,
            );
            const stream = fs.createReadStream(tempOutputPath);
            stream.pipe(res);
            stream.on("close", async () => {
              await Promise.all([
                safeDeleteFile(tempPath),
                safeDeleteFile(tempOutputPath),
              ]);
            });
          } else {
            await Promise.all([
              safeDeleteFile(tempPath),
              safeDeleteFile(tempOutputPath),
            ]);
            res.status(500).json({ error: "Generated video file is invalid" });
          }
        } catch (err) {
          await Promise.all([
            safeDeleteFile(tempPath),
            safeDeleteFile(tempOutputPath),
          ]);
          res.status(500).json({ error: "Video generation failed" });
        }
      })
      .on("error", async (err) => {
        console.error("FFmpeg error:", err);
        await Promise.all([
          safeDeleteFile(tempPath),
          safeDeleteFile(tempOutputPath),
        ]);
        res.status(500).json({ error: "Conversion failed" });
      });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/save-download-file", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const dir = String(req.body.dir || "").trim();
    let fileName = String(req.body.fileName || "").trim();
    if (!dir) {
      return res.status(400).json({ error: "Thiếu đường dẫn thư mục lưu video." });
    }
    if (!/^([a-zA-Z]:\\|\\\\|\/)/.test(dir)) {
      return res.status(400).json({ error: "Đường dẫn thư mục phải là đường dẫn tuyệt đối." });
    }
    if (!fileName) {
      return res.status(400).json({ error: "Thiếu tên file." });
    }
    fileName = fileName.replace(/[^a-zA-Z0-9-_. ]/g, "_");

    const targetDir = path.resolve(dir);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, fileName);
    await req.files.file.mv(targetPath);
    res.json({ ok: true, savedTo: targetPath });
  } catch (error) {
    console.error("Save download file error:", error);
    res.status(500).json({ error: error.message || "Không thể lưu file vào thư mục." });
  }
});

async function callSheetsWebApp(payload) {
  const webAppUrl = String(process.env.GS_WEBAPP_URL || "").trim();
  if (!webAppUrl) {
    throw new Error("Chưa cấu hình GS_WEBAPP_URL trong .env. Hãy thêm URL Web App Apps Script rồi restart server.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Google Apps Script trả về nội dung không hợp lệ (HTTP ${response.status}).`);
    }
    if (!data.ok) {
      throw new Error(data.error || "Google Apps Script trả lỗi không xác định.");
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

app.post("/sheet-paste", async (req, res) => {
  try {
    const prefix = String(req.body.prefix || "").trim();
    const rawRows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!prefix || !/^[a-zA-Z0-9_-]+$/.test(prefix)) {
      return res.status(400).json({ error: "Prefix không hợp lệ (chỉ gồm chữ, số, dấu - và _)." });
    }
    if (rawRows.length === 0) {
      return res.status(400).json({ error: "Không có hàng nào để dán." });
    }
    const rows = rawRows.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [String(row ?? "")],
    );
    const result = await callSheetsWebApp({ prefix, rows });
    res.json(result);
  } catch (error) {
    console.error("Sheet paste error:", error);
    res.status(error.name === "AbortError" ? 504 : 500).json({
      error: error.name === "AbortError" ? "Google Apps Script phản hồi quá chậm (timeout 20s)." : error.message || "Không thể dán vào Google Sheet.",
    });
  }
});

app.get("/sheet-check", async (req, res) => {
  try {
    const result = await callSheetsWebApp({ action: "check" });
    res.json(result);
  } catch (error) {
    console.error("Sheet check error:", error);
    res.status(error.name === "AbortError" ? 504 : 500).json({
      error: error.name === "AbortError" ? "Google Apps Script phản hồi quá chậm (timeout 20s)." : error.message || "Không thể kiểm tra Google Sheet.",
    });
  }
});


app.post("/generate-thumbnail-text", async (req, res) => {
  const {
    title = "",
    article = "",
    language = "English",
    provider = "groq",
  } = req.body || {};

  if (!String(article).trim()) {
    return res.status(400).json({ error: "Thiếu nội dung bài viết (article)." });
  }
  if (!String(title).trim()) {
    return res.status(400).json({ error: "Thiếu title của bài viết." });
  }

  try {
    const players = await generateValidatedSportsThumbnailText(
      String(article),
      String(title),
      provider,
      normalizePromptLanguage(language),
      { allowInvalid: true },
    );
    const validated = Boolean(validateSportsThumbnailText(players));
    res.json({ players, validated });
  } catch (error) {
    console.error("❌ Thumbnail text generation failed:", error.message);
    res.status(500).json({
      error: "Không tạo được thumbnail text.",
      details: error.message,
    });
  }
});

app.post("/generate-article", async (req, res) => {
  const {
    youtubeUrl,
    provider = "groq",
    generationMode = "story",
    thumbnailMode = "story",
    language = "English",
  } = req.body;
  const promptLanguage = normalizePromptLanguage(language);
  const videoId = extractVideoId(youtubeUrl);

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  try {
    // Test YouTube API key first
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`,
    );
    if (!ytRes.ok) {
      const errorData = await ytRes.text();
      console.error("YouTube API Error:", errorData);
      return res.status(ytRes.status).json({
        error: "YouTube API Error",
        source: "YouTube API",
        details: errorData,
      });
    }

    const ytData = await ytRes.json();

    if (!ytData.items || ytData.items.length === 0) {
      return res.status(404).json({ error: "Video not found on YouTube" });
    }

    const { title, description } = ytData.items[0].snippet;

    // Reduce truncation further to 1200 chars to save tokens (prevent Rate Limit)
    const truncatedDescription =
      description.length > 1200
        ? description.substring(0, 1200) + "..."
        : description;

    // OCR removed: thumbnail text is no longer extracted from images.
    let thumbnailText = "";
    const effectiveMode =
      generationMode === "thumbnail" || generationMode === "buzz-thumbnail"
        ? thumbnailMode || "story"
        : generationMode;

    try {
      let article = null;
      let lastError = null;
      const totalKeys = groqKeys.length;

      // AI generation logic with fallback
      if (provider === "openrouter") {
        article = await generateWithOpenRouter(
          youtubeUrl,
          title,
          truncatedDescription,
          thumbnailText,
          generationMode,
          promptLanguage,
        );
      } else {
        // Attempt Groq first
        for (let attempt = 0; attempt < totalKeys; attempt++) {
          const activeKey = getNextGroqKey();
          console.log(
            `📡 [Attempt ${attempt + 1}/${totalKeys}] Sending request to Groq (Key Index: ${currentKeyIndex}) for: ${title}`,
          );

          try {
            const apiRes = await fetch(
              process.env.CUSTOM_API_URL ||
                "https://api.groq.com/openai/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${activeKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
                  max_completion_tokens: 3000,
                  reasoning_effort: "low",
                  messages: [
                    {
                      role: "user",
                      content: getPrompt(
                        youtubeUrl,
                        title,
                        truncatedDescription,
                        thumbnailText,
                        generationMode,
                        promptLanguage,
                      ),
                    },
                  ],
                }),
              },
            );

            if (!apiRes.ok) {
              const errorData = await apiRes.json().catch(() => ({}));
              const isRateLimit =
                apiRes.status === 429 ||
                (errorData.error &&
                  errorData.error.code === "rate_limit_exceeded");

              if (isRateLimit) {
                console.warn(
                  `⏳ Rate limit hit on Key Index ${currentKeyIndex}. Waiting 5s before next key...`,
                );
                await new Promise((resolve) => setTimeout(resolve, 5000));
              } else {
                console.warn(
                  `⚠️ Key Index ${currentKeyIndex} failed (${apiRes.status})`,
                );
              }

              lastError = new Error(
                `Groq API Error: ${JSON.stringify(errorData)}`,
              );
              continue;
            }

            const apiData = await apiRes.json();
            const generatedArticle = extractChatCompletionText(apiData);

            if (typeof generatedArticle === "string" && generatedArticle) {
              article = generatedArticle;
              console.log("✅ Article successfully generated via Groq!");
              break;
            }

            lastError = new Error("Groq returned empty article content.");
            const message = apiData?.choices?.[0]?.message;
            console.warn(
              "⚠️ Groq returned no article content; trying the next provider/key.",
              {
                model: apiData?.model || process.env.GROQ_MODEL || "unknown",
                finishReason: apiData?.choices?.[0]?.finish_reason || "unknown",
                messageFields: message ? Object.keys(message) : [],
                hasReasoning: Boolean(message?.reasoning),
              },
            );
          } catch (fetchErr) {
            console.error(
              `❌ Network error with Key Index ${currentKeyIndex}:`,
              fetchErr.message,
            );
            lastError = fetchErr;
            continue;
          }
        }

        // Final Fallback to OpenRouter only when Groq returned no usable article.
        if (!article) {
          console.warn(
            "⚠️ All Groq keys failed. Falling back to OpenRouter...",
          );
          try {
            article = await generateWithOpenRouter(
              youtubeUrl,
              title,
              truncatedDescription,
              thumbnailText,
              generationMode,
              promptLanguage,
            );
            console.log("✅ Fallback to OpenRouter successful!");
          } catch (fallbackErr) {
            console.error(
              "❌ Fallback to OpenRouter also failed:",
              fallbackErr.message,
            );
            lastError = fallbackErr;
          }
        }
      }

      if (
        generationMode === "buzz-thumbnail" ||
        generationMode === "thumbnail"
      ) {
        let players = thumbnailText || "";

        if (effectiveMode === "sports") {
          const clickbaitSource = [
            title,
            truncatedDescription,
            thumbnailText,
            article,
          ]
            .filter(Boolean)
            .join("\n\n");
          const clickbaitTimeoutMs = DEFAULT_CLICKBAIT_TIMEOUT;
          const cbResult = await runWithTimeout(
            () =>
              generateValidatedSportsThumbnailText(
                clickbaitSource,
                title,
                provider,
                promptLanguage,
              ),
            clickbaitTimeoutMs,
          );

          if (cbResult.timedOut) {
            throw new Error(
              `Sports thumbnail text generation timed out after ${clickbaitTimeoutMs}ms.`,
            );
          }
          if (cbResult.error) {
            throw cbResult.error;
          }

          players = cbResult.value;
        }

        return res.json({
          videoId,
          article: "",
          players,
          title,
        });
      }

      if (!article) {
        throw (
          lastError || new Error("All API keys failed to generate content.")
        );
      }

      let players = thumbnailText || "";

      if (generationMode === "sports") {
        const articleThumbnailText = extractSportsThumbnailText(article);
        const sportsThumbnailText = validateSportsThumbnailText(
          articleThumbnailText,
        );
        players = articleThumbnailText || players;

        if (sportsThumbnailText) {
          players = sportsThumbnailText;
          console.log(
            "✅ Sports thumbnail text extracted and passed word-count validation.",
          );
        } else {
          console.warn(
            "⚠️ Sports thumbnail text marker was missing or failed word-count validation; regenerating thumbnail text.",
          );
          try {
            players = await generateValidatedSportsThumbnailText(
              article,
              title,
              provider,
              promptLanguage,
            );
          } catch (thumbnailError) {
            console.warn(
              "⚠️ Could not regenerate valid sports thumbnail text; keeping the existing thumbnail text and article:",
              thumbnailError.message,
            );
          }
        }
      }

      // Clean up article (strip any leftover markers just in case)
      const finalArticle = article
        .replace(/\[\[THUMBNAIL_TEXT:\s*([\s\S]*?)\s*\]\]/gi, "")
        .replace(/\[\[PLAYERS:\s*(.*?)\s*\]\]/gi, "")
        .replace(/\[\[TEAM:\s*(.*?)\s*\]\]/gi, "")
        .trim();

      res.json({
        videoId,
        article: finalArticle,
        players,
        title,
      });
    } catch (apiError) {
      console.error("❌ Final Generation Failure:", apiError.message);
      return res.status(500).json({
        error: "Generation Failed",
        source: "Groq AI (Rotated)",
        details: apiError.message,
      });
    }
  } catch (err) {
    console.error("General Error:", err);
    res.status(500).json({
      error: "API Error",
      source: err.message.includes("YouTube") ? "YouTube API" : "Custom AI API",
      details: err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});