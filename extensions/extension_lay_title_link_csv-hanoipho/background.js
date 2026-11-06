chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "closeLinastoryTabs") {
    chrome.tabs.query({}, async (tabs) => {
      const linastoryTabs = tabs.filter((tab) => {
        try {
          const hostname = new URL(tab.url || "").hostname.toLowerCase();
          return hostname === "linatoysdochoitreem.com" ||
            hostname.endsWith(".linatoysdochoitreem.com") ||
            hostname === "linastory.com" ||
            hostname.endsWith(".linastory.com");
        } catch (error) {
          return false;
        }
      });
      const tabIds = linastoryTabs.map((tab) => tab.id).filter((id) => Number.isInteger(id));
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
      sendResponse({ success: true, closedCount: tabIds.length });
    });
    return true;
  }

  if (message.action === "openTable") {
    const tableUrl = chrome.runtime.getURL("table.html");

    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find((tab) => tab.url === tableUrl);

      if (existingTab) {
        console.log("📌 Đã có tab table.html → chuyển đến tab đó");
        chrome.tabs.update(existingTab.id, { active: true });
      } else {
        console.log("🆕 Chưa có tab table.html → mở mới");
        chrome.tabs.create({ url: tableUrl });
      }
    });
  }
});

// Tạo context menu khi extension được cài đặt
chrome.runtime.onInstalled.addListener(() => {
  // Xóa menu cũ nếu có
  chrome.contextMenus.removeAll(() => {
    // Menu cho Google Images - tự động đẩy vào BaseImage hoặc ThirdImage
    chrome.contextMenus.create({
      id: "addImageToEditor",
      title: "🖼️ Thêm ảnh vào Editor",
      contexts: ["image"],
      documentUrlPatterns: [
        "https://www.google.com/search*",
        "https://www.google.com.vn/search*",
        "https://www.google.com/images*",
      ],
    });

    // Menu cho YouTube Video - Capture frame và đẩy vào Editor
    chrome.contextMenus.create({
      id: "captureYouTubeFrame",
      title: "🎥 Thêm frame video vào Editor",
      contexts: ["video"],
      documentUrlPatterns: ["https://www.youtube.com/*"],
    });
  });
});

// Xử lý khi user click vào context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Xử lý menu Google Images
  if (info.menuItemId === "addImageToEditor") {
    const imageUrl = info.srcUrl || info.linkUrl;

    if (!imageUrl) {
      console.error("Không thể lấy URL ảnh");
      return;
    }

    // Tìm tab get_img_bg.html đang mở
    chrome.tabs.query({}, (tabs) => {
      const getImgBgTab = tabs.find(
        (tab) => tab.url && tab.url.includes("get_img_bg.html")
      );

      if (getImgBgTab) {
        // Kiểm tra trạng thái và quyết định đẩy vào baseImage hay thirdImage (không toggle tab)
        chrome.tabs
          .sendMessage(getImgBgTab.id, {
            action: "checkImageStatus",
          })
          .then((response) => {
            // Quyết định đẩy vào baseImage hay thirdImage
            let imageType = "base";
            if (response && response.hasBaseImage && !response.hasThirdImage) {
              // Đã có baseImage nhưng chưa có thirdImage → đẩy vào thirdImage
              imageType = "third";
            }
            // Nếu chưa có baseImage → đẩy vào baseImage
            // Nếu cả hai đã có → đẩy vào baseImage (thay thế)

            // Gửi message để load ảnh
            chrome.tabs
              .sendMessage(getImgBgTab.id, {
                action: "loadImageFromUrl",
                imageUrl: imageUrl,
                imageType: imageType,
              })
              .catch((error) => {
                // Nếu tab chưa sẵn sàng, thử inject script với logic tự động
                chrome.scripting
                  .executeScript({
                    target: { tabId: getImgBgTab.id },
                    func: loadImageAutoSelect,
                    args: [imageUrl],
                  })
                  .catch((err) => {
                    console.error("Lỗi khi gửi ảnh:", err);
                    // Fallback: mở tab mới
                    const url = chrome.runtime.getURL(
                      `get_img_bg.html?base=${encodeURIComponent(imageUrl)}`
                    );
                    chrome.tabs.create({ url: url });
                  });
              });
          })
          .catch((error) => {
            // Nếu không thể kiểm tra trạng thái, inject script với logic tự động
            chrome.scripting
              .executeScript({
                target: { tabId: getImgBgTab.id },
                func: loadImageAutoSelect,
                args: [imageUrl],
              })
              .catch((err) => {
                console.error("Lỗi khi gửi ảnh:", err);
                // Fallback: mở tab mới
                const url = chrome.runtime.getURL(
                  `get_img_bg.html?base=${encodeURIComponent(imageUrl)}`
                );
                chrome.tabs.create({ url: url });
              });
          });
      } else {
        // Chưa có tab get_img_bg.html, mở tab mới và đẩy vào baseImage
        const url = chrome.runtime.getURL(
          `get_img_bg.html?base=${encodeURIComponent(imageUrl)}`
        );
        chrome.tabs.create({ url: url });
      }
    });
  }

  // Xử lý menu YouTube Video
  if (info.menuItemId === "captureYouTubeFrame") {
    console.log("🎥 Bắt đầu capture frame từ YouTube video...");

    // Gửi message đến content script để capture frame
    chrome.tabs.sendMessage(
      tab.id,
      { action: "captureVideoFrame" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Lỗi:", chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.success) {
          console.error("❌ Không thể capture frame:", response?.error);
          alert("Không thể lấy frame từ video. Vui lòng thử lại.");
          return;
        }

        console.log("✅ Đã capture frame thành công!");
        const frameDataUrl = response.frameDataUrl;

        // Tìm hoặc tạo tab get_img_bg.html
        chrome.tabs.query({}, (tabs) => {
          const getImgBgTab = tabs.find(
            (tab) => tab.url && tab.url.includes("get_img_bg.html")
          );

          if (getImgBgTab) {
            // Tab đã mở - kiểm tra trạng thái và tự động chọn base/third
            chrome.tabs
              .sendMessage(getImgBgTab.id, {
                action: "checkImageStatus",
              })
              .then((statusResponse) => {
                // Quyết định đẩy vào baseImage hay thirdImage (giống logic Google Images)
                let imageType = "base";
                if (
                  statusResponse &&
                  statusResponse.hasBaseImage &&
                  !statusResponse.hasThirdImage
                ) {
                  // Đã có baseImage nhưng chưa có thirdImage → đẩy vào thirdImage
                  imageType = "third";
                }
                // Nếu chưa có baseImage → đẩy vào baseImage
                // Nếu cả hai đã có → đẩy vào baseImage (thay thế)

                console.log(`📍 Đẩy frame vào ${imageType}Image`);

                // Gửi frame với imageType tự động
                chrome.tabs
                  .sendMessage(getImgBgTab.id, {
                    action: "loadImageFromUrl",
                    imageUrl: frameDataUrl,
                    imageType: imageType,
                  })
                  .then(() => {
                    console.log(`✅ Đã gửi frame vào ${imageType}Image`);
                    // Chuyển sang tab get_img_bg.html
                    chrome.tabs.update(getImgBgTab.id, { active: true });
                  })
                  .catch((error) => {
                    console.error("❌ Lỗi khi gửi frame:", error);
                    // Fallback: inject script với logic tự động
                    chrome.scripting
                      .executeScript({
                        target: { tabId: getImgBgTab.id },
                        func: loadImageAutoSelect,
                        args: [frameDataUrl],
                      })
                      .catch((err) => {
                        console.error("❌ Lỗi inject script:", err);
                      });
                  });
              })
              .catch((error) => {
                console.error("❌ Không thể kiểm tra trạng thái:", error);
                // Fallback: inject script với logic tự động
                chrome.scripting
                  .executeScript({
                    target: { tabId: getImgBgTab.id },
                    func: loadImageAutoSelect,
                    args: [frameDataUrl],
                  })
                  .catch((err) => {
                    console.error("❌ Lỗi inject script:", err);
                  });
              });
          } else {
            // Chưa có tab, mở tab mới và đẩy vào baseImage
            const url =
              chrome.runtime.getURL("get_img_bg.html") +
              `?base=${encodeURIComponent(frameDataUrl)}`;
            chrome.tabs.create({ url: url });
          }
        });
      }
    );
  }
});

// Hàm để inject vào tab get_img_bg.html - tự động chọn baseImage hoặc thirdImage
function loadImageAutoSelect(imageUrl) {
  // Kiểm tra trạng thái hiện tại
  const hasBaseImage =
    window.baseImage !== null && window.baseImage !== undefined;
  const hasThirdImage =
    window.thirdImage !== null && window.thirdImage !== undefined;

  // Quyết định đẩy vào baseImage hay thirdImage
  let imageType = "base";
  if (hasBaseImage && !hasThirdImage) {
    // Đã có baseImage nhưng chưa có thirdImage → đẩy vào thirdImage
    imageType = "third";
  }
  // Nếu chưa có baseImage → đẩy vào baseImage
  // Nếu cả hai đã có → đẩy vào baseImage (thay thế)

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    if (window.baseImage === undefined || window.thirdImage === undefined) {
      console.error("get_img_bg.js chưa được load");
      return;
    }

    if (imageType === "base") {
      window.baseImage = img;

      // Xử lý đặc biệt cho layout 16:3
      if (window.currentLayout === "16:3" && window.canvas) {
        // Tính toán lại kích thước cho baseImage để lấp đầy canvas
        const scale = Math.max(
          window.canvas.width / img.width,
          window.canvas.height / img.height
        );
        if (window.baseDraw) {
          window.baseDraw.width = img.width * scale;
          window.baseDraw.height = img.height * scale;
          window.baseDraw.x = (window.canvas.width - window.baseDraw.width) / 2;
          window.baseDraw.y =
            (window.canvas.height - window.baseDraw.height) / 2;
        }
      } else if (window.setBaseDrawDimensions) {
        window.setBaseDrawDimensions();
      }
    } else if (imageType === "third") {
      window.thirdImage = img;
    }

    if (window.drawImages) {
      window.drawImages();
    }
  };

  img.onerror = () => {
    console.error("Không thể tải ảnh từ URL:", imageUrl);
    alert("Không thể tải ảnh từ URL này. Vui lòng thử lại.");
  };

  img.src = imageUrl;
}
