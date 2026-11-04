function fillLinastoryPayload(message) {
  console.log("Received message in content-fill.js:", message);
  const { title, description, videoUrl, autoPublish = true } = message;

  const fillArticle = () => {
    const titleInput =
      document.querySelector("input#title") ||
      document.querySelector("input#post-title-0") ||
      document.querySelector("textarea#post-title-0") ||
      document.querySelector("[name='post_title']") ||
      document.querySelector(".editor-post-title__input") ||
      document.querySelector("input[name='post_title']");

    // Try multiple selectors for the description textarea
    let descTextarea =
      document.querySelector("textarea#content") ||
      document.querySelector("textarea.wp-editor-area") ||
      document.querySelector("textarea[name='content']") ||
      document.querySelector("[data-empty-text=''] textarea") ||
      document.querySelector("textarea.editor-post-text__input");

  // If still not found, try looking in iframes
  if (!descTextarea) {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;
        descTextarea =
          iframeDoc.querySelector("textarea#content") ||
          iframeDoc.querySelector("textarea.wp-editor-area") ||
          iframeDoc.querySelector("textarea[name='content']");
        if (descTextarea) break;
      } catch (e) {
        console.log("Could not access iframe:", e);
      }
    }
  }

  // If textarea is hidden, try to find the visual editor
  if (!descTextarea || descTextarea.style.display === "none") {
    const visualEditor = document.querySelector("#content_ifr");
    if (visualEditor) {
      try {
        const editorDoc =
          visualEditor.contentDocument || visualEditor.contentWindow.document;
        const editorBody = editorDoc.body;
        if (editorBody) {
          // Create a custom textarea element
          descTextarea = {
            value: "",
            dispatchEvent: function (event) {
              editorBody.innerHTML = this.value;
              editorBody.dispatchEvent(event);
            },
          };
        }
      } catch (e) {
        console.log("Could not access visual editor:", e);
      }
    }
  }

    if (titleInput && descTextarea) {
      // Get text content for title and description
    // Array of attention-grabbing icons
    const attentionIcons = [
      "⭐",
      "🔥",
      "💥",
      "⚡",
      "✨",
      "💫",
      "🌟",
      "💎",
      "🎯",
      "🎨",
      "🎭",
      "🎪",
      "🎢",
      "🎡",
      "🎠",
      "🎬",
      "📢",
      "🔊",
      "📣",
      "🎵",
      "🎶",
    ];

    // Function to get random icons
    const getRandomIcons = (count) => {
      const icons = [];
      for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * attentionIcons.length);
        icons.push(attentionIcons[randomIndex]);
      }
      return icons.join("");
    };

    // Helper: check if the title already starts with an attention icon
    const startsWithAttentionIcon = (text) => {
      const trimmed = (text || "").trimStart();
      return attentionIcons.some((icon) => trimmed.startsWith(icon));
    };

    // Add random icons; only prepend at start if not already present
    const startIcons = getRandomIcons(2);
    const endIcons = getRandomIcons(2);
    const rawTitle = title || "";
    const hasLeadingIcon = startsWithAttentionIcon(rawTitle);
    const titleText = rawTitle + " #TP";
    const descriptionText = description || "";

    // Use direct assignments on real WordPress form fields to avoid Illegal invocation.
    titleInput.value = titleText;

    if (descTextarea instanceof HTMLTextAreaElement) {
      descTextarea.value = descriptionText;
      descTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      descTextarea.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (descTextarea?.dispatchEvent) {
      descTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      descTextarea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Trigger native, Classic, and Gutenberg change events
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    // Synchronize TinyMCE if it is active
    if (window.tinyMCE?.get && window.tinyMCE.get("content")) {
      window.tinyMCE.get("content").setContent(descriptionText);
    }

    const visualEditor = document.querySelector("#content_ifr");
    if (visualEditor?.contentDocument?.body) {
      visualEditor.contentDocument.body.innerHTML = descriptionText;
    }

      // Set date fields
      const mm = document.getElementById("mm");
      const jj = document.getElementById("jj");
      const aa = document.getElementById("aa");
      const hh = document.getElementById("hh");
      const mn = document.getElementById("mn");

      const currentDate = new Date();
      const currentDay = currentDate.getDate();

      if (mm) mm.value = "06";
      if (jj)
        jj.value = currentDay === 31 ? "28" : String(currentDay).padStart(2, "0");
      if (aa) aa.value = "2024";
      if (hh) hh.value = "09";
      if (mn) mn.value = "00";

      // Auto Publish is controlled by the web button and defaults to enabled.
      if (autoPublish !== false) {
        setTimeout(() => {
          const publishButton = document.getElementById("publish") ||
            document.querySelector('input[type="submit"][name="publish"][id="publish"]');
          if (!publishButton) {
            console.log("Publish button not found");
            return;
          }

          publishButton.removeAttribute("disabled");
          publishButton.click();
          console.log("Auto-clicked Publish button");
        }, 5000);
      } else {
        console.log("Auto Publish disabled by user");
      }
      return true;
    }

    return false;
  };

  const filled = fillArticle();
  if (!filled) {
    let attempts = 0;
    const retry = setInterval(() => {
      attempts++;
      if (fillArticle() || attempts >= 20) clearInterval(retry);
    }, 500);
  }
  return filled;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const filled = fillLinastoryPayload(message);
  sendResponse({ success: Boolean(filled) });
  return false;
});
