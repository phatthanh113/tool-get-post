document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#dataTable tbody");
  const copyTitlesBtn = document.getElementById("copyTitles");
  const copyLinksBtn = document.getElementById("copyLinks");
  const copyShortlinksBtn = document.getElementById("copyShortlinks");
  const copyNumbersBtn = document.getElementById("copyNumbers");
  const copySummariesBtn = document.getElementById("copySummaries");
  const copyDataDescBtn = document.getElementById("copyDataDesc");
  const topicPicker = document.getElementById("topicPicker");

  // Định nghĩa mapping giữa chủ đề và màu sắc
  const topicColors = {
    topic1: "#FFB6C1", // Light Pink - Màu hồng nhạt nổi bật
    topic2: "#98FB98", // Mint Green - Màu xanh bạc hà tươi mát
    topic3: "#87CEEB", // Sky Blue - Màu xanh da trời sáng
    topic4: "#DDA0DD", // Plum - Màu tím nhạt dịu mắt
    topic5: "#F4A460", // Sandy Brown - Màu nâu cam ấm áp
  };
  // Lưu và lấy copyMode từ chrome.storage
  let copyMode = document.getElementById("copyMode");
  const deleteBtn = document.getElementById("deleteBtn");
  const restoreBtn = document.getElementById("restoreBtn"); // Thêm nút restore

  // Khởi tạo backupRows
  let backupRows = [];

  // Lấy giá trị copyMode và backupRows từ storage khi load
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  chrome.storage.local.get(
    ["copyMode", "backupRows", "backupRowsSavedAt", "tableRows"],
    (result) => {
      if (result.copyMode && copyMode) {
        copyMode.value = result.copyMode;
        updateDeleteBtnLabel();
      }
      if (result.backupRows) {
        backupRows = result.backupRows;
        const savedAt = result.backupRowsSavedAt || 0;
        if (backupRows.length > 0 && Date.now() - savedAt > ONE_DAY_MS) {
          // Backup cũ hơn 1 ngày → xóa
          chrome.storage.local.remove(
            ["backupRows", "backupRowsSavedAt"],
            () => {
              utils.showToast("Backup cũ hơn 1 ngày đã được xóa!", "info");
            }
          );
          backupRows = [];
        }
        // Hiển thị nút restore nếu có backup
        if (restoreBtn) {
          restoreBtn.style.display =
            backupRows.length > 0 ? "inline-block" : "none";
        }
      }
      // Khởi tạo rows từ tableRows
      rows = result.tableRows || [];
      renderTable();
    }
  );

  copyMode.addEventListener("change", () => {
    chrome.storage.local.set({ copyMode: copyMode.value });
    updateDeleteBtnLabel();
  });

  function updateDeleteBtnLabel() {
    if (copyMode.value === "selected") {
      deleteBtn.innerHTML = "🗑️ Xoá các dòng đã chọn";
    } else {
      deleteBtn.innerHTML = "🧹 Xoá tất cả";
    }
  }

  let rows = [];

  // Consolidated storage operations
  const storage = {
    get: (key, callback) => chrome.storage.local.get(key, callback),
    set: (data, callback) => chrome.storage.local.set(data, callback),
    remove: (key, callback) => chrome.storage.local.remove(key, callback),
  };
  // Function to get icon based on type
  function getToastIcon(type) {
    switch (type) {
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      default:
        return "ℹ️";
    }
  }
  // Consolidated utility functions
  const utils = {
    copyToClipboard: (text) => {
      navigator.clipboard
        .writeText(text)
        .catch((err) => console.error("Lỗi sao chép clipboard:", err));
    },

    // Tạo link chỉnh sửa từ link bài viết
    buildEditLink: (postLink) => {
      try {
        if (!postLink) return "";
        const url = new URL(postLink);
        const match =
          postLink.match(/\/(\d+)\/?$/) || postLink.match(/\/(\d+)\//);
        const postId = match ? match[1] : null;
        if (!postId) return "";
        return `${url.origin}/wp-admin/post.php?post=${postId}&action=edit`;
      } catch {
        return "";
      }
    },

    // Suy luận link YouTube từ thumbnail YouTube (nếu có)
    buildYoutubeLinkFromThumb: (thumbnail) => {
      if (!thumbnail) return "";
      try {
        // Dạng phổ biến: https://img.youtube.com/vi/<VIDEO_ID>/hqdefault.jpg
        const m = thumbnail.match(/img\.youtube\.com\/vi\/([^/]+)\//);
        if (m && m[1]) {
          return `https://www.youtube.com/watch?v=${m[1]}`;
        }
        // Nếu thumbnail đã là link youtube, trả về trực tiếp
        if (/youtube\.com|youtu\.be/.test(thumbnail)) return thumbnail;
        return "";
      } catch {
        return "";
      }
    },

    // Lấy link YouTube từ trang bài viết (tìm iframe YouTube)
    fetchYoutubeFromPage: async (postLink) => {
      if (!postLink) return "";
      try {
        const res = await fetch(postLink, {
          credentials: "omit",
          cache: "no-store",
        });
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const iframes = Array.from(doc.querySelectorAll("iframe"));
        const yt = iframes.find((f) => {
          const src = f.getAttribute("src") || "";
          return /youtube\.com|youtu\.be|youtube-nocookie\.com/.test(src);
        });
        if (!yt) return "";
        const src = yt.getAttribute("src") || "";
        // Chuẩn hoá sang watch?v=ID
        // Các dạng có thể: https://www.youtube.com/embed/ID, https://youtube-nocookie.com/embed/ID, https://www.youtube.com/watch?v=ID, https://youtu.be/ID
        let videoId = "";
        let m;
        if ((m = src.match(/\/embed\/([a-zA-Z0-9_-]{5,})/))) {
          videoId = m[1];
        } else if ((m = src.match(/[?&]v=([a-zA-Z0-9_-]{5,})/))) {
          videoId = m[1];
        } else if ((m = src.match(/youtu\.be\/([a-zA-Z0-9_-]{5,})/))) {
          videoId = m[1];
        }
        if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
        return src; // fallback: trả về src thô
      } catch (e) {
        console.warn("fetchYoutubeFromPage error:", e);
        return "";
      }
    },

    showToast: (message, type = "info", duration = 3000) => {
      // Cho phép truyền duration tuỳ ý, mặc định là 3000
      const toast = document.getElementById("toast");
      toast.className = "toast";
      if (type) toast.classList.add(type);
      toast.innerHTML = `
        <div class="toast-content">
          <div class="toast-icon">${getToastIcon(type)}</div>
          <div class="toast-message">${message}</div>
        </div>
      `;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, duration);
    },

    createButton: (text, style, onClick) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      Object.assign(btn.style, {
        border: "none",
        borderRadius: "4px",
        padding: "5px 10px",
        cursor: "pointer",
        marginRight: "10px",
        ...style,
      });
      btn.addEventListener("click", onClick);
      return btn;
    },

    createImageModal: (thumbnail) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center;
        align-items: center; z-index: 1000; cursor: pointer;
      `;

      const modalImg = document.createElement("img");
      modalImg.src = thumbnail;
      modalImg.style.cssText =
        "max-width: 90%; max-height: 90%; object-fit: contain;";

      modal.appendChild(modalImg);
      modal.addEventListener("click", () => modal.remove());
      document.body.appendChild(modal);
    },

    getRowIndex: (currentRow) =>
      Array.from(tbody.children).indexOf(currentRow) + 1,

    formatDate: () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return { month, day };
    },
  };

  // Consolidated button creation functions
  const buttonCreators = {
    quickCreate: (
      thumbnail,
      contributors,
      currentRow,
      rowIndex,
      title,
      youtubeLink,
      players,
      team
    ) => {
      if (!thumbnail) return null;

      return utils.createButton(
        "⚡ Nhanh",
        { backgroundColor: "#4CAF50", color: "white" },
        () => {
          const contributorsParam = contributors
            ? encodeURIComponent(contributors)
            : "";
          const stt = utils.getRowIndex(currentRow);
          const titleParam = title ? encodeURIComponent(title) : "";
          const youtubeLinkParam = youtubeLink
            ? encodeURIComponent(youtubeLink)
            : "";
          const playersParam = players ? encodeURIComponent(players) : "";
          const teamParam = team ? encodeURIComponent(team) : "";

          const getImgBgUrl =
            chrome.runtime.getURL("get_img_bg.html") +
            `?overlay=${encodeURIComponent(
              thumbnail
            )}&contributors=${contributorsParam}&stt=${stt}&title=${titleParam}&youtubeLink=${youtubeLinkParam}&players=${playersParam}&team=${teamParam}`;

          // Tìm và đóng tab get_img_bg.html đang mở (nếu có)
          chrome.tabs.query({}, (tabs) => {
            const getImgBgTabs = tabs.filter((tab) =>
              tab.url.includes("get_img_bg.html")
            );
            if (getImgBgTabs.length > 0) {
              // Đóng tất cả các tab get_img_bg.html đang mở
              getImgBgTabs.forEach((tab) => {
                chrome.tabs.remove(tab.id);
              });
            }
            // Mở tab mới
            chrome.tabs.create({ url: getImgBgUrl });
          });

          // Auto check
          rows[rowIndex].checked = true;
          storage.set({ tableRows: rows });
          const checkbox = currentRow.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.checked = true;
        }
      );
    },

    createImage: (
      title,
      link,
      thumbnail,
      contributors,
      rowIndex,
      currentRow
    ) => {
      return utils.createButton("🎨", {}, () => {
        const firstWord =
          contributors?.split(",")[0].trim() || title.split(" ")[0];
        const imagesHtml = thumbnail
          ? `
          <div class="existing-image-item">
            <p><strong>Ảnh hiện tại của: ${title}</strong></p>
            <img src="${thumbnail}" style="max-width: 300px; height: auto; margin: 10px 0;">
            <p><a href="${link}" target="_blank">🔗 Xem bài viết gốc</a></p>
          </div>
        `
          : "";

        const currentContributors = contributors
          ? contributors
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c)
          : [title.split(" ")[0]];

        storage.set(
          {
            imagesHtmlData: imagesHtml,
            rowData: {
              title,
              link,
              contributors: currentContributors,
              selectedContributor: firstWord,
            },
          },
          () => {
            const createImgUrl =
              chrome.runtime.getURL("create_img.html") +
              "?search=" +
              encodeURIComponent(firstWord) +
              "&showImages=true";
            chrome.tabs.create({ url: createImgUrl });

            // Auto check
            rows[rowIndex].checked = true;
            storage.set({ tableRows: rows });
            const checkbox = currentRow.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
          }
        );
      });
    },

    delete: (title, link, tr) => {
      return utils.createButton("🗑️ Xoá", {}, () => {
        tr.remove();
        rows = rows.filter(
          (item) => !(item.title === title && item.link === link)
        );
        storage.set({ tableRows: rows }, () =>
          utils.showToast("Đã xoá dòng!", "success")
        );
      });
    },
  };

  // Consolidated table cell creators
  const cellCreators = {
    number: (index) => {
      const td = document.createElement("td");
      td.textContent = index + 1;
      return td;
    },

    title: (title) => {
      const td = document.createElement("td");
      td.textContent = title;
      // Giới hạn chiều rộng và hiển thị dấu ...
      td.style.maxWidth = "280px";
      td.style.whiteSpace = "nowrap";
      td.style.overflow = "hidden";
      td.style.textOverflow = "ellipsis";
      // Tooltip hiển thị full tiêu đề khi hover
      td.title = title;
      return td;
    },

    summary: (summary) => {
      const td = document.createElement("td");
      td.textContent = summary;
      td.style.maxWidth = "300px"; // Giới hạn chiều rộng
      td.style.whiteSpace = "nowrap";
      td.style.overflow = "hidden";
      td.style.textOverflow = "ellipsis";
      // Thêm tooltip khi hover
      td.title = summary;
      return td;
    },

    link: (link) => {
      const td = document.createElement("td");
      const a = document.createElement("a");
      a.href = link;
      a.textContent = link;
      a.target = "_blank";
      td.appendChild(a);
      return td;
    },

    shortlink: (shortlink) => {
      const td = document.createElement("td");
      td.className = "col-shortlink";
      td.style.display = "none";
      if (shortlink) {
        const a = document.createElement("a");
        a.href = shortlink;
        a.textContent = shortlink;
        a.target = "_blank";
        td.appendChild(a);
      } else {
        td.textContent = "-";
      }
      return td;
    },

    image: (thumbnail) => {
      const td = document.createElement("td");
      if (thumbnail) {
        const img = document.createElement("img");
        img.src = thumbnail;
        Object.assign(img.style, {
          maxWidth: "100px",
          height: "auto",
          cursor: "pointer",
        });
        img.addEventListener("click", () => utils.createImageModal(thumbnail));
        td.appendChild(img);
      } else {
        td.textContent = "Không có ảnh";
      }
      return td;
    },

    contributors: (contributors) => {
      const td = document.createElement("td");
      td.textContent = contributors || "Không có";
      return td;
    },
    actions: (rowData, tr, index) => {
      const { title, link, thumbnail, contributors, youtubeLink, players, team } = rowData;
      const td = document.createElement("td");

      const quickCreateBtn = buttonCreators.quickCreate(
        thumbnail,
        contributors,
        tr,
        index,
        title,
        youtubeLink,
        players,
        team
      );
      const createImgBtn = buttonCreators.createImage(
        title,
        link,
        thumbnail,
        contributors,
        index,
        tr
      );
      const deleteBtn = buttonCreators.delete(title, link, tr);

      if (quickCreateBtn) td.appendChild(quickCreateBtn);
      td.appendChild(createImgBtn);
      td.appendChild(deleteBtn);

      return td;
    },
    checked: (rowData, index) => {
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.style.transform = "scale(1.2)";
      checkbox.style.cursor = "pointer";
      checkbox.checked = rowData.checked || false;

      checkbox.addEventListener("change", () => {
        rows[index].checked = checkbox.checked;
        storage.set({ tableRows: rows });
      });

      td.appendChild(checkbox);
      return td;
    },

    editLink: (link) => {
      const td = document.createElement("td");
      td.className = "col-edit-link";
      const editUrl = utils.buildEditLink(link);
      td.innerHTML = editUrl
        ? `<a href="${editUrl}" target="_blank">${editUrl}</a>`
        : "";
      return td;
    },

    youtubeLink: (rowData, index) => {
      const td = document.createElement("td");
      td.className = "col-youtube-link";

      const setVal = (url) => {
        td.innerHTML = url ? `<a href="${url}" target="_blank">${url}</a>` : "";
      };

      // 1) Nếu đã có cache youtubeLink trong row -> dùng luôn
      if (rowData.youtubeLink) {
        setVal(rowData.youtubeLink);
        return td;
      }

      // 2) Nếu có thể suy luận từ thumbnail (trường hợp dữ liệu cũ) -> dùng tạm, đồng thời fetch để cập nhật chuẩn từ iframe
      const thumbGuess = utils.buildYoutubeLinkFromThumb(rowData.thumbnail);
      if (thumbGuess) setVal(thumbGuess);

      // 3) Lấy chính xác từ iframe của trang
      utils
        .fetchYoutubeFromPage(rowData.link)
        .then((url) => {
          if (url && url !== rowData.youtubeLink) {
            rows[index].youtubeLink = url;
            storage.set({ tableRows: rows });
            setVal(url);
          } else if (!thumbGuess) {
            setVal(url);
          }
        })
        .catch(() => {
          if (!thumbGuess) setVal("");
        });
      return td;
    },
  };

  // State hiển thị cột
  const showEditLinkCheckbox = document.getElementById("showEditLinkCol");
  const showYoutubeLinkCheckbox = document.getElementById("showYoutubeLinkCol");
  let showEditCol = false;
  let showYoutubeCol = false;

  function applyColumnVisibility() {
    const editHeader = document.querySelector("th.col-edit-link");
    const youtubeHeader = document.querySelector("th.col-youtube-link");
    const editCells = document.querySelectorAll("td.col-edit-link");
    const youtubeCells = document.querySelectorAll("td.col-youtube-link");

    if (editHeader) editHeader.style.display = showEditCol ? "" : "none";
    if (youtubeHeader)
      youtubeHeader.style.display = showYoutubeCol ? "" : "none";
    editCells.forEach((td) => (td.style.display = showEditCol ? "" : "none"));
    youtubeCells.forEach(
      (td) => (td.style.display = showYoutubeCol ? "" : "none")
    );

    if (showEditLinkCheckbox) showEditLinkCheckbox.checked = showEditCol;
    if (showYoutubeLinkCheckbox)
      showYoutubeLinkCheckbox.checked = showYoutubeCol;
  }

  // Load trạng thái hiển thị cột
  chrome.storage.local.get(
    ["showEditCol", "showYoutubeCol"],
    ({ showEditCol: s1, showYoutubeCol: s2 }) => {
      showEditCol = !!(s1 === true);
      showYoutubeCol = !!(s2 === true);
      applyColumnVisibility();
    }
  );

  // Lắng nghe thay đổi checkbox
  if (showEditLinkCheckbox) {
    showEditLinkCheckbox.addEventListener("change", () => {
      showEditCol = showEditLinkCheckbox.checked;
      chrome.storage.local.set({ showEditCol });
      applyColumnVisibility();
    });
  }
  if (showYoutubeLinkCheckbox) {
    showYoutubeLinkCheckbox.addEventListener("change", () => {
      showYoutubeCol = showYoutubeLinkCheckbox.checked;
      chrome.storage.local.set({ showYoutubeCol });
      applyColumnVisibility();
    });
  }

  // Xử lý checkbox summaryFromLast
  const summaryFromLastCheckbox = document.getElementById("summaryFromLast");

  // Đọc trạng thái từ storage khi load
  chrome.storage.local.get("summaryFromLast", (result) => {
    const value =
      result.summaryFromLast !== undefined ? result.summaryFromLast : true;
    if (summaryFromLastCheckbox) {
      summaryFromLastCheckbox.checked = value;
    }
  });

  // Hàm để trích xuất summary từ rawContent
  function extractSummary(rawContent, fromLast) {
    if (!rawContent) return "";

    // Tìm tất cả nội dung trong thẻ <p>
    const pTagMatches = rawContent.match(/<p>(.*?)<\/p>/gs);

    let paragraphs;
    if (pTagMatches) {
      paragraphs = pTagMatches
        .map((p) => p.replace(/<\/?p>/g, "").trim())
        .filter((para) => para.length > 0);
    } else {
      // Nếu không có thẻ <p>, tách theo dòng trống
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = rawContent;
      const cleanText = tempDiv.textContent;
      paragraphs = cleanText
        .split(/\n\s*\n/)
        .map((para) => para.trim())
        .filter((para) => para.length > 0);
    }

    if (paragraphs.length >= 1) {
      return fromLast ? paragraphs[paragraphs.length - 1] : paragraphs[0];
    }

    return rawContent;
  }

  // Lưu trạng thái và cập nhật summary khi thay đổi checkbox
  if (summaryFromLastCheckbox) {
    summaryFromLastCheckbox.addEventListener("change", () => {
      const fromLast = summaryFromLastCheckbox.checked;
      chrome.storage.local.set({ summaryFromLast: fromLast });

      // Cập nhật summary cho tất cả các dòng có rawContent
      let hasUpdated = false;
      rows.forEach((row) => {
        if (row.rawContent) {
          const newSummary = extractSummary(row.rawContent, fromLast);
          if (newSummary && newSummary !== row.summary) {
            row.summary = newSummary;
            hasUpdated = true;
          }
        }
      });

      if (hasUpdated) {
        storage.set({ tableRows: rows }, () => {
          renderTable();
          utils.showToast(
            fromLast
              ? "Đã cập nhật summary từ đoạn cuối!"
              : "Đã cập nhật summary từ đoạn đầu!",
            "success"
          );
        });
      } else {
        utils.showToast(
          "Không có dữ liệu để cập nhật (cần thêm bài viết mới)",
          "warning"
        );
      }
    });
  }

  function renderTable() {
    tbody.innerHTML = "";
    // Ẩn/hiện empty-state
    const emptyState = document.getElementById("emptyState");
    if (rows.length === 0) {
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
    }
    rows.forEach((rowData, index) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-index", index); // Thêm data-index
      const { title, link, shortlink, thumbnail, contributors } = rowData;

      // Add cells in order
      tr.appendChild(cellCreators.number(index));
      tr.appendChild(cellCreators.title(title));
      tr.appendChild(cellCreators.summary(rowData.summary || ""));
      tr.appendChild(cellCreators.link(link));
      tr.appendChild(cellCreators.shortlink(shortlink));
      tr.appendChild(cellCreators.editLink(link));
      tr.appendChild(cellCreators.youtubeLink(rowData, index));
      tr.appendChild(cellCreators.image(thumbnail));
      /*    tr.appendChild(cellCreators.contributors(contributors)); */
      tr.appendChild(cellCreators.actions(rowData, tr, index));
      tr.appendChild(cellCreators.checked(rowData, index));

      tbody.appendChild(tr);
    });

    // Áp dụng ẩn/hiện sau khi render
    applyColumnVisibility();
  }

  // Helper: lấy danh sách rows theo chế độ copyMode
  function getRowsForCopy() {
    const mode = copyMode.value;
    if (mode === "selected") {
      return rows.filter((r) => r.checked);
    }
    return rows;
  }

  // Consolidated copy functions
  const copyFunctions = {
    titles: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const titles = selectedRows.map((item) => item.title).join("\n");
      utils.copyToClipboard(titles);
      utils.showToast("Đã sao chép tiêu đề!", "success");
    },

    summaries: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const summaries = selectedRows
        .map((item) => item.summary || "")
        .filter((summary) => summary.length > 0)
        .join("\n");
      if (summaries.length === 0) {
        utils.showToast("Không có tóm tắt nào để sao chép!", "warning");
        return;
      }
      utils.copyToClipboard(summaries);
      utils.showToast("Đã sao chép tóm tắt!", "success");
    },

    links: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const links = selectedRows.map((item) => item.link).join("\n");
      utils.copyToClipboard(links);
      utils.showToast("Đã sao chép liên kết!", "success");

      showDeleteModal(
        () => {
          storage.remove("tableRows", () => {
            rows = [];
            renderTable();
            utils.showToast("Đã xóa tất cả dữ liệu!", "success");
          });
        },
        () => utils.showToast("Đã giữ lại dữ liệu!", "info"),
        10,
        "Dữ liệu sẽ tự động xóa sau"
      );
    },

    shortlinks: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const shortlinks = selectedRows
        .map((item) => item.shortlink || "")
        .filter((s) => s && s.length > 0)
        .join("\n");
      if (shortlinks.length === 0) {
        utils.showToast("Không có shortlink nào để sao chép!", "warning");
        return;
      }
      utils.copyToClipboard(shortlinks);
      utils.showToast("Đã sao chép shortlink!", "success");
    },

    numbers: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const { day, month } = utils.formatDate();
      const numbers = selectedRows
        .map((row, idx) => `${day}${month}${String(idx + 1).padStart(2, "0")}`)
        .join("\n");
      utils.copyToClipboard(numbers);
      utils.showToast("Đã sao chép số thứ tự!", "success");
    },

    dataDesc: () => {
      const selectedRows = getRowsForCopy();
      if (selectedRows.length === 0) {
        utils.showToast("Không có dòng nào để sao chép!", "warning");
        return;
      }
      const text = selectedRows
        .map((item) => {
          const content = item.rawContent || "";
          // Loại bỏ HTML tags
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = content;
          // Thay thế tất cả khoảng trắng (bao gồm xuống dòng) bằng 1 dấu cách
          return tempDiv.textContent.replace(/\s+/g, " ").trim();
        })
        .join("\n-----\n");

      if (text.trim().length === 0) {
        utils.showToast("Không có dữ liệu để sao chép!", "warning");
        return;
      }

      utils.copyToClipboard(text);
      utils.showToast("Đã sao chép Description (Continuous Text)!", "success");
    },
  };

  // ===== Custom copy (chuột trái: copy theo mẫu, chuột phải: tùy chỉnh mẫu) =====
  const copyCustomBtn = document.getElementById("copyCustom");
  const customCopyModal = document.getElementById("customCopyModal");
  const customTemplateInput = document.getElementById("customTemplateInput");
  const customCopyPreview = document.getElementById("customCopyPreview");
  const closeCustomCopyModalBtn = document.getElementById(
    "closeCustomCopyModal"
  );
  const saveCustomTemplateBtn = document.getElementById("saveCustomTemplate");
  const resetCustomTemplateBtn = document.getElementById("resetCustomTemplate");
  const presetExcelBtn = document.getElementById("presetExcel");
  const presetLineBtn = document.getElementById("presetLine");
  const presetFullStoryBtn = document.getElementById("presetFullStory");
  const presetVollstandigeGeschichteBtn = document.getElementById(
    "presetVollstandigeGeschichte"
  );
  const tokenBtns = document.querySelectorAll(".token-btn[data-token]");

  const PRESET_EXCEL_TEMPLATE = "{title}\t{shortlink}";
  const PRESET_LINE_TEMPLATE = "{title}\n{shortlink}";
  const PRESET_FULL_STORY_TEMPLATE = "{title}\tFull Story 👉\t{shortlink}";
  const PRESET_VOLLSTANDIGE_GESCHICHTE_TEMPLATE =
    "{title}\tVollständige Geschichte 👉\t{shortlink}";

  const DEFAULT_CUSTOM_TEMPLATE = "{title}\t{shortlink}";
  let customCopyTemplate = DEFAULT_CUSTOM_TEMPLATE;

  function stripHtmlText(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html || "";
    return tempDiv.textContent.replace(/\s+/g, " ").trim();
  }

  function renderCustomTemplate(template, row, idx) {
    const { day, month } = utils.formatDate();
    return template
      .split("{stt}")
      .join(String(idx + 1).padStart(2, "0"))
      .split("{ngay}")
      .join(day + month) // vd: 2310 = hôm nay
      .split("{title}")
      .join(row.title || "")
      .split("{summary}")
      .join(row.summary || "")
      .split("{link}")
      .join(row.link || "")
      .split("{shortlink}")
      .join(row.shortlink || "")
      .split("{content}")
      .join(stripHtmlText(row.rawContent))
      .split("{tab}")
      .join("\t");
  }

  // Tách hàng Excel: ~nội dung~ = gom vào 1 ô, Tab = ô bên cạnh
  function buildExcelRow(text) {
    const quoteCell = (cell) => {
      cell = cell.replace(/~/g, "");
      if (cell.includes("\n") || cell.includes('"') || cell.includes("\t")) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    };
    const cells = [];
    let current = "";
    let inGroup = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "~") {
        inGroup = !inGroup;
        current += ch;
      } else if ((ch === "\t" || ch === "\n") && !inGroup) {
        if (ch === "\t") {
          cells.push(current);
          current = "";
        } else {
          current += "\n"; // Enter nằm ngoài ~...~ = xuống dòng trong ô
        }
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map(quoteCell).join("\t");
  }

  function updateCustomPreview() {
    const sampleRows = getRowsForCopy();
    if (!sampleRows.length) {
      customCopyPreview.textContent = "Chưa có dữ liệu để xem trước.";
      return;
    }
    customCopyPreview.textContent = buildExcelRow(
      renderCustomTemplate(customTemplateInput.value, sampleRows[0], 0)
    )
      .replace(/~/g, "")
      .split("\t")
      .join(" ⇥ ");
  }

  function openCustomModal() {
    customTemplateInput.value = customCopyTemplate;
    updateCustomPreview();
    customCopyModal.classList.add("show");
  }

  function closeCustomModal() {
    customCopyModal.classList.remove("show");
  }

  // Nạp mẫu đã lưu từ storage
  storage.get("customCopyTemplate", (result) => {
    if (
      typeof result.customCopyTemplate === "string" &&
      result.customCopyTemplate.length > 0
    ) {
      customCopyTemplate = result.customCopyTemplate;
      // Nâng cấp mẫu cũ (_enter_ giữa title/shortlink) sang mẫu Excel (_tab_)
      if (customCopyTemplate === "{title}\n{shortlink}") {
        customCopyTemplate = DEFAULT_CUSTOM_TEMPLATE;
        storage.set({ customCopyTemplate });
      }
    }
  });

  // Chuột trái: sao chép theo mẫu custom
  copyCustomBtn.addEventListener("click", () => {
    const selectedRows = getRowsForCopy();
    if (selectedRows.length === 0) {
      utils.showToast("Không có dòng nào để sao chép!", "warning");
      return;
    }
    const template = customCopyTemplate.trim();
    if (!template) {
      utils.showToast("Mẫu custom đang trống, mở cửa sổ tùy chỉnh!", "warning");
      openCustomModal();
      return;
    }
    const text = selectedRows
      .map((row, idx) => buildExcelRow(renderCustomTemplate(template, row, idx)))
      .join("\n");
    utils.copyToClipboard(text);
    utils.showToast("Đã sao chép theo mẫu custom!", "success");
  });

  // Chuột phải: mở cửa sổ tùy chỉnh mẫu
  copyCustomBtn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openCustomModal();
  });

  // Chèn thẻ vào vị trí con trỏ trong textarea
  const storyPhraseTokens = ["Full Story 👉", "Vollständige Geschichte 👉"];
  let storyPhraseClickTimer;

  tokenBtns.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const token = btn.getAttribute("data-token");
      if (storyPhraseTokens.includes(token)) {
        clearTimeout(storyPhraseClickTimer);
        if (event.detail > 1) return;
        storyPhraseClickTimer = setTimeout(() => {
          insertCustomToken(token);
        }, 250);
        return;
      }
      insertCustomToken(token);
    });

    btn.addEventListener("dblclick", () => {
      const token = btn.getAttribute("data-token");
      if (!storyPhraseTokens.includes(token)) return;

      clearTimeout(storyPhraseClickTimer);
      const otherPhrase = storyPhraseTokens.find((phrase) => phrase !== token);
      const value = customTemplateInput.value;
      if (!value.includes(token) && !value.includes(otherPhrase)) return;

      const placeholder = "__STORY_PHRASE_SWAP__";
      customTemplateInput.value = value
        .split(token)
        .join(placeholder)
        .split(otherPhrase)
        .join(token)
        .split(placeholder)
        .join(otherPhrase);
      updateCustomPreview();
    });
  });

  function insertCustomToken(token) {
    const start = customTemplateInput.selectionStart;
    const end = customTemplateInput.selectionEnd;
    const value = customTemplateInput.value;
    customTemplateInput.value =
      value.slice(0, start) + token + value.slice(end);
    customTemplateInput.focus();
    const pos = start + token.length;
    customTemplateInput.setSelectionRange(pos, pos);
    updateCustomPreview();
  }

  customTemplateInput.addEventListener("input", updateCustomPreview);

  saveCustomTemplateBtn.addEventListener("click", () => {
    customCopyTemplate = customTemplateInput.value;
    storage.set({ customCopyTemplate }, () => {
      closeCustomModal();
      utils.showToast("Đã lưu mẫu custom!", "success");
    });
  });

  resetCustomTemplateBtn.addEventListener("click", () => {
    customTemplateInput.value = DEFAULT_CUSTOM_TEMPLATE;
    updateCustomPreview();
  });

  presetExcelBtn.addEventListener("click", () => {
    customTemplateInput.value = PRESET_EXCEL_TEMPLATE;
    updateCustomPreview();
  });

  presetLineBtn.addEventListener("click", () => {
    customTemplateInput.value = PRESET_LINE_TEMPLATE;
    updateCustomPreview();
  });

  presetFullStoryBtn.addEventListener("click", () => {
    customTemplateInput.value = PRESET_FULL_STORY_TEMPLATE;
    updateCustomPreview();
  });

  presetVollstandigeGeschichteBtn.addEventListener("click", () => {
    customTemplateInput.value = PRESET_VOLLSTANDIGE_GESCHICHTE_TEMPLATE;
    updateCustomPreview();
  });

  closeCustomCopyModalBtn.addEventListener("click", closeCustomModal);
  customCopyModal.addEventListener("click", (e) => {
    if (e.target === customCopyModal) {
      closeCustomModal();
    }
  });

  // Consolidated clear and sort functions
  const tableFunctions = {
    clear: () => {
      showDeleteModal(
        () => {
          storage.remove("tableRows", () => {
            rows = [];
            renderTable();
            utils.showToast("Đã xóa tất cả dữ liệu!", "success");
          });
        },
        () => utils.showToast("Đã giữ lại dữ liệu!", "info"),
        10,
        "Dữ liệu sẽ tự động xóa sau"
      );
    },
    sort: () => {
      storage.get("tableRows", (result) => {
        let sortedRows = (result.tableRows || []).slice();
        // Nếu tất cả đều đã checked, sắp xếp theo link
        if (
          sortedRows.length > 0 &&
          sortedRows.every((r) => r.checked !== false)
        ) {
          sortedRows.sort((a, b) => {
            // Extract numbers from links for secondary sorting
            const getNumber = (link) => {
              const match = (link || "").match(/\/(\d+)\//);
              return match ? parseInt(match[1]) : 0;
            };
            const numA = getNumber(a.link);
            const numB = getNumber(b.link);
            return numA - numB; // Sort by link number
          });
        } else {
          // Sắp xếp: chưa checked lên trên, đã checked xuống dưới
          sortedRows.sort((a, b) => {
            // Treat both undefined and false checked as unchecked (move to top)
            const checkedA = a.checked === true ? 1 : 0;
            const checkedB = b.checked === true ? 1 : 0;
            if (checkedA !== checkedB) return checkedA - checkedB;

            // Secondary sort by link number when checked status is the same
            const getNumber = (link) => {
              const match = (link || "").match(/\/(\d+)\//);
              return match ? parseInt(match[1]) : 0;
            };
            const numA = getNumber(a.link);
            const numB = getNumber(b.link);
            return numA - numB;
          });
        }
        storage.set({ tableRows: sortedRows }, () => {
          rows = sortedRows;
          renderTable();
        });
      });
    },

    viewImages: () => {
      storage.get("tableRows", (result) => {
        const latestRows = result.tableRows || [];
        const imagesHtml = latestRows
          .map((row, index) => {
            if (row.thumbnail) {
              return `
                <div style="margin-bottom: 20px;">
                  <p><strong>${index + 1}. ${row.title}</strong></p>
                  <img src="${
                    row.thumbnail
                  }" style="max-width: 300px; height: auto;">
                  <p><a href="${row.link}" target="_blank">Xem bài viết</a></p>
                </div>
              `;
            }
            return "";
          })
          .join("");

        storage.set({ imagesHtmlData: imagesHtml }, () => {
          const url =
            chrome.runtime.getURL("create_img.html") + "?showImages=true";
          chrome.tabs.create({ url });
        });
      });
    },
  };
  const clearCheckedBtn = document.getElementById("clearCheckedBtn");
  if (clearCheckedBtn) {
    clearCheckedBtn.addEventListener("click", () => {
      const checkboxes = tbody.querySelectorAll(
        'input[type="checkbox"]:checked'
      );

      if (checkboxes.length === 0) {
        utils.showToast("Không có dòng nào được chọn!", "warning");
        return;
      }

      if (!confirm(`Bạn có chắc muốn xóa ${checkboxes.length} dòng đã chọn?`)) {
        return;
      }

      // Lấy các index cần xóa
      const checkedIndexes = Array.from(checkboxes).map((cb) => {
        const tr = cb.closest("tr");
        return parseInt(tr.getAttribute("data-index"), 10);
      });

      // Lọc ra các dòng không được chọn
      rows = rows.filter((row, idx) => !checkedIndexes.includes(idx));

      storage.set({ tableRows: rows }, () => {
        utils.showToast("Đã xóa các dòng đã chọn!", "success");
        renderTable(); // Render lại thay vì reload
      });
    });
  }
  const sortCheckedBtn = document.getElementById("sortCheckedBtn");
  if (sortCheckedBtn) {
    sortCheckedBtn.addEventListener("click", () => {
      // Kiểm tra xem rows có tồn tại và có dữ liệu không
      if (!rows || rows.length === 0) {
        console.log("Không có dữ liệu để sắp xếp");
        return;
      }

      // Nếu tất cả đều đã checked, sắp xếp theo link
      if (rows.every((r) => r.checked !== false)) {
        // Changed condition to check for not explicitly false
        rows.sort((a, b) => {
          // Extract numbers from links for secondary sorting
          const getNumber = (link) => {
            const match = (link || "").match(/\/(\d+)\//);
            return match ? parseInt(match[1]) : 0;
          };
          const numA = getNumber(a.link);
          const numB = getNumber(b.link);
          return numA - numB; // Sort by link number
        });
      } else {
        // Sắp xếp: chưa checked lên trên, đã checked xuống dưới
        rows.sort((a, b) => {
          // Treat both undefined and false checked as unchecked (move to top)
          const checkedA = a.checked === true ? 1 : 0;
          const checkedB = b.checked === true ? 1 : 0;
          if (checkedA !== checkedB) return checkedA - checkedB;

          // Secondary sort by link number when checked status is the same
          const getNumber = (link) => {
            const match = (link || "").match(/\/(\d+)\//);
            return match ? parseInt(match[1]) : 0;
          };
          const numA = getNumber(a.link);
          const numB = getNumber(b.link);
          return numA - numB;
        });
      }
      console.log(rows);
      // Lưu và render lại
      storage.set({ tableRows: rows }, () => {
        renderTable();
      });
    });
  }
  // Initialize
  storage.get("tableRows", (result) => {
    rows = result.tableRows || [];
    renderTable();
  });
  // Logic cho input checkAll
  const checkAll = document.getElementById("checkAll");
  checkAll.addEventListener("change", function () {
    const tbody = document.querySelector("#dataTable tbody");
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.checked = checkAll.checked;
      // Cập nhật trạng thái trong rows array
      const tr = cb.closest("tr");
      if (tr) {
        const idx = parseInt(tr.getAttribute("data-index"), 10);
        if (!isNaN(idx)) {
          rows[idx].checked = checkAll.checked;
        }
      }
    });
    // Lưu trạng thái vào storage
    storage.set({ tableRows: rows });
  });

  // Nếu có render lại bảng, hãy cập nhật trạng thái checkAll cho đúng:
  function updateCheckAllState() {
    const tbody = document.querySelector("#dataTable tbody");
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
    const checked = tbody.querySelectorAll('input[type="checkbox"]:checked');
    checkAll.checked =
      checkboxes.length > 0 && checked.length === checkboxes.length;
    checkAll.indeterminate =
      checked.length > 0 && checked.length < checkboxes.length;
  }

  // Gọi updateCheckAllState mỗi khi có thao tác check/uncheck từng dòng
  document
    .querySelector("#dataTable tbody")
    .addEventListener("change", function (e) {
      if (e.target.type === "checkbox") {
        updateCheckAllState();
      }
    });
  // Event listeners
  copyTitlesBtn.addEventListener("click", copyFunctions.titles);
  copySummariesBtn.addEventListener("click", copyFunctions.summaries);
  if (copyDataDescBtn) {
    copyDataDescBtn.addEventListener("click", copyFunctions.dataDesc);
  }
  copyShortlinksBtn.addEventListener("click", copyFunctions.shortlinks);

  copyLinksBtn.addEventListener("click", () => {
    const selectedRows = getRowsForCopy();
    if (selectedRows.length === 0) {
      utils.showToast("Không có dòng nào để sao chép!", "warning");
      return;
    }
    const links = selectedRows.map((item) => item.link).join("\n");
    utils.copyToClipboard(links);
    utils.showToast("Đã sao chép liên kết!", "success");

    /* showDeleteModal(
      () => {
        storage.remove("tableRows", () => {
          rows = [];
          renderTable();
          utils.showToast("Đã xóa tất cả dữ liệu!", "success");
        });
      },
      () => utils.showToast("Đã giữ lại dữ liệu!", "info"),
      10,
      "Dữ liệu sẽ tự động xóa sau"
    ); */
  });

  copyNumbersBtn.addEventListener("click", () => {
    const selectedRows = getRowsForCopy();
    if (selectedRows.length === 0) {
      utils.showToast("Không có dòng nào để sao chép!", "warning");
      return;
    }
    const { day, month } = utils.formatDate();
    const numbers = selectedRows
      .map((row, idx) => `${day}${month}${String(idx + 1).padStart(2, "0")}`)
      .join("\n");
    utils.copyToClipboard(numbers);
    utils.showToast("Đã sao chép số thứ tự!", "success");
  });
  document
    .getElementById("viewTable")
    .addEventListener("click", tableFunctions.sort);

  // Modal function (kept separate as it's complex)
  function showDeleteModal(
    onDelete,
    onKeep,
    countdownSeconds = 10,
    message = "Dữ liệu sẽ tự động xóa sau"
  ) {
    let countdown = countdownSeconds;
    let intervalId = null;

    // Tạo modal overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        backdrop-filter: blur(2px);
    `;

    // Tạo modal content
    const modal = document.createElement("div");
    modal.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 30px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
        animation: modalAppear 0.3s ease-out;
    `;

    // Thêm animation CSS
    const style = document.createElement("style");
    style.textContent = `
        @keyframes modalAppear {
            from {
                opacity: 0;
                transform: scale(0.8) translateY(-50px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Tạo icon cảnh báo
    const warningIcon = document.createElement("div");
    warningIcon.innerHTML = "⚠️";
    warningIcon.style.cssText = `
        font-size: 48px;
        margin-bottom: 20px;
    `;

    // Tạo message element
    const messageElement = document.createElement("div");
    messageElement.style.cssText = `
        font-size: 18px;
        color: #333;
        margin-bottom: 20px;
        line-height: 1.5;
    `;

    // Tạo countdown display
    const countdownDisplay = document.createElement("div");
    countdownDisplay.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        color: #ff4444;
        margin-bottom: 30px;
        background: #fff5f5;
        padding: 10px;
        border-radius: 5px;
        border: 2px solid #ffebee;
    `;

    // Tạo container cho buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
    `;

    // Tạo nút Giữ lại
    const keepButton = document.createElement("button");
    keepButton.innerHTML = "💾 Giữ lại";
    keepButton.style.cssText = `
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        transition: background-color 0.3s;
        min-width: 120px;
    `;

    // Tạo nút Xóa ngay
    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = "🗑️ Xóa ngay";
    deleteButton.style.cssText = `
        background-color: #f44336;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        transition: background-color 0.3s;
        min-width: 120px;
    `;

    // Hover effects
    keepButton.addEventListener("mouseenter", () => {
      keepButton.style.backgroundColor = "#45a049";
    });
    keepButton.addEventListener("mouseleave", () => {
      keepButton.style.backgroundColor = "#4CAF50";
    });

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.style.backgroundColor = "#da190b";
    });
    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.style.backgroundColor = "#f44336";
    });

    // Event listeners cho các nút
    deleteButton.addEventListener("click", () => {
      closeModal();
      if (onDelete) onDelete();
      utils.showToast("Dữ liệu đã được xóa!", "success");
    });

    keepButton.addEventListener("click", () => {
      closeModal();
      if (onKeep) onKeep();
      utils.showToast("Dữ liệu đã được giữ lại!", "info");
    });

    // Đóng modal khi click overlay
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
        if (onKeep) onKeep();
      }
    });

    // Hàm đóng modal
    function closeModal() {
      clearInterval(intervalId);
      document.body.removeChild(overlay);
      document.head.removeChild(style);
    }

    // Hàm cập nhật nội dung modal
    function updateModal() {
      // Nếu message có chứa 'Warning:', tách và tô màu đỏ cho phần warning
      if (message.startsWith("Warning:")) {
        const [warning, ...rest] = message.split("\n");
        messageElement.innerHTML = `<span style='color:#f44336;font-weight:bold;'>${warning}</span><br>${rest.join(
          "<br>"
        )}`;
      } else {
        messageElement.textContent = message;
      }
      countdownDisplay.textContent = `${countdown} giây`;
    }

    // Xây dựng modal
    modal.appendChild(warningIcon);
    modal.appendChild(messageElement);
    modal.appendChild(countdownDisplay);
    buttonContainer.appendChild(keepButton);
    buttonContainer.appendChild(deleteButton);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);

    // Hiển thị modal
    document.body.appendChild(overlay);
    updateModal();

    // Bắt đầu countdown
    intervalId = setInterval(() => {
      countdown--;
      if (countdown < 0) {
        closeModal();
        if (onDelete) onDelete();
        utils.showToast("Dữ liệu đã được xóa tự động!", "success");
      } else {
        updateModal();
      }
    }, 1000);
  }
  // Thêm event listener cho nút restore
  if (restoreBtn) {
    restoreBtn.addEventListener("click", () => {
      chrome.storage.local.get("backupRows", (result) => {
        if (result.backupRows && result.backupRows.length > 0) {
          // Khôi phục dữ liệu từ backup ngay lập tức
          const currentRows = [...rows]; // Lưu trạng thái hiện tại
          rows = [...result.backupRows]; // Khôi phục từ backup

          // Lưu trạng thái mới
          chrome.storage.local.set(
            {
              tableRows: rows,
              backupRows: currentRows,
              backupRowsSavedAt: Date.now(),
            },
            () => {
              renderTable();
              utils.showToast("Đã khôi phục dữ liệu!", "success");
              restoreBtn.style.display = "inline-block";
            }
          );
        } else {
          utils.showToast("Không có dữ liệu backup để khôi phục!", "warning");
          restoreBtn.style.display = "none";
        }
      });
    });
  }

  // Hàm lên lịch xóa backupRows vào cuối ngày
  function scheduleBackupCleanup() {
    const now = new Date();
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // Đổi thành ngày mai
      0, // 00:00:00
      0,
      0,
      0
    );
    const msUntilEndOfDay = endOfDay.getTime() - now.getTime();

    setTimeout(() => {
      chrome.storage.local.remove(["backupRows", "backupRowsSavedAt"], () => {
        backupRows = [];
        if (restoreBtn) {
          restoreBtn.style.display = "none";
        }
      });
    }, msUntilEndOfDay);
  }

  // Gọi hàm lên lịch khi load trang
  scheduleBackupCleanup();

  // Cập nhật hàm xử lý nút delete
  deleteBtn.addEventListener("click", () => {
    const isSelectedMode = copyMode.value === "selected";
    if (isSelectedMode) {
      const checkboxes = tbody.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      if (checkboxes.length === 0) {
        utils.showToast("Không có dòng nào được chọn!", "warning");
        return;
      }
      const deleteSelected = () => {
        // Lấy các dòng đã chọn để backup
        const checkedIndexes = Array.from(checkboxes).map((cb) =>
          parseInt(cb.closest("tr").getAttribute("data-index"), 10)
        );
        const rowsToBackup = rows.filter((row, idx) =>
          checkedIndexes.includes(idx)
        );

        // Thêm vào backupRows hiện có
        chrome.storage.local.get("backupRows", (result) => {
          const currentBackup = result.backupRows || [];
          const newBackup = [...currentBackup, ...rowsToBackup];

          chrome.storage.local.set(
            { backupRows: newBackup, backupRowsSavedAt: Date.now() },
            () => {
              backupRows = newBackup;
              if (restoreBtn) {
                restoreBtn.style.display = "inline-block";
              }

              // Xóa các dòng đã chọn khỏi rows
              rows = rows.filter((row, idx) => !checkedIndexes.includes(idx));
            chrome.storage.local.set({ tableRows: rows }, () => {
              utils.showToast("Đã xóa các dòng đã chọn!", "success", 10000);
              renderTable();
            });
          });
        });
      };
      showDeleteModal(
        deleteSelected,
        () => utils.showToast("Đã giữ lại dữ liệu!", "info"),
        10,
        "Các dòng đã chọn sẽ tự động xóa sau"
      );
    } else {
      const deleteAll = () => {
        // Thêm tất cả rows hiện tại vào backupRows
        chrome.storage.local.get("backupRows", (result) => {
          const currentBackup = result.backupRows || [];
          const newBackup = [...currentBackup, ...rows];

          chrome.storage.local.set(
            { backupRows: newBackup, backupRowsSavedAt: Date.now() },
            () => {
              backupRows = newBackup;
              if (restoreBtn) {
                restoreBtn.style.display = "inline-block";
              }

              // Xóa tất cả rows
            chrome.storage.local.remove("tableRows", () => {
              rows = [];
              renderTable();
              utils.showToast("Đã xóa tất cả dữ liệu!", "success", 10000);
            });
          });
        });
      };
      showDeleteModal(
        deleteAll,
        () => utils.showToast("Đã giữ lại dữ liệu!", "info"),
        10,
        "Warning: Bạn đã copy dữ liệu vào trang tính chưa?\nXóa sau"
      );
    }
  });
  function enableAdvancedSelection(tableElement) {
    let isDragging = false;
    let dragStartState = null;
    let lastClickedCheckbox = null;

    // Xử lý click với Shift
    tableElement.addEventListener("click", (e) => {
      if (e.target.type === "checkbox") {
        if (e.shiftKey && lastClickedCheckbox) {
          // Shift+click: chọn range
          const checkboxes = Array.from(
            tableElement.querySelectorAll('input[type="checkbox"]')
          );
          const startIndex = checkboxes.indexOf(lastClickedCheckbox);
          const endIndex = checkboxes.indexOf(e.target);
          const start = Math.min(startIndex, endIndex);
          const end = Math.max(startIndex, endIndex);
          const newState = e.target.checked;
          for (let i = start; i <= end; i++) {
            checkboxes[i].checked = newState;
            // Cập nhật rows
            const tr = checkboxes[i].closest("tr");
            if (tr) {
              const idx = parseInt(tr.getAttribute("data-index"), 10);
              if (!isNaN(idx)) rows[idx].checked = newState;
            }
          }
          storage.set({ tableRows: rows });
        } else {
          // Cập nhật rows cho click thường
          const tr = e.target.closest("tr");
          if (tr) {
            const idx = parseInt(tr.getAttribute("data-index"), 10);
            if (!isNaN(idx)) {
              rows[idx].checked = e.target.checked;
              storage.set({ tableRows: rows });
            }
          }
        }
        lastClickedCheckbox = e.target;
      }
    });

    // Drag selection
    tableElement.addEventListener("mousedown", (e) => {
      if (e.target.type === "checkbox" && !e.shiftKey) {
        isDragging = true;
        dragStartState = !e.target.checked;
        e.preventDefault();
      }
    });

    tableElement.addEventListener("mouseover", (e) => {
      if (isDragging && e.target.type === "checkbox") {
        e.target.checked = dragStartState;
        // Cập nhật rows khi drag
        const tr = e.target.closest("tr");
        if (tr) {
          const idx = parseInt(tr.getAttribute("data-index"), 10);
          if (!isNaN(idx)) {
            rows[idx].checked = dragStartState;
            storage.set({ tableRows: rows });
          }
        }
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      dragStartState = null;
    });

    tableElement.addEventListener("mouseleave", () => {
      isDragging = false;
      dragStartState = null;
    });
  }

  // Kích hoạt drag selection cho checkbox trong tbody
  const table = document.getElementById("dataTable");
  enableAdvancedSelection(table.querySelector("tbody"));

  // Xử lý thay đổi chủ đề cho các dòng được chọn
  topicPicker.addEventListener("change", () => {
    const selectedTopic = topicPicker.value;
    const selectedColor = topicColors[selectedTopic];
    const checkedRows = tbody.querySelectorAll(
      'input[type="checkbox"]:checked'
    );

    checkedRows.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      if (row) {
        row.style.backgroundColor = selectedColor;
        // Lưu chủ đề và màu vào rows array
        const idx = parseInt(row.getAttribute("data-index"), 10);
        if (!isNaN(idx)) {
          rows[idx].topic = selectedTopic;
          rows[idx].backgroundColor = selectedColor;
        }
      }
    });

    // Lưu trạng thái vào storage
    storage.set({ tableRows: rows });
  });

  // Thêm xử lý khôi phục màu khi render lại bảng
  const originalRenderTable = renderTable;
  renderTable = function () {
    originalRenderTable();
    // Khôi phục màu cho các dòng
    rows.forEach((rowData, index) => {
      if (rowData.backgroundColor) {
        const row = tbody.querySelector(`tr[data-index="${index}"]`);
        if (row) {
          row.style.backgroundColor = rowData.backgroundColor;
        }
      }
    });
  };

  // ========== MODAL TÁCH BÀI VIẾT ==========
  const splitModal = document.getElementById("splitModal");
  const openSplitModalBtn = document.getElementById("openSplitModal");
  const closeModalBtn = document.getElementById("closeModal");
  const processBtn = document.getElementById("processBtn");
  const articleInput = document.getElementById("articleInput");
  const resultsSection = document.getElementById("resultsSection");

  // Mở modal
  openSplitModalBtn.addEventListener("click", () => {
    splitModal.classList.add("show");
    articleInput.value = "";
    resultsSection.classList.remove("show");
  });

  // Đóng modal
  closeModalBtn.addEventListener("click", () => {
    splitModal.classList.remove("show");
  });

  // Đóng modal khi click bên ngoài
  splitModal.addEventListener("click", (e) => {
    if (e.target === splitModal) {
      splitModal.classList.remove("show");
    }
  });

  // Xử lý tách bài viết
  processBtn.addEventListener("click", () => {
    const input = articleInput.value.trim();

    if (!input) {
      utils.showToast("Vui lòng dán nội dung vào!", "warning");
      return;
    }

    // Tách nội dung thành các dòng (GIỮ LẠI dòng trống)
    const lines = input.split("\n");

    if (lines.length < 2) {
      utils.showToast("Nội dung phải có ít nhất 2 dòng!", "warning");
      return;
    }

    // Tách bài viết dựa trên dòng trống
    const articles = [];
    let currentArticle = null;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Nếu là dòng trống
      if (trimmedLine === "") {
        // Kết thúc bài viết hiện tại (nếu có)
        if (currentArticle && currentArticle.title) {
          articles.push(currentArticle);
          currentArticle = null;
        }
        return;
      }

      // Nếu chưa có bài viết -> dòng này là title
      if (!currentArticle) {
        currentArticle = {
          title: trimmedLine,
          content: [],
        };
      } else {
        // Các dòng tiếp theo là content
        currentArticle.content.push(trimmedLine);
      }
    });

    // Thêm bài viết cuối cùng
    if (currentArticle) {
      articles.push(currentArticle);
    }

    // Kiểm tra số lượng bài viết
    if (articles.length === 0) {
      utils.showToast(
        "Không thể tách bài viết! Vui lòng kiểm tra định dạng.",
        "warning"
      );
      return;
    }

    // Xóa các article cards cũ (giữ lại copy all section)
    const oldArticles = resultsSection.querySelectorAll(".article-card");
    oldArticles.forEach((card) => card.remove());

    // Hiển thị copy all section
    const copyAllSection = document.getElementById("copyAllSection");
    if (copyAllSection) {
      copyAllSection.style.display = "block";
    }

    // Lưu articles vào biến toàn cục để dùng cho copy all
    window.currentArticles = articles;

    // Tạo card cho từng bài viết
    articles.forEach((article, index) => {
      const articleCard = document.createElement("div");
      articleCard.className = "article-card";

      articleCard.innerHTML = `
        <h3>📄 Bài viết ${index + 1}</h3>
        <div class="content-box">
          <div class="content-label">Tiêu đề:</div>
          <div class="content-text" data-article="${index}" data-type="title">${
        article.title
      }</div>
        </div>
        <div class="content-box">
          <div class="content-label">Nội dung:</div>
          <div class="content-text" data-article="${index}" data-type="content">${article.content.join(
        " "
      )}</div>
        </div>
        <div class="copy-buttons">
          <button class="copy-btn" data-copy-title="${index}">📋 Copy Tiêu đề</button>
          <button class="copy-btn" data-copy-content="${index}">📋 Copy Nội dung</button>
        </div>
      `;

      resultsSection.appendChild(articleCard);
    });

    // Gắn event listeners cho các nút copy
    resultsSection.querySelectorAll("[data-copy-title]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = e.target.getAttribute("data-copy-title");
        const titleElement = resultsSection.querySelector(
          `[data-article="${index}"][data-type="title"]`
        );
        utils.copyToClipboard(titleElement.textContent);
        utils.showToast(
          `Đã copy tiêu đề bài ${parseInt(index) + 1}!`,
          "success"
        );
      });
    });

    resultsSection.querySelectorAll("[data-copy-content]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = e.target.getAttribute("data-copy-content");
        const contentElement = resultsSection.querySelector(
          `[data-article="${index}"][data-type="content"]`
        );
        utils.copyToClipboard(contentElement.textContent);
        utils.showToast(
          `Đã copy nội dung bài ${parseInt(index) + 1}!`,
          "success"
        );
      });
    });

    resultsSection.classList.add("show");

    utils.showToast(
      `Đã tách thành ${articles.length} bài viết thành công!`,
      "success"
    );
  });

  // Copy All Titles
  const copyAllTitlesBtn = document.getElementById("copyAllTitles");
  if (copyAllTitlesBtn) {
    copyAllTitlesBtn.addEventListener("click", () => {
      if (!window.currentArticles || window.currentArticles.length === 0) {
        utils.showToast("Không có bài viết nào để copy!", "warning");
        return;
      }

      const allTitles = window.currentArticles
        .map((article) => article.title)
        .join("\n");

      utils.copyToClipboard(allTitles);
      utils.showToast(
        `Đã copy ${window.currentArticles.length} tiêu đề!`,
        "success"
      );
    });
  }

  // Copy All Content
  const copyAllContentBtn = document.getElementById("copyAllContent");
  if (copyAllContentBtn) {
    copyAllContentBtn.addEventListener("click", () => {
      if (!window.currentArticles || window.currentArticles.length === 0) {
        utils.showToast("Không có bài viết nào để copy!", "warning");
        return;
      }

      const allContent = window.currentArticles
        .map((article) => article.content.join(" "))
        .join("\n");

      utils.copyToClipboard(allContent);
      utils.showToast(
        `Đã copy ${window.currentArticles.length} nội dung!`,
        "success"
      );
    });
  }
});
