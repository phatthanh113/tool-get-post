// Store mapping of source tabs to their editor tabs
const tabMapping = new Map();

// Function to update loading badge
async function updateLoadingBadge(current, total) {
  if (total > 0) {
    await chrome.action.setBadgeText({
      text: `${current}/${total}`,
    });
    await chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
  }
}

// Function to clear loading badge
async function clearLoadingBadge() {
  await chrome.action.setBadgeText({ text: "" });
}

// Function to find existing table.html tab
async function findTableTab() {
  const tabs = await chrome.tabs.query({});
  const extensionId = chrome.runtime.id;
  return tabs.find((tab) =>
    tab.url.includes(`chrome-extension://${extensionId}/table.html`),
  );
}

// Function to focus and refresh existing table tab or create new one
async function openOrFocusTableTab() {
  const existingTab = await findTableTab();
  if (existingTab) {
    // Focus and refresh existing tab
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.tabs.reload(existingTab.id);
    return existingTab;
  } else {
    // Create new tab
    const extensionUrl = chrome.runtime.getURL("table.html");
    return await chrome.tabs.create({
      url: extensionUrl,
      active: true,
    });
  }
}

// Function to wait for tab to be ready
async function waitForTabReady(tabId) {
  return new Promise((resolve, reject) => {
    const maxWaitTime = 10000; // 10 seconds max
    const startTime = Date.now();

    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);

        // Check if tab is still valid
        if (!tab) {
          reject(new Error("Tab not found"));
          return;
        }

        // Check if URL is valid (not chrome://, chrome-extension://, etc.)
        if (!tab.url || !tab.url.startsWith("http")) {
          reject(new Error("Invalid tab URL"));
          return;
        }

        // Check if tab is loaded
        if (tab.status === "complete") {
          // Wait a bit more for DOM to be ready
          setTimeout(resolve, 500);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > maxWaitTime) {
          reject(new Error("Timeout waiting for tab to load"));
          return;
        }

        // Check again after a short delay
        setTimeout(checkTab, 200);
      } catch (error) {
        reject(error);
      }
    };

    checkTab();
  });
}

// Function to process a single tab and extract article data
async function processTab(tabId, tabUrl) {
  try {
    // Wait for tab to be ready
    await waitForTabReady(tabId);
    console.log(`Tab ${tabId} is ready, extracting data...`);

    // Execute the content script in the tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const cards = document.querySelectorAll(".result-card");
        if (cards.length > 0) {
          return Array.from(cards).map((card) => {
            const title =
              card.querySelector("input.flex-1.border")?.value || "";
            const description =
              card.querySelector("textarea.w-full.min-h-52")?.value || "";

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = description;

            const firstImage = tempDiv.querySelector("img");
            const imageUrl = firstImage ? firstImage.src : "";

            const firstIframe = tempDiv.querySelector("iframe");
            const iframeHtml = firstIframe ? firstIframe.outerHTML : "";
            const iframeSrc = firstIframe ? firstIframe.src : "";

            return {
              title,
              description,
              image: imageUrl,
              iframe: iframeHtml,
              videoUrl: iframeSrc,
              url: window.location.href,
            };
          });
        }

        const title =
          document.querySelector("input.flex-1.border")?.value || "";
        const description =
          document.querySelector("textarea.w-full.min-h-52")?.value || "";

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = description;
        const firstImage = tempDiv.querySelector("img");
        const imageUrl = firstImage ? firstImage.src : "";
        const firstIframe = tempDiv.querySelector("iframe");
        const iframeHtml = firstIframe ? firstIframe.outerHTML : "";
        const iframeSrc = firstIframe ? firstIframe.src : "";

        return [
          {
            title,
            description,
            image: imageUrl,
            iframe: iframeHtml,
            videoUrl: iframeHtml,
            url: window.location.href,
          },
        ];
      },
    });

    const articleResults = results[0].result || [];
    console.log("Extracted articleResults from background.js:", articleResults);

    if (!Array.isArray(articleResults) || articleResults.length === 0) {
      console.log(`Skipping tab ${tabId} - no articles found`);
      return { success: true, skipped: true, reason: "No articles" };
    }

    // Get existing articles from storage
    const storage = await chrome.storage.local.get("xopbooArticles");
    const articles = storage.xopbooArticles || [];

    const duplicateTitles = [];
    let addedCount = 0;

    for (const articleData of articleResults) {
      if (!articleData.title || articleData.title.trim() === "") {
        continue;
      }

      const existingArticle = articles.find(
        (article) => article.title === articleData.title,
      );

      if (!existingArticle) {
        articles.push({
          ...articleData,
          content: articleData.description,
          tabId: tabId,
        });
        addedCount += 1;
      } else {
        duplicateTitles.push(articleData.title);
      }
    }

    if (addedCount > 0) {
      await chrome.storage.local.set({ xopbooArticles: articles });
    }

    console.log(
      `Tab ${tabId} extracted ${articleResults.length} articles, added ${addedCount}, duplicates ${duplicateTitles.length}`,
    );

    return {
      success: true,
      addedCount,
      duplicates: duplicateTitles,
      totalFound: articleResults.length,
    };
  } catch (error) {
    console.error(`Error processing tab ${tabId} (${tabUrl}):`, error);
    return { success: false, error: error.message, tabUrl: tabUrl };
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  // Check if the URL matches localhost:3000
  if (tab.url.includes("localhost:3000")) {
    try {
      // Find all tabs with localhost:3000
      const allTabs = await chrome.tabs.query({});
      const xopbooTabs = allTabs.filter(
        (t) => t.url && t.url.includes("localhost:3000"),
      );

      console.log(`Found ${xopbooTabs.length} localhost:3000 tabs to process`);

      if (xopbooTabs.length === 0) {
        console.log("No localhost:3000 tabs found");
        await openOrFocusTableTab();
        return;
      }

      // Show loading badge
      await updateLoadingBadge(0, xopbooTabs.length);

      // Process each tab sequentially with 1 second delay between them
      const duplicateTitles = [];
      const errors = [];
      let successCount = 0;

      for (let i = 0; i < xopbooTabs.length; i++) {
        const xopbooTab = xopbooTabs[i];

        // Update loading badge
        await updateLoadingBadge(i, xopbooTabs.length);

        console.log(
          `Processing tab ${i + 1}/${xopbooTabs.length}: ${
            xopbooTab.url
          } (ID: ${xopbooTab.id})`,
        );

        const result = await processTab(xopbooTab.id, xopbooTab.url);

        if (result.success) {
          if (result.skipped) {
            console.log(`Tab ${i + 1} skipped: ${result.reason}`);
          } else {
            successCount += result.addedCount || 0;
            if (
              Array.isArray(result.duplicates) &&
              result.duplicates.length > 0
            ) {
              duplicateTitles.push(...result.duplicates);
            }
            console.log(
              `Tab ${i + 1} - Found ${result.totalFound || 0}, added ${result.addedCount || 0}, duplicates ${result.duplicates?.length || 0}`,
            );
          }
        } else {
          errors.push({ tab: xopbooTab.url, error: result.error });
          console.error(`Tab ${i + 1} - Error: ${result.error}`);
        }

        // Update loading badge after processing
        await updateLoadingBadge(i + 1, xopbooTabs.length);

        // Wait 1 second before processing next tab (except for the last one)
        if (i < xopbooTabs.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      console.log(
        `Processing complete: ${successCount} added, ${duplicateTitles.length} duplicates, ${errors.length} errors`,
      );

      // Clear loading badge
      await clearLoadingBadge();

      // Open or focus table view after processing all tabs
      const tableTab = await openOrFocusTableTab();

      // Send duplicate warnings if any
      if (duplicateTitles.length > 0) {
        setTimeout(() => {
          duplicateTitles.forEach((title) => {
            chrome.tabs.sendMessage(tableTab.id, {
              action: "showDuplicateWarning",
              title: title,
            });
          });
        }, 1000); // Wait for table.html to load
      }
    } catch (error) {
      console.error("Error in extension execution:", error);
      // Clear loading badge on error
      await clearLoadingBadge();
    }
  } else {
    // If not on xopboo.com, open or focus table view
    await openOrFocusTableTab();
  }
});

// Listen for messages from table.js
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "openEditor") {
    const articleIndex = message.articleIndex;

    try {
      // Open editor tab
      const editorTab = await chrome.tabs.create({
        url: `editor.html?articleIndex=${articleIndex}`,
        active: true,
      });

      // Store the mapping
      const storage = await chrome.storage.local.get("xopbooArticles");
      const articles = storage.xopbooArticles || [];
      const article = articles[articleIndex];

      if (article && article.tabId) {
        tabMapping.set(article.tabId, editorTab.id);
      }
    } catch (error) {
      console.error("Error opening editor:", error);
    }
  }

  if (message.type === "SAVE_ARTICLES") {
    try {
      console.log(
        "Received SAVE_ARTICLES message with articles:",
        message.articles.length,
        message.articles,
      );
      // Get existing articles from storage
      const storage = await chrome.storage.local.get("xopbooArticles");
      const existingArticles = storage.xopbooArticles || [];

      // Add new articles, check for duplicates by title
      const duplicateTitles = [];
      for (const article of message.articles) {
        const exists = existingArticles.find((a) => a.title === article.title);
        if (!exists) {
          existingArticles.push({
            ...article,
            videoUrl: article.videoUrl || message.videoUrl || "",
            content: article.description,
          });
        } else {
          duplicateTitles.push(article.title);
        }
      }

      // Save updated articles list
      await chrome.storage.local.set({ xopbooArticles: existingArticles });
      console.log(
        `Added ${message.articles.length - duplicateTitles.length} articles, ${duplicateTitles.length} duplicates`,
      );

      // Open or focus table view
      const tableTab = await openOrFocusTableTab();

      // Send duplicate warnings if any
      if (duplicateTitles.length > 0) {
        setTimeout(() => {
          duplicateTitles.forEach((title) => {
            chrome.tabs.sendMessage(tableTab.id, {
              action: "showDuplicateWarning",
              title: title,
            });
          });
        }, 1000); // Wait for table.html to load
      }
    } catch (error) {
      console.error("Error saving articles:", error);
    }
  }

  if (message.type === "UPDATE_CONTENT") {
    try {
      await chrome.storage.local.set({
        linastoryPendingPayload: {
          title: message.content.title || "",
          description: message.content.description || "",
          videoUrl: message.content.videoUrl || "",
          autoPublish: message.content.autoPublish !== false,
          createdAt: Date.now(),
        },
      });

      // Never activate or refocus a Linastory tab from the background workflow.
      const hanoiphoTab = await chrome.tabs.create({
        url: "https://linatoysdochoitreem.com/wp-admin/post-new.php",
        active: false,
      });

      // Wait for the page only when it is still loading; avoid waiting forever after the event was missed.
      let linastoryTabState = await chrome.tabs.get(hanoiphoTab.id);
      if (linastoryTabState.status !== "complete") {
        await new Promise((resolve) => {
          const timeoutId = setTimeout(resolve, 15000);
          const listener = function (tabId, info) {
            if (tabId === hanoiphoTab.id && info.status === "complete") {
              clearTimeout(timeoutId);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const payload = message.content || {};
      let sent = false;
      let retries = 0;
      const maxRetries = 5;

      while (!sent && retries < maxRetries) {
        try {
          await chrome.tabs.sendMessage(hanoiphoTab.id, {
            title: payload.title || "",
            description: payload.description || "",
            videoUrl: payload.videoUrl || "",
            autoPublish: payload.autoPublish !== false,
          });
          sent = true;
          console.log("Message sent successfully to Linastory content-fill.js");
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            console.error("Failed to send UPDATE_CONTENT to content-fill.js:", error);
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      await chrome.storage.local.set({
        linastoryLastFillResult: { success: sent, title: payload.title || "" },
      });

    } catch (error) {
      console.error("Error in message handler:", error);
    }
  }
  return true;
});

// Listen for tab close events
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up the mapping when either a source tab or editor tab is closed
  for (const [sourceId, editorId] of tabMapping.entries()) {
    if (tabId === sourceId || tabId === editorId) {
      tabMapping.delete(sourceId);
    }
  }
});
