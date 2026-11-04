// Content script cho Google Images
// Giúp lấy URL ảnh chính xác hơn khi click chuột phải

// Lưu URL ảnh khi click
document.addEventListener(
  "contextmenu",
  (e) => {
    const img = e.target.closest("img");
    if (img) {
      // Lưu URL ảnh vào storage để background.js có thể lấy
      const imageUrl =
        img.src || img.dataset.src || img.getAttribute("data-src");
      if (imageUrl) {
        chrome.storage.local.set({ lastClickedImageUrl: imageUrl });
      }
    }
  },
  true
);
