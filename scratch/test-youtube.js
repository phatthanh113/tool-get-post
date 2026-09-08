const fetch = require("node-fetch");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function testVideo() {
  const videoId = "hfA4Y9aNxRA";
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`;
  
  console.log("Fetching URL:", url);
  try {
    const res = await fetch(url);
    console.log("Response Status:", res.status, res.statusText);
    const data = await res.json();
    console.log("Response Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testVideo();
