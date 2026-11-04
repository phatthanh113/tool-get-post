// Content script cho YouTube - Capture video frame
console.log("🎥 YouTube content script loaded");

// Lắng nghe message từ background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureVideoFrame") {
    console.log("📸 Đang capture frame từ video...");

    // Tìm video element trên trang YouTube
    const video = document.querySelector("video");

    if (!video) {
      console.error("❌ Không tìm thấy video element");
      sendResponse({ success: false, error: "Không tìm thấy video" });
      return true;
    }

    try {
      // Tạo canvas để capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Chuyển canvas thành data URL
      const frameDataUrl = canvas.toDataURL("image/jpeg", 0.95);

      console.log("✅ Đã capture frame:", {
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: frameDataUrl.length,
      });

      sendResponse({
        success: true,
        frameDataUrl: frameDataUrl,
        width: canvas.width,
        height: canvas.height,
      });
    } catch (error) {
      console.error("❌ Lỗi khi capture frame:", error);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Giữ message channel mở cho async response
  }
});
