window.addEventListener("tool-get-post:fill-linastory", (event) => {
  const payload = event.detail || {};
  const reportStatus = (success, error = "") => {
    window.dispatchEvent(new CustomEvent("tool-get-post:linastory-status", {
      detail: { success, error },
    }));
  };

  try {
    if (!chrome?.runtime?.id) {
      reportStatus(false, "Extension context unavailable");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "UPDATE_CONTENT",
        sourceTabId: null,
        content: {
          title: payload.title || "",
          description: payload.description || "",
          image: payload.image || "",
          videoUrl: payload.videoUrl || "",
          autoPublish: payload.autoPublish !== false,
        },
      },
      () => {
        const lastError = chrome.runtime?.lastError?.message || "";
        reportStatus(!lastError, lastError);
      },
    );
  } catch (error) {
    reportStatus(false, error?.message || "Extension context invalidated");
  }
});
