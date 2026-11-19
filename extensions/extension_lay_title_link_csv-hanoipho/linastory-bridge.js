(() => {
  const DEFAULT_TITLE_HASHTAG = "#TP";
  let titleHashtag = DEFAULT_TITLE_HASHTAG;

  function loadTitleHashtag() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    return fetch("http://localhost:3000/config", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (config && config.title_hashtag) {
          titleHashtag = config.title_hashtag;
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const titleHashtagReady = loadTitleHashtag();

  const normalizeTitle = (title) => {
    const pattern = new RegExp(`\\s*${escapeRegExp(titleHashtag)}\\s*$`, "i");
    return String(title || "")
      .normalize("NFKC")
      .replace(pattern, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.channel !== "tool-get-post:linastory-bridge") return;

    if (event.data.action === "close-tabs") {
      const requestId = event.data.requestId;
      if (typeof requestId !== "string") return;
      chrome.runtime.sendMessage({ action: "closeLinastoryTabs" }, (response) => {
        window.postMessage({
          channel: "tool-get-post:linastory-bridge",
          action: "close-response",
          requestId,
          closedCount: response?.closedCount || 0,
          error: chrome.runtime.lastError?.message || response?.error || "",
        }, window.location.origin);
      });
      return;
    }

    if (event.data.action !== "request") return;

    const requestId = event.data.requestId;
    const requestedTitles = event.data.titles;
    if (typeof requestId !== "string" || !Array.isArray(requestedTitles)) return;

    await titleHashtagReady;
    const titleSet = new Set(requestedTitles.map(normalizeTitle).filter(Boolean));
    const respond = (response) => {
      window.postMessage({
        channel: "tool-get-post:linastory-bridge",
        action: "response",
        requestId,
        ...response,
      }, window.location.origin);
    };

    chrome.storage.local.get("tableRows", (result) => {
      const storageError = chrome.runtime.lastError;
      if (storageError) {
        respond({
          success: false,
          error: storageError.message || "Không thể đọc dữ liệu lưu trong extension.",
        });
        return;
      }

      const rows = Array.isArray(result.tableRows) ? result.tableRows : [];
      const matchedRows = rows
        .filter((row) => titleSet.has(normalizeTitle(row.title)))
        .map((row) => ({
          title: String(row.title || ""),
          link: String(row.link || ""),
          shortlink: String(row.shortlink || ""),
        }));

      respond({ success: true, rows: matchedRows });
    });
  });
})();
