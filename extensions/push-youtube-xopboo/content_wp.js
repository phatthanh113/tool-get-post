(function () {
  function fire(el, type) {
    if (!el) return;
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function findUrlInput() {
    let el = document.querySelector(
      'input[type="text"][placeholder*="URL"][placeholder*="YouTube" i]',
    );
    if (el) return el;
    el = document.querySelector('input[type="text"][placeholder^="Nhập URL"]');
    if (el) return el;
    el = document.querySelector('input[type="text"].w-full');
    if (el) return el;
    return document.querySelector('input[type="text"]');
  }

  function setToken5000() {
    const tokenSel = document.querySelector("#token-select");
    if (!tokenSel) return false;
    tokenSel.value = "5000";
    fire(tokenSel, "change");
    return tokenSel.value === "5000";
  }

  function setLanguageEnglish() {
    const selects = Array.from(document.querySelectorAll("select")).filter(
      (s) => s.id !== "token-select",
    );
    for (const s of selects) {
      const hasEnglish = Array.from(s.options).some(
        (opt) =>
          (opt.value || "").toLowerCase() === "english" ||
          (opt.text || "").toLowerCase() === "english",
      );
      if (hasEnglish) {
        s.value = "English";
        fire(s, "change");
        if (s.value !== "English") {
          const englishOpt = Array.from(s.options).find(
            (opt) => (opt.text || "").toLowerCase() === "english",
          );
          if (englishOpt) {
            englishOpt.selected = true;
            fire(s, "change");
          }
        }
        return true;
      }
    }
    return false;
  }

  function setWritingStyle() {
    const selects = Array.from(document.querySelectorAll("select")).filter(
      (s) => s.id !== "token-select",
    );
    for (const s of selects) {
      const hasTableid = Array.from(s.options).some(
        (opt) => (opt.value || "") === "tabloidStyle",
      );
      if (hasTableid) {
        s.value = "tabloidStyle";
        fire(s, "change");
        return true;
      }
    }
    return false;
  }

  function setAIModel() {
    const selects = Array.from(document.querySelectorAll("select")).filter(
      (s) => s.id !== "token-select",
    );
    for (const s of selects) {
      const hasDeepseek = Array.from(s.options).some(
        (opt) => (opt.value || "") === "deepseek-chat",
      );
      if (hasDeepseek) {
        s.value = "deepseek-chat";
        fire(s, "change");
        return true;
      }
    }
    return false;
  }

  function clickTextModeAndBuzz() {
    // 1) Click "Chế độ text"
    const textBtn = Array.from(
      document.querySelectorAll("button.bg-green-600"),
    ).find((btn) =>
      btn.textContent.trim().toLowerCase().includes("chế độ text"),
    );
    if (textBtn) {
      textBtn.click();
      console.log("✅ Clicked 'Chế độ text' → visual mode");
    }

    // 2) Do not auto-click the Buzz button anymore.
    setTimeout(() => {
      const buzzBtn = Array.from(document.querySelectorAll("button")).find(
        (btn) =>
          btn.classList.contains("button-primary-custom") &&
          btn.textContent.trim().toLowerCase() === "buzz",
      );
      if (buzzBtn) {
        console.log("ℹ️ Found 'Buzz' button; auto-click disabled");
      } else {
        console.warn("⚠️ Không tìm thấy nút Buzz");
      }
    }, 800);
  }

  function uncheckCheckbox() {
    const cb = document.querySelector('input[type="checkbox"]#_r_0_');
    if (cb && cb.checked) {
      cb.checked = false;
      fire(cb, "change");
      fire(cb, "click");
      return true;
    }
    return false;
  }

  function fillAll(youtubeUrl) {
    let okUrl = false,
      okTok = false,
      okLang = false,
      okWriting = false,
      okAI = false;

    const input = findUrlInput();
    if (input) {
      input.value = youtubeUrl;
      fire(input, "input");
      fire(input, "change");
      okUrl = true;
    }

    okTok = setToken5000();
    okLang = setLanguageEnglish();
    okWriting = setWritingStyle();
    okAI = setAIModel();
    uncheckCheckbox();

    if (okUrl && okTok && okLang && okWriting && okAI) {
      console.log("✅ Filled all fields, triggering text & buzz");
      setTimeout(clickTextModeAndBuzz, 1000);
    }

    return okUrl && okTok && okLang;
  }

  function fillBulk(youtubeUrls) {
    let okUrl = false,
      okTok = false,
      okLang = false,
      okWriting = false,
      okAI = false;

    // 1) Điền vào textarea#youtubeUrl
    const textarea = document.querySelector("textarea#youtubeUrl");
    if (textarea) {
      textarea.value = youtubeUrls;
      fire(textarea, "input");
      fire(textarea, "change");
      okUrl = true;
    } else {
      // Fallback nếu không tìm thấy ID, thử tìm theo placeholder hoặc class
      const input = findUrlInput();
      if (input) {
        input.value = youtubeUrls;
        fire(input, "input");
        fire(input, "change");
        okUrl = true;
      }
    }

    okTok = setToken5000();
    okLang = setLanguageEnglish();
    okWriting = setWritingStyle();
    okAI = setAIModel();
    uncheckCheckbox();

    if (okUrl) {
      console.log("✅ Filled URLs; Buzz auto-click is disabled");
      setTimeout(() => {
        const buzzBtn = document.querySelector("#buzz");
        if (buzzBtn) {
          console.log("ℹ️ Found #buzz; auto-click disabled");
        } else {
          const fallbackBuzz = Array.from(document.querySelectorAll("button")).find(
            (btn) =>
              btn.textContent.trim().toLowerCase() === "buzz" ||
              btn.classList.contains("button-primary-custom")
          );
          if (fallbackBuzz) {
            console.log("ℹ️ Found fallback Buzz button; auto-click disabled");
          } else {
            console.warn("⚠️ Không tìm thấy nút Buzz");
          }
        }
      }, 1000);
    }

    return okUrl && okTok && okLang;
  }

  function smartFillBulk(youtubeUrls) {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const done = fillBulk(youtubeUrls);
      const expired = Date.now() - startedAt > 10000;
      if (done || expired) clearInterval(timer);
    }, 300);
  }

  let lastRequestedUrl = null;
  function smartFill(youtubeUrl) {
    lastRequestedUrl = youtubeUrl;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const done = fillAll(youtubeUrl);
      const expired = Date.now() - startedAt > 10000;
      if (done || expired) clearInterval(timer);
    }, 300);
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const preVideo = params.get("video");
    if (preVideo) smartFill(decodeURIComponent(preVideo));
  } catch {}

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "FILL_WP_BULK" && msg.youtubeUrls) {
      smartFillBulk(msg.youtubeUrls);
    } else if (msg.type === "FILL_WP" && msg.youtubeUrl) {
      if (lastRequestedUrl === msg.youtubeUrl) return;
      smartFill(msg.youtubeUrl);
    }
  });

})();

