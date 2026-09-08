const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require("node-fetch");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "undefined");
  
  // Use a video ID that we know exists
  const videoId = "dQw4w9WgXcQ"; // Rickroll
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  
  try {
    console.log(`Fetching thumbnail: ${thumbnailUrl}`);
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    const base64Image = buffer.toString("base64");
    console.log("Thumbnail downloaded, base64 length:", base64Image.length);

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash as the latest standard flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Analyze this image and extract all text written on it. 
If there is no text, return "NO_TEXT".
Do not include any explanation or extra symbols, just return the exact text you see.`;

    console.log("Sending request to Gemini...");
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      }
    ]);

    console.log("Response text:");
    console.log(result.response.text());
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
