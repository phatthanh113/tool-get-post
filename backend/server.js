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
const { default: Groq } = require("groq-sdk");

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

// Timeout helpers and default values for thumbnail operations
const DEFAULT_THUMB_OCR_TIMEOUT = parseInt(
  process.env.THUMB_OCR_TIMEOUT_MS || "5000",
  10,
);
const DEFAULT_CLICKBAIT_TIMEOUT = parseInt(
  process.env.CLICKBAIT_TIMEOUT_MS || "4000",
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
  const match = url.match(/(?:v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getPrompt(
  youtubeUrl,
  title,
  truncatedDescription,
  thumbnailText,
  generationMode = "story",
) {
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
  - The article MUST be written entirely in English. Do not write in Spanish, Vietnamese, or any other language, even if the video title uses another language.`;

    taskInstruction += `
### THUMBNAIL_TEXT_REQUIREMENT:
- At the very end of the article response, include exactly one final marker line in this format (on its own line):
  [[THUMBNAIL_TEXT: <one English paragraph here>]]
- The paragraph must be a short, dramatic sports clickbait paragraph in English ONLY, and must be EXACTLY 120–130 words. Return a single smooth paragraph with no bullets or lists.
- If your first draft is shorter than 120 words, expand it by adding vivid, concrete detail until it reaches at least 120 words; do not exceed 130 words.
- Focus on the key athlete, team, or moment; make the language urgent, explosive, and impossible to ignore.
- Structure the paragraph in this exact order: shocking hook → the most striking detail or statistic → explain why the event is serious → escalate the conflict or drama → reveal the consequence or imminent risk → end with a cliffhanger question.
- Blend all six beats naturally into one continuous paragraph. Do not add labels, arrows, or bullet points, and do not invent facts or statistics.
`;
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
  - The article MUST be written entirely in English. Treat the thumbnail text only as source information; do not copy its language into the article. Do not write in Spanish, Vietnamese, or any other language.`;
  } else {
    topicInstruction = `
- The topic of the article should be based on the video title and description.`;
    languageInstruction = `
  - The article MUST be written entirely in English. Do not write in Spanish, Vietnamese, or any other language, even if the video title uses another language.`;
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

async function generateWithLocalAI(
  youtubeUrl,
  title,
  truncatedDescription,
  thumbnailText,
  generationMode = "story",
) {
  const localUrl =
    process.env.LOCAL_AI_URL || "http://localhost:8080/v1/chat/completions";
  const localModel = process.env.LOCAL_AI_MODEL || "Qwen3.7-Plus";

  console.log(
    `📡 Sending request to Local AI using model: ${localModel} at ${localUrl} for: ${title}`,
  );

  const apiRes = await fetch(localUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: localModel,
      messages: [
        {
          role: "user",
          content: getPrompt(
            youtubeUrl,
            title,
            truncatedDescription,
            thumbnailText,
            generationMode,
          ),
        },
      ],
    }),
  });

  if (!apiRes.ok) {
    const errorData = await apiRes.text().catch(() => "");
    throw new Error(`Local AI API Error: ${apiRes.status} ${errorData}`);
  }

  const apiData = await apiRes.json();
  return apiData.choices[0].message.content;
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

function isVietnameseText(text) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text || "",
  );
}

function buildSportsClickbaitPrompt(sourceText, title) {
  const safeSource = (sourceText || title || "This story").trim();
  return `Rewrite the content below into a short, highly dramatic, clickbait-style description of about 120-130 words. Use the same cinematic, urgent, franchise-altering tone as the article prompt. Return only one single smooth paragraph, no bullets, no list formatting. IMPORTANT: Write the entire description in English only. Do not use Vietnamese or any other language. Keep it to 120-130 words and make the key athlete, team, or event feel massive and unforgettable. Structure the paragraph in this exact order: shocking hook → the most striking detail or statistic → explain why the event is serious → escalate the conflict or drama → reveal the consequence or imminent risk → end with a cliffhanger question. Blend all six beats naturally into one continuous paragraph; do not add labels, arrows, or bullet points, and do not invent facts or statistics. At the end of the response, add one exact marker line in this format: [[THUMBNAIL_TEXT: <your paragraph here>]]. The title is: "${title}".\n\nOriginal content:\n${safeSource}`;
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

async function generateClickbaitText(prompt, title, provider = "groq") {
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
      ? buildEnglishFallbackClickbait(title, prompt)
      : rawText;
  } else if (provider === "local") {
    const localUrl =
      process.env.LOCAL_AI_URL || "http://localhost:8080/v1/chat/completions";
    const localModel = process.env.LOCAL_AI_MODEL || "Qwen3.7-Plus";

    const apiRes = await fetch(localUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: localModel,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!apiRes.ok) {
      const errorData = await apiRes.text().catch(() => "");
      throw new Error(
        `Local AI clickbait error: ${apiRes.status} ${errorData}`,
      );
    }

    const apiData = await apiRes.json();
    const rawText = apiData.choices?.[0]?.message?.content?.trim() || "";
    return isVietnameseText(rawText)
      ? buildEnglishFallbackClickbait(title, prompt)
      : rawText;
  }

  let activeKey = null;
  try {
    activeKey = getNextGroqKey();
  } catch (keyErr) {
    console.warn("⚠️ Failed to get Groq key for clickbait:", keyErr.message);
  }

  if (activeKey) {
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
            messages: [{ role: "user", content: prompt }],
          }),
        },
      );

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        const rawText = apiData.choices?.[0]?.message?.content?.trim() || "";
        return isVietnameseText(rawText)
          ? buildEnglishFallbackClickbait(title, prompt)
          : rawText;
      } else {
        const errorData = await apiRes.json().catch(() => ({}));
        console.warn(
          `⚠️ Groq clickbait API error: ${JSON.stringify(errorData)}. Falling back to Local AI...`,
        );
      }
    } catch (err) {
      console.warn(
        `⚠️ Groq clickbait failed: ${err.message}. Falling back to Local AI...`,
      );
    }
  } else {
    console.warn(
      "⚠️ No Groq API key available for clickbait. Falling back to Local AI...",
    );
  }

  console.log("📡 [Fallback] Requesting Local AI for clickbait...");
  const localUrl =
    process.env.LOCAL_AI_URL || "http://localhost:8080/v1/chat/completions";
  const localModel = process.env.LOCAL_AI_MODEL || "Qwen3.7-Plus";

  const apiRes = await fetch(localUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: localModel,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!apiRes.ok) {
    const errorData = await apiRes.text().catch(() => "");
    throw new Error(`Local AI clickbait error: ${apiRes.status} ${errorData}`);
  }

  const apiData = await apiRes.json();
  const rawText = apiData.choices?.[0]?.message?.content?.trim() || "";
  return isVietnameseText(rawText)
    ? buildEnglishFallbackClickbait(title, prompt)
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

app.post("/generate-article", async (req, res) => {
  const {
    youtubeUrl,
    provider = "groq",
    generationMode = "story",
    thumbnailMode = "story",
  } = req.body;
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
    console.log(ytRes);
    console.log(
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

    // Extract text from thumbnail using Gemini Vision OCR
    // Đặt 2 key vào .env, cách nhau bởi dấu phẩy
    // GEMINI_API_KEYS=key_cua_VvtQ,key_cua_r7Sw

    const GROQ_KEYS = (process.env.GROQ_THUMB_API || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const GROQ_MODEL =
      process.env.GROQ_THUMB_MODEL ||
      "meta-llama/llama-4-scout-17b-16e-instruct";

    let thumbnailText = "";
    const effectiveMode =
      generationMode === "thumbnail" || generationMode === "buzz-thumbnail"
        ? thumbnailMode || "story"
        : generationMode;

    if (
      (effectiveMode !== "sports" ||
        generationMode === "thumbnail" ||
        generationMode === "buzz-thumbnail") &&
      GROQ_KEYS.length > 0
    ) {
      try {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        console.log(`📸 Fetching thumbnail: ${thumbnailUrl}`);

        const thumbnailFetch = await runWithTimeout(
          () => fetch(thumbnailUrl),
          DEFAULT_THUMB_OCR_TIMEOUT,
        );

        if (thumbnailFetch.timedOut) {
          console.warn(
            `⚠️ Thumbnail fetch timed out after ${DEFAULT_THUMB_OCR_TIMEOUT}ms; continuing without thumbnail text.`,
          );
          throw new Error("Thumbnail fetch timed out");
        }

        if (thumbnailFetch.error) {
          throw thumbnailFetch.error;
        }

        const imgRes = thumbnailFetch.value;

        if (imgRes.ok) {
          const buffer = await imgRes.buffer();
          const base64Image = buffer.toString("base64");

          const ocrPrompt = `
Extract ALL visible text from this image.

Rules:
- Return ONLY the extracted text.
- Preserve line breaks.
- Do NOT translate.
- Do NOT summarize.
- Do NOT explain.
- Do NOT include any thinking, analysis, or XML tags like <think>.
If there is no text, return an empty string.
`;

          // encapsulate OCR attempts so we can apply a timeout
          const performOcr = async () => {
            let rawText = "";

            for (let i = 0; i < GROQ_KEYS.length; i++) {
              const apiKey = GROQ_KEYS[i];
              const shortKey = apiKey.slice(-4);

              try {
                console.log(
                  `⚡ Requesting OCR with key ...${shortKey} (${i + 1}/${GROQ_KEYS.length})`,
                );

                const groq = new Groq({ apiKey });

                const completion = await groq.chat.completions.create({
                  model: GROQ_MODEL,
                  temperature: 0,
                  max_tokens: 150,
                  reasoning_effort: "none",
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: ocrPrompt },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                          },
                        },
                      ],
                    },
                  ],
                });

                rawText =
                  completion.choices?.[0]?.message?.content?.trim() || "";

                if (rawText) {
                  console.log(`✅ OCR success with key ...${shortKey}`);
                  return rawText;
                }
              } catch (err) {
                console.warn(`⚠️ Key ...${shortKey} failed: ${err.message}`);
              }
            }

            // Groq failed or returned empty — try Local AI
            try {
              console.log(
                "❌ All Groq API keys failed for OCR. Falling back to Local AI...",
              );
              const localUrl =
                process.env.LOCAL_AI_URL ||
                "http://localhost:8080/v1/chat/completions";
              const localModel = process.env.LOCAL_AI_MODEL || "Qwen3.7-Plus";

              console.log(
                `⚡ Requesting Local AI OCR using model: ${localModel}`,
              );
              const localRes = await fetch(localUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: localModel,
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: ocrPrompt },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                          },
                        },
                      ],
                    },
                  ],
                }),
              });

              if (localRes.ok) {
                const localData = await localRes.json();
                const localText =
                  localData.choices?.[0]?.message?.content?.trim() || "";
                console.log("✅ Local AI OCR success!");
                return localText;
              } else {
                console.error(
                  `❌ Local AI OCR failed with status: ${localRes.status}`,
                );
              }
            } catch (localErr) {
              console.error("❌ Local AI OCR error:", localErr.message);
            }

            return "";
          };

          const ocrTimeoutMs = DEFAULT_THUMB_OCR_TIMEOUT;
          const ocrResult = await runWithTimeout(performOcr, ocrTimeoutMs);

          let rawText = "";
          if (ocrResult.timedOut) {
            console.warn(
              `⚠️ Thumbnail OCR timed out after ${ocrTimeoutMs}ms; skipping thumbnail text.`,
            );
          } else if (ocrResult.error) {
            console.error(
              "❌ Error during thumbnail OCR:",
              ocrResult.error.message,
            );
          } else {
            rawText = ocrResult.value || "";
          }

          if (rawText && rawText !== "NO_TEXT") {
            thumbnailText = rawText;
          }

          console.log(`🔍 Extracted thumbnail text: "${thumbnailText}"`);
        } else {
          console.warn(
            `⚠️ Failed to fetch thumbnail (${imgRes.status}): ${imgRes.statusText}`,
          );
        }
      } catch (ocrErr) {
        console.error(
          "❌ Error during thumbnail text extraction:",
          ocrErr.message,
        );
      }
    } else {
      console.warn(
        "⚠️ No GROQ_THUMB_API found in environment, skipping thumbnail OCR.",
      );
    }

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
        );
      } else if (provider === "local") {
        article = await generateWithLocalAI(
          youtubeUrl,
          title,
          truncatedDescription,
          thumbnailText,
          generationMode,
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
          try {
            let clickbaitPrompt = buildSportsClickbaitPrompt(
              thumbnailText || title,
              title,
            );
            // Reinforce strict length requirement in case the model ignores lighter instructions
            clickbaitPrompt +=
              "\n\nIMPORTANT: The thumbnail paragraph must be EXACTLY 120-130 words. If shorter, expand it (add vivid, concrete detail) until it reaches at least 120 words; do not exceed 130 words. Follow this beat order: shocking hook → most striking detail/statistic → why it is serious → escalate the conflict/drama → consequence or imminent risk → cliffhanger question. Blend the beats into one paragraph without labels or arrows, do not invent facts/statistics, and include the marker [[THUMBNAIL_TEXT: <your paragraph>]] at the end.";
            const clickbaitTimeoutMs = DEFAULT_CLICKBAIT_TIMEOUT;
            const cbResult = await runWithTimeout(
              () => generateClickbaitText(clickbaitPrompt, title, provider),
              clickbaitTimeoutMs,
            );

            if (cbResult.timedOut) {
              console.warn(
                `⚠️ Thumbnail clickbait generation timed out after ${clickbaitTimeoutMs}ms; leaving thumbnail text empty.`,
              );
            } else if (cbResult.error) {
              console.warn(
                "⚠️ Thumbnail sports clickbait failed:",
                cbResult.error.message,
              );
            } else if (cbResult.value) {
              players = cbResult.value;
            }
          } catch (clickbaitErr) {
            console.warn(
              "⚠️ Thumbnail sports clickbait failed:",
              clickbaitErr.message,
            );
          }
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
        const sportsThumbnailText = extractSportsThumbnailText(article);
        if (sportsThumbnailText) {
          players = sportsThumbnailText;
          console.log(
            "✅ Sports clickbait thumbnail text extracted from same response.",
          );
        } else {
          console.warn(
            "⚠️ Sports thumbnail text marker was not found; continuing with article fallback.",
          );
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
