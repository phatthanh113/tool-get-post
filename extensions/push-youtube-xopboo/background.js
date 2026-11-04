chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Tìm tất cả tab YouTube đang mở
    const allTabs = await chrome.tabs.query({});
    const youtubeTabs = allTabs.filter((t) => {
      const url = t.url || "";
      // Link video: youtube.com/watch?v=... hoặc youtu.be/... hoặc youtube.com/shorts/...
      return (
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=/i.test(url) ||
        /^(https?:\/\/)?(www\.)?youtu\.be\//i.test(url) ||
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//i.test(url)
      );
    });

    let youtubeUrls = "";
    if (youtubeTabs.length > 0) {
      youtubeUrls = youtubeTabs.map((t) => t.url).join("\n");
    } else {
      // Nếu không có tab YouTube nào, lấy tab hiện tại nếu là YouTube video
      const url = tab?.url || "";
      const isYouTubeVideo =
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=/i.test(url) ||
        /^(https?:\/\/)?(www\.)?youtu\.be\//i.test(url) ||
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//i.test(url);
      if (isYouTubeVideo) {
        youtubeUrls = url;
      }
    }


    if (!youtubeUrls) {
      console.log("Không tìm thấy link YouTube nào.");
      return;
    }

    const targetUrl = "http://localhost:3000/";
    const createdTab = await chrome.tabs.create({
      url: targetUrl,
      active: true,
    });

    const tabId = createdTab.id;
    const onUpdated = async (updatedTabId, info, updatedTab) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs
          .sendMessage(tabId, {
            type: "FILL_WP_BULK",
            youtubeUrls,
          })
          .then(() => {
            // Có thể đóng các tab YouTube gốc ở đây nếu muốn
            // Nhưng hiện tại giữ nguyên hoặc đóng tất cả youtubeTabs
            youtubeTabs.forEach((t) => {
              chrome.tabs.remove(t.id).catch(() => {});
            });
          })
          .catch((err) => {
            console.error("Error sending message:", err);
          });
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  } catch (e) {
    console.error("Push YouTube → Xopboo error:", e);
  }
});

