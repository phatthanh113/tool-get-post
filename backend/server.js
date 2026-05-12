const path = require("path");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

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

app.use(cors());
app.use(express.json());

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

app.post("/generate-article", async (req, res) => {
  const { youtubeUrl } = req.body;
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

    const { title, description, channelTitle } = ytData.items[0].snippet;

    try {
      const apiRes = await fetch(
        process.env.CUSTOM_API_URL || "https://ds2api-39kontk1g-phats-projects-a0185461.vercel.app/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CUSTOM_API_KEY || "phat-api-key"}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-v4-flash-nothinking",
            messages: [
              {
                role: "user",
                content: `### SYSTEM ROLE:
You are an elite MLB insider journalist and viral sports news writer specializing in dramatic, high-engagement baseball coverage.

### TASK:
Transform this YouTube video into a highly dramatic long-form sports article.

### CONTEXT:
VIDEO URL: ${youtubeUrl}
VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${description}

### CRITICAL WRITING STYLE:
- Make everything feel MASSIVE and franchise-altering.
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
(Only output the <p> and <img> tags here)`,
              },
            ],
          }),
        },
      );

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        throw new Error(`Custom API Error: ${errorText}`);
      }

      const apiData = await apiRes.json();
      const article = apiData.choices[0].message.content;

      res.json({
        videoId,
        article,
        title, // Return original title for the title input
      });
    } catch (apiError) {
      console.error("❌ API ERROR DETAIL:", apiError.message);
      return res.status(500).json({
        error: "Generation Failed",
        source: "Custom API",
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
