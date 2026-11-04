function getContent(tab) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      // Wait for dynamic content to load
      setTimeout(() => {
        const cards = document.querySelectorAll(".result-card");
        console.log("Found .result-card elements:", cards.length);
        const articles = Array.from(cards).map((card, index) => {
          console.log(`Processing card ${index}:`, card.id);
          const title = card.querySelector("input.flex-1.border")?.value || "";
          const description =
            card.querySelector("textarea.w-full.min-h-52")?.value || "";

          console.log(`Card ${index} title:`, title);

          // Create a temporary div to parse HTML content
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = description;

          // Extract first image if exists
          const firstImage = tempDiv.querySelector("img");
          const imageUrl = firstImage ? firstImage.src : "";

          // Extract first iframe if exists
          const firstIframe = tempDiv.querySelector("iframe");
          const iframeHtml = firstIframe ? firstIframe.outerHTML : "";
          const iframeSrc = firstIframe ? firstIframe.src : "";

          return {
            title,
            description,
            image: imageUrl,
            iframe: iframeHtml,
            videoUrl: iframeHtml,
          };
        });

        console.log("Extracted articles:", articles.length, articles);

        const videoUrlInput = document.querySelector(
          'input[placeholder*="Nhập URL video TikTok"], input[placeholder*="URL video"], input[placeholder*="TikTok"], input[type="url"]',
        );
        let videoUrl = videoUrlInput ? videoUrlInput.value : "";
        if (!videoUrl) {
          videoUrl =
            articles.find((article) => article.videoUrl)?.videoUrl || "";
        }
        console.log(
          "Extracted videoUrl:",
          videoUrl,
          "Input found:",
          !!videoUrlInput,
        );

        // Send from inside the page context
        chrome.runtime.sendMessage({
          type: "SAVE_ARTICLES",
          articles,
          videoUrl,
        });
      }, 2000); // Wait 2 seconds for dynamic content
    },
  });
}

// Export the function
window.getContent = getContent;
