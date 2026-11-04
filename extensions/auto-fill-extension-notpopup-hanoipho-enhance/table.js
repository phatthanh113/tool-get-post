document.addEventListener("DOMContentLoaded", function () {
  loadArticles();

  // Add event listener for Copy All button
  document
    .getElementById("copyAllBtn")
    .addEventListener("click", copyAllContent);

  // Add event listener for Copy All Titles button
  document
    .getElementById("copyAllTitleBtn")
    .addEventListener("click", copyAllTitles);

  // Add event listener for Delete All button
  document
    .getElementById("deleteAllBtn")
    .addEventListener("click", deleteAllArticles);

  // Add event listener for Copy Selected button
  document
    .getElementById("copySelectedBtn")
    .addEventListener("click", copySelectedContent);

  // Add event listener for Copy Selected Titles button
  document
    .getElementById("copySelectedTitlesBtn")
    .addEventListener("click", copySelectedTitles);

  // Add event listener for Delete Selected button
  document
    .getElementById("deleteSelectedBtn")
    .addEventListener("click", deleteSelectedArticles);

  // Add event listener for Bulk Paste button
  document
    .getElementById("bulkPasteBtn")
    .addEventListener("click", openBulkPasteModal);

  // Add event listener for Auto Select Images button
  const autoSelectImagesBtn = document.getElementById("autoSelectImagesBtn");
  if (autoSelectImagesBtn) {
    autoSelectImagesBtn.addEventListener("click", startAutoSelectImages);
  }

  // Add event listener for Close Xopboo Tabs button
  document
    .getElementById("closeXopbooTabsBtn")
    .addEventListener("click", closeAllXopbooTabs);

  // Add event listeners for bulk paste modal
  document
    .getElementById("bulkPasteCancelBtn")
    .addEventListener("click", closeBulkPasteModal);

  document
    .getElementById("bulkPasteConfirmBtn")
    .addEventListener("click", performBulkPaste);

  // Add event listener for Select All checkbox
  document
    .getElementById("selectAll")
    .addEventListener("change", async function (e) {
      const checkboxes = document.querySelectorAll(".article-checkbox");
      const isChecked = e.target.checked;

      // Update all checkboxes visually
      checkboxes.forEach((checkbox) => (checkbox.checked = isChecked));

      // Save each checkbox state to storage (skip Select All update to avoid loop)
      for (let i = 0; i < checkboxes.length; i++) {
        const index = parseInt(checkboxes[i].dataset.index);
        await saveCheckboxState(index, isChecked, true); // Skip Select All update
      }

      // Save Select All state to storage
      saveSelectAllState(isChecked);
    });

  // Add event listener for Global New Content at Bottom checkbox
  document
    .getElementById("globalInputPositionBottom")
    .addEventListener("change", function (e) {
      saveGlobalInputPositionState(e.target.checked);
    });

  // Load Global New Content at Bottom state
  loadGlobalInputPositionState();

  // Add event delegation for name tags search
  document.addEventListener("click", (event) => {
    const nameTag = event.target.closest(".name-tag");
    if (nameTag) {
      const searchTerm = nameTag.dataset.searchTerm;
      if (searchTerm) {
        window.open(`https://www.google.com/search?q=${searchTerm}`, "_blank");
      }
    }
  });
});

// Function to delete all articles
async function deleteAllArticles() {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  if (articlesData.length === 0) {
    showToast("No articles to delete!");
    return;
  }

  if (
    confirm(
      `Are you sure you want to delete all ${articlesData.length} articles?`,
    )
  ) {
    // Clear all articles
    await chrome.storage.local.set({ xopbooArticles: [] });

    // Show success message
    showToast("All articles have been deleted");

    // Reload the table
    loadArticles();
  }
}

// Function to show toast notification
function showToast(message, duration = 5000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showDuplicateWarning") {
    showToast(`An article with the title "${message.title}" already exists`);
  }
});

// Function to load articles from storage
async function loadArticles() {
  const articles = await chrome.storage.local.get("xopbooArticles");
  let articlesData = articles.xopbooArticles || [];

  // Remove duplicate title articles, keep the first occurrence
  const uniqueTitles = new Set();
  articlesData = articlesData.filter((article) => {
    if (uniqueTitles.has(article.title)) {
      return false; // Skip this article as title already exists
    }
    uniqueTitles.add(article.title);
    return true;
  });

  // Initialize checkboxstates for articles that don't have it
  articlesData = articlesData.map((article) => {
    if (typeof article.checkboxstates === "undefined") {
      article.checkboxstates = false;
    }
    return article;
  });

  // Save the filtered articles back to storage
  await chrome.storage.local.set({ xopbooArticles: articlesData });

  const tbody = document.getElementById("articlesBody");
  const totalSpan = document.getElementById("total-articles");

  totalSpan.textContent = articlesData.length;

  tbody.innerHTML = "";

  articlesData.forEach((article, index) => {
    console.log(
      `Article ${index} [${article.title}]: videoUrl =`,
      article.videoUrl,
    );
    const row = document.createElement("tr");

    row.innerHTML = `
            <td>
              ${index + 1}
            </td>
            <td>
              <input type="checkbox" class="article-checkbox" data-index="${index}">
            </td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
              article.title
            }">
              ${article.title}
              ${
                article.videoUrl
                  ? `<br><span style="background: #ff0000; color: white; padding: 1px 4px; border-radius: 3px; font-size: 10px;">YouTube</span>`
                  : ""
              }
            </td>
            <td style="max-width: 100px;">
              ${
                article.image
                  ? `<img src="${article.image}" alt="${article.title}" style="max-width: 80px; max-height: 40px; object-fit: cover; border-radius: 4px;" />`
                  : `<div style="width: 80px; height: 40px; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; border-radius: 4px;">No image</div>`
              }
            </td>
            <td class="names-container" style="display: none;">
              ${generateNamesHTML(article.description)}
            </td>
            <td>
                <button class="btn btn-edit" data-index="${index}" style="display: none;">Edit</button>
                <button class="btn btn-copy" data-index="${index}"  style="display: none;">Copy</button>
                <button class="btn btn-copy-title" data-index="${index}" style="background-color: #9c27b0; color: white;display: none;">Copy Title</button>
                <button class="btn btn-select-image" data-index="${index}" style="background-color: #ff9800; color: white;">Img</button>
                <button class="btn btn-delete" data-index="${index}">Delete</button>
            </td>
            <td>
                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <textarea class="article-input" data-index="${index}" placeholder="Paste your content here..." rows="3" style="width: 100%; margin-bottom: 5px; padding: 5px;"></textarea>
                        <div style="margin-bottom: 5px;">
                            <label style="margin-right: 10px;">
                                <input type="radio" name="imagePosition${index}" value="1" checked>
                                After 1st paragraph
                            </label>
                            <label style="margin-right: 10px;">
                                <input type="radio" name="imagePosition${index}" value="2">
                                After 2nd paragraph
                            </label>
                        </div>

                        <div>
                            <button class="btn btn-update" data-index="${index}" style="background-color: #4caf50; color: white;display:none">Update Content</button>
                            <button class="btn btn-go" data-index="${index}" style="background-color: #2196f3; color: white;">Submit</button>
                            <button class="btn btn-loading" data-index="${index}" style="background-color: #ff9800; color: white; display: none;">Loading... (3s)</button>
                        </div>
                    </div>
                    <div class="preview-content" data-index="${index}" style="flex: 1; padding: 5px; background: #f5f5f5; border-radius: 4px; font-size: 0.9em; max-height: 80px; overflow: hidden; display: none;" title=""></div>
                </div>
            </td>
        `;

    tbody.appendChild(row);

    // Add event listeners for buttons
    const editBtn = row.querySelector(".btn-edit");
    const copyBtn = row.querySelector(".btn-copy");
    const copyTitleBtn = row.querySelector(".btn-copy-title");
    const selectImageBtn = row.querySelector(".btn-select-image");
    const deleteBtn = row.querySelector(".btn-delete");
    const updateBtn = row.querySelector(".btn-update");
    const goBtn = row.querySelector(".btn-go");
    const loadingBtn = row.querySelector(".btn-loading");

    editBtn.addEventListener("click", () => openEditor(index));
    copyBtn.addEventListener("click", () => copyArticleContent(index));
    copyTitleBtn.addEventListener("click", () => copyArticleTitle(index));
    selectImageBtn.addEventListener("click", () => openImageSelector(index));
    deleteBtn.addEventListener("click", () => deleteArticle(index));
    updateBtn.addEventListener("click", () => updateArticleContent(index));
    goBtn.addEventListener("click", () => goToContentFill(index));
    loadingBtn.addEventListener("click", () => goToContentFill(index));

    // Add checkbox event listener
    const checkbox = row.querySelector(
      `.article-checkbox[data-index="${index}"]`,
    );
    checkbox.addEventListener("change", () =>
      saveCheckboxState(index, checkbox.checked),
    );

    // Add textarea event listener for auto-update
    const textarea = row.querySelector(`.article-input[data-index="${index}"]`);
    const previewDiv = row.querySelector(
      `.preview-content[data-index="${index}"]`,
    );

    // Show preview from existing article content
    if (article.description) {
      const previewText = extractTextFromHTML(article.title);
      const shortPreview =
        previewText.length > 100
          ? previewText.substring(0, 100) + "..."
          : previewText;
      previewDiv.textContent = shortPreview;
      previewDiv.title = previewText;
      previewDiv.style.display = "block";
    }

    textarea.addEventListener("input", () => {
      // Show/hide Select Images button based on content
      const selectImageBtn = row.querySelector(".btn-select-image");
      /* if (textarea.value.trim().length > 0) {
        selectImageBtn.style.display = "inline-block";
      } else {
        selectImageBtn.style.display = "none";
      } */

      // Debounce the update to avoid too frequent calls
      clearTimeout(textarea.updateTimeout);
      textarea.updateTimeout = setTimeout(() => {
        updateArticleContent(index);
      }, 1000); // Wait 1 second after user stops typing
    });
  });

  // Load checkbox states after creating all rows
  await loadCheckboxStates();

  // Load Select All state
  await loadSelectAllState();
}

// Function to save checkbox state
async function saveCheckboxState(
  index,
  isChecked,
  skipSelectAllUpdate = false,
) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  if (articlesData[index]) {
    articlesData[index].checkboxstates = isChecked;
    await chrome.storage.local.set({ xopbooArticles: articlesData });

    // Update Select All state after saving individual checkbox (unless skipped)
    if (!skipSelectAllUpdate) {
      updateSelectAllState();
    }

    // Update row completion status
    updateRowCompletionStatus();
  }
}

// Function to save Select All state
async function saveSelectAllState(isChecked) {
  await chrome.storage.local.set({ selectAllState: isChecked });
}

// Function to save global input position state
async function saveGlobalInputPositionState(isChecked) {
  await chrome.storage.local.set({ globalInputPositionBottom: isChecked });
}

// Function to load global input position state
async function loadGlobalInputPositionState() {
  const data = await chrome.storage.local.get("globalInputPositionBottom");
  const isChecked = data.globalInputPositionBottom || false;
  const checkbox = document.getElementById("globalInputPositionBottom");
  if (checkbox) {
    checkbox.checked = isChecked;
  }
}

// Function to load checkbox states
async function loadCheckboxStates() {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  articlesData.forEach((article, index) => {
    const checkbox = document.querySelector(
      `.article-checkbox[data-index="${index}"]`,
    );
    if (checkbox) {
      checkbox.checked = article.checkboxstates || false;
    }
  });

  // Update Select All state after loading all checkbox states
  updateSelectAllState();

  // Update row completion status based on checkbox states
  updateRowCompletionStatus();
}

// Function to load Select All state
async function loadSelectAllState() {
  // No need to load Select All state separately anymore
  // The updateSelectAllState function will handle it based on individual checkboxes
}

// Function to update Select All checkbox state based on individual checkboxes
function updateSelectAllState() {
  const checkboxes = document.querySelectorAll(".article-checkbox");
  const selectAllCheckbox = document.getElementById("selectAll");

  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    saveSelectAllState(false);
    return;
  }

  const checkedCount = document.querySelectorAll(
    ".article-checkbox:checked",
  ).length;
  const allChecked = checkedCount === checkboxes.length;
  const someChecked = checkedCount > 0;

  selectAllCheckbox.checked = allChecked;
  selectAllCheckbox.indeterminate = someChecked && !allChecked;

  // Save Select All state to storage
  saveSelectAllState(allChecked);
}

// Function to update row completion status based on checkbox state
function updateRowCompletionStatus() {
  const checkboxes = document.querySelectorAll(".article-checkbox");

  checkboxes.forEach((checkbox) => {
    const index = parseInt(checkbox.dataset.index);
    const row = checkbox.closest("tr");

    if (row) {
      if (checkbox.checked) {
        row.classList.add("row-completed");
      } else {
        row.classList.remove("row-completed");
      }
    }
  });
}

// Function to open editor.html for a specific article
async function openEditor(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (article) {
    // Store the selected article index
    await chrome.storage.local.set({ selectedArticleIndex: index });

    // Check the checkbox for this article
    const checkbox = document.querySelector(
      `.article-checkbox[data-index="${index}"]`,
    );
    if (checkbox) {
      checkbox.checked = true;
      await saveCheckboxState(index, true);
    }

    // Open editor.html in a new tab
    chrome.runtime.sendMessage({
      action: "openEditor",
      articleIndex: index,
    });
  }
}

// Function to delete an article
async function deleteArticle(index) {
  if (confirm("Are you sure you want to delete this article?")) {
    const articles = await chrome.storage.local.get("xopbooArticles");
    const articlesData = articles.xopbooArticles || [];

    // Remove the article at the specified index
    articlesData.splice(index, 1);

    // Save the updated articles list
    await chrome.storage.local.set({ xopbooArticles: articlesData });

    // Show toast notification
    showToast("Article deleted successfully");

    // Reload the table
    loadArticles();
  }
}

// Function to copy content of a specific article
async function copyArticleContent(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (article) {
    const extraText =
      "A long English article written in a continuous flow without paragraph breaks, in a tabloid-style tone that is sensational, emotional, and fictionalized, exactly as you requested, expanded and more profound than the original version,broken into clear paragraphs for easier reading,make the entire headline sensational";

    const content = extractTextFromHTML(article.description);
    const textToCopy = `${extraText}:\n${article.title}.${content}`;

    await copyToClipboard(textToCopy);
    showToast("Content copied to clipboard!");
  }
}

// Function to copy title of a specific article
async function copyArticleTitle(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (article) {
    await copyToClipboard(article.title);
    showToast("Title copied to clipboard!");
  }
}

// Function to copy all articles content
async function copyAllContent() {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  if (articlesData.length === 0) {
    showToast("No articles to copy!");
    return;
  }

  // Add common extra text at the beginning
  const commonExtraText =
    "A long English article written in a continuous flow without paragraph breaks, in a tabloid-style tone that is sensational, emotional, and fictionalized, exactly as you requested, expanded and more profound than the original version,broken into clear paragraphs for easier reading,make the entire headline sensational for separate articles, approximately 1200 words per article:";

  const allContent = articlesData
    .map((article) => {
      const extraText = "";
      const content = extractTextFromHTML(article.description);
      return `${extraText}${article.title}.${content}`;
    })
    .join("\n\n-------------------\n\n");

  const finalContent = `${commonExtraText}\n\n${allContent}`;

  await copyToClipboard(finalContent);
  showToast("All content copied to clipboard!");
}

// Function to copy all article titles
async function copyAllTitles() {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  if (articlesData.length === 0) {
    showToast("No articles to copy!");
    return;
  }

  const allTitles = articlesData.map((article) => article.title).join("\n");

  await copyToClipboard(allTitles);
  showToast("All titles copied to clipboard!");
}

// Function to extract text from HTML
function extractTextFromHTML(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Remove any img and iframe elements
  const imgs = tempDiv.getElementsByTagName("img");
  const iframes = tempDiv.getElementsByTagName("iframe");

  while (imgs.length > 0) {
    imgs[0].parentNode.removeChild(imgs[0]);
  }
  while (iframes.length > 0) {
    iframes[0].parentNode.removeChild(iframes[0]);
  }

  return tempDiv.innerText.trim();
}

// Function to extract names from text
function extractNames(text) {
  // Create a temporary div to get text without HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = text;
  const articleText = tempDiv.textContent;
  const htmlContent = text;

  let players = "";
  const playersMatch = htmlContent.match(
    /(?:<[^>]+>Players:<\/[^>]+>|Players:)\s*([^<\n]+)/i,
  );
  if (playersMatch) {
    players = playersMatch[1].trim();
  }

  let team = "";
  const teamMatch = htmlContent.match(
    /(?:<[^>]+>Team:<\/[^>]+>|Team:)\s*([^<\n]+)/i,
  );
  if (teamMatch) {
    team = teamMatch[1].trim();
  }

  if (players) {
    return players
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  }

  // Use NLP to find names in article as fallback
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const people = articleText.match(nameRegex);

  if (people) {
    // Only take names with exactly 2 words
    const twoWordNames = people
      .map((name) => name.trim())
      .filter(
        (name) =>
          !/[\+\-－]/.test(name) && // No special characters
          !/please/i.test(name), // Don't include "please"
      );

    // Remove duplicates
    const uniqueNames = [...new Set(twoWordNames)];

    // Title case each word
    const titleCaseNames = uniqueNames.map((name) =>
      name
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    );

    return titleCaseNames;
  }

  return [];
}

// Function to generate HTML for names with search functionality
function generateNamesHTML(text) {
  const names = extractNames(text);
  if (names.length === 0) {
    return '<span style="color: #999; font-size: 11px;">No names found</span>';
  }

  // Remove duplicate names (case-insensitive)
  const uniqueNames = [];
  const seen = new Set();
  for (const name of names) {
    const lowerName = name.toLowerCase().trim();
    if (!seen.has(lowerName) && lowerName.length > 0) {
      seen.add(lowerName);
      uniqueNames.push(name);
    }
  }

  return (
    uniqueNames
      .slice(0, 5) // Limit to first 5 names
      .map(
        (name) =>
          `<span class="name-tag" data-search-term="${encodeURIComponent(
            name,
          )}">${name}</span>`,
      )
      .join("") +
    (uniqueNames.length > 5
      ? `<span style="color: #999; font-size: 10px;"> +${
          uniqueNames.length - 5
        } more</span>`
      : "")
  );
}

// Function to copy selected articles
async function copySelectedContent() {
  const checkboxes = document.querySelectorAll(".article-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("No articles selected!");
    return;
  }

  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  const selectedArticles = Array.from(checkboxes)
    .map((checkbox) => articlesData[parseInt(checkbox.dataset.index)])
    .filter(Boolean);

  if (selectedArticles.length === 0) {
    showToast("No valid articles found!");
    return;
  }

  const commonExtraText =
    "A long English article written in a continuous flow without paragraph breaks, in a tabloid-style tone that is sensational, emotional, and fictionalized, exactly as you requested, expanded and more profound than the original version,broken into clear paragraphs for easier reading,make the entire headline sensational for separate articles, approximately 1200 words per article:";

  const selectedContent = selectedArticles
    .map((article) => {
      const content = extractTextFromHTML(article.description);
      return `${article.title}.${content}`;
    })
    .join("\n\n-------------------\n\n");

  const finalContent = `${commonExtraText}\n\n${selectedContent}`;
  await copyToClipboard(finalContent);
  showToast("Selected content copied to clipboard!");
}

// Function to copy selected article titles
async function copySelectedTitles() {
  const checkboxes = document.querySelectorAll(".article-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("No articles selected!");
    return;
  }

  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];

  const selectedArticles = Array.from(checkboxes)
    .map((checkbox) => articlesData[parseInt(checkbox.dataset.index)])
    .filter(Boolean);

  if (selectedArticles.length === 0) {
    showToast("No valid articles found!");
    return;
  }

  const selectedTitles = selectedArticles
    .map((article) => article.title)
    .join("\n");

  await copyToClipboard(selectedTitles);
  showToast("Selected titles copied to clipboard!");
}

// Function to delete selected articles
async function deleteSelectedArticles() {
  const checkboxes = document.querySelectorAll(".article-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("No articles selected!");
    return;
  }

  if (
    confirm(
      `Are you sure you want to delete ${checkboxes.length} selected articles?`,
    )
  ) {
    const articles = await chrome.storage.local.get("xopbooArticles");
    let articlesData = articles.xopbooArticles || [];

    // Get indices to delete
    const indicesToDelete = new Set(
      Array.from(checkboxes)
        .map((checkbox) => parseInt(checkbox.dataset.index))
        .filter((index) => !isNaN(index)),
    );

    // Filter out deleted articles
    articlesData = articlesData.filter(
      (_, index) => !indicesToDelete.has(index),
    );

    // Save the updated articles list
    await chrome.storage.local.set({ xopbooArticles: articlesData });

    // Show success message
    showToast(`${checkboxes.length} articles have been deleted`);

    // Reload the table
    loadArticles();
  }
}

// Helper function to copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

// Function to move image after specific paragraph
function moveImageAfterParagraph(description, paragraphNumber) {
  // Tách nội dung thành các phần: paragraphs và image
  const imgRegex = /<img[^>]*>/;
  const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>|<iframe[^>]*>/gi;
  const sourceRegex =
    /<p>\s*<strong>\s*Source\s*:\s*YouTube\s*<\/strong>\s*<\/p>|<strong>\s*Source\s*:\s*YouTube\s*<\/strong>/gi;

  const imgMatch = description.match(imgRegex);
  const imgTag = imgMatch ? imgMatch[0] : "";

  // Loại bỏ img, iframe và Source info từ nội dung
  let cleanedDescription = description
    .replace(imgRegex, "")
    .replace(iframeRegex, "")
    .replace(sourceRegex, "");

  // Tìm tất cả các đoạn văn
  const paragraphs = cleanedDescription.match(/<p>.*?<\/p>/g) || [];
  // Nếu không đủ số đoạn văn yêu cầu và có ảnh, trả về nguyên bản
  if (imgTag && paragraphs.length < paragraphNumber) {
    return description;
  }
  // Tạo mảng mới chứa các đoạn văn với ảnh được chèn vào vị trí mong muốn
  const result = [];
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i]);
    if (i + 1 === paragraphNumber && imgTag) {
      result.push(`<p>${imgTag}</p>`);
    }
  }
  // Thêm iframe vào cuối nếu có
  return result.join("");
}

// Function to update article content
async function updateArticleContent(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (article) {
    const textarea = document.querySelector(
      `.article-input[data-index="${index}"]`,
    );
    const previewDiv = document.querySelector(
      `.preview-content[data-index="${index}"]`,
    );
    const newInput = textarea.value.trim();

    if (!newInput) {
      showToast("Please enter some content first!");
      return;
    }

    // Process newInput: split into lines and wrap in <p> tags (except first line which is title)
    const lines = newInput.split("\n").filter((line) => line.trim().length > 0);
    const title = lines[0].trim();
    const contentLines = lines.slice(1);

    let newInputHtml = contentLines
      .map((line) => `<p>${line.trim()}</p>`)
      .join("");

    // Check if article.description contains the title and remove it
    let cleanedDescription = article.description;
    if (article.description.includes(article.title)) {
      cleanedDescription = article.description
        .replace(article.title, "")
        .trim();
    }

    // Check if new content should be at bottom (Global Setting)
    const globalCheckbox = document.getElementById("globalInputPositionBottom");
    const isNewContentAtBottom = globalCheckbox
      ? globalCheckbox.checked
      : false;

    // Combine newInput HTML with cleaned description based on checkbox
    let updatedHtml = isNewContentAtBottom
      ? cleanedDescription + newInputHtml
      : newInputHtml + cleanedDescription;

    // Get selected image position
    const selectedPosition = parseInt(
      document.querySelector(`input[name="imagePosition${index}"]:checked`)
        .value,
    );

    // Move image to selected position
    const remainingHtml = moveImageAfterParagraph(
      updatedHtml,
      selectedPosition,
    );

    // Update the article's title and description
    article.title = title;
    article.description = remainingHtml;
    articlesData[index] = article;
    // Save back to storage
    await chrome.storage.local.set({ xopbooArticles: articlesData });

    // Show preview (first 100 characters + "..." if longer)
    const previewText = extractTextFromHTML(updatedHtml);
    const shortPreview =
      previewText.length > 100
        ? previewText.substring(0, 100) + "..."
        : previewText;
    previewDiv.textContent = shortPreview;
    previewDiv.title = previewText; // Set full content as tooltip
    previewDiv.style.display = "block";

    // Clear the textarea
    textarea.value = "";

    // Show success message
    showToast("Content updated successfully!");
  }
}

// Function to navigate to content-fill.js
async function goToContentFill(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (article) {
    const textarea = document.querySelector(
      `.article-input[data-index="${index}"]`,
    );
    const newInput = textarea.value.trim();

    if (newInput) {
      // If there's new input, update the content first
      // Check if new content should be at bottom
      const globalCheckbox = document.getElementById(
        "globalInputPositionBottom",
      );
      const isNewContentAtBottom = globalCheckbox
        ? globalCheckbox.checked
        : false;

      // Check if article.description contains the title and remove it
      let cleanedDescription = article.description;
      const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>|<iframe[^>]*>/gi;
      const sourceRegex =
        /<p>\s*<strong>\s*Source\s*:\s*YouTube\s*<\/strong>\s*<\/p>|<strong>\s*Source\s*:\s*YouTube\s*<\/strong>/gi;

      cleanedDescription = cleanedDescription
        .replace(iframeRegex, "")
        .replace(sourceRegex, "");

      if (cleanedDescription.includes(article.title)) {
        cleanedDescription = cleanedDescription
          .replace(article.title, "")
          .trim();
      }

      // Combine content based on checkbox position
      let combinedContent = isNewContentAtBottom
        ? cleanedDescription + "\n" + newInput
        : newInput + "\n" + cleanedDescription;

      let updatedHtml = combinedContent;
      updatedHtml = updatedHtml
        .split("\n")
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("");

      // Add image if exists (but NO iframe)
      if (article.image) {
        updatedHtml += `<img src="${article.image}" class="media-preview" alt="Preview">`;
      }

      // Update the article's title and description
      article.title = title;
      article.description = updatedHtml;
      articlesData[index] = article;
      // Save back to storage
      await chrome.storage.local.set({ xopbooArticles: articlesData });

      // Reload the table to reflect changes
      loadArticles();
    } else {
      // If no new input, just copy the existing content
      if (article.image && !article.description.includes(article.image)) {
        const imageTag = `<img src="${article.image}" class="media-preview" alt="Preview">`;
        const firstParagraphEnd = article.description.indexOf("</p>");
        if (firstParagraphEnd !== -1) {
          const insertPosition = firstParagraphEnd + "</p>".length;
          article.description =
            article.description.slice(0, insertPosition) +
            imageTag +
            article.description.slice(insertPosition);
        } else {
          const firstNewline = article.description.indexOf("\n");
          if (firstNewline !== -1) {
            const insertPosition = firstNewline + 1;
            article.description =
              article.description.slice(0, insertPosition) +
              imageTag +
              article.description.slice(insertPosition);
          } else {
            article.description += imageTag;
          }
        }

        // Remove iframes and source info from description
        const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>|<iframe[^>]*>/gi;
        const sourceRegex =
          /<p>\s*<strong>\s*Source\s*:\s*YouTube\s*<\/strong>\s*<\/p>|<strong>\s*Source\s*:\s*YouTube\s*<\/strong>/gi;
        article.description = article.description
          .replace(iframeRegex, "")
          .replace(sourceRegex, "");

        articlesData[index] = article;
        await chrome.storage.local.set({ xopbooArticles: articlesData });
      } else {
        // Even if no image to add, still remove iframes and source info
        const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>|<iframe[^>]*>/gi;
        const sourceRegex =
          /<p>\s*<strong>\s*Source\s*:\s*YouTube\s*<\/strong>\s*<\/p>|<strong>\s*Source\s*:\s*YouTube\s*<\/strong>/gi;

        if (
          iframeRegex.test(article.description) ||
          sourceRegex.test(article.description)
        ) {
          article.description = article.description
            .replace(iframeRegex, "")
            .replace(sourceRegex, "");
          articlesData[index] = article;
          await chrome.storage.local.set({ xopbooArticles: articlesData });
        }
      }
      loadArticles();
    }

    // Send message to update content and open content-fill.js
    chrome.runtime.sendMessage({
      type: "UPDATE_CONTENT",
      sourceTabId: article.tabId,
      content: {
        title: article.title,
        description: article.description,
        image: article.image,
        videoUrl: article.videoUrl,
      },
    });

    // Check the checkbox for this article
    const checkbox = document.querySelector(
      `.article-checkbox[data-index="${index}"]`,
    );
    if (checkbox) {
      checkbox.checked = true;
      await saveCheckboxState(index, true);
    }

    // Show feedback
    showToast("Content copied! Opening content-fill.js...");
  }
}

// Function to open image selector modal
async function openImageSelector(index) {
  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[index];

  if (!article) return;

  // Get the textarea content to extract names
  const textarea = document.querySelector(
    `.article-input[data-index="${index}"]`,
  );
  const newInput = textarea.value.trim();

  // Extract names from the article content
  const names = extractNames(article.description);

  // Extract team from the article content
  let team = "";
  const teamMatch = article.description.match(
    /(?:<[^>]+>Team:<\/[^>]+>|Team:)\s*([^<\n]+)/i,
  );
  if (teamMatch) {
    team = teamMatch[1].trim();
  }

  // Create modal HTML
  const modalHTML = `
    <div id="imageSelectorModal" class="modal" style="display: block;">
      <div class="modal-content" style="width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>Select Images for Article</h2>
          <span class="close" id="closeImageSelector">&times;</span>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label for="characterSelect">Select Character:</label>
            <select id="characterSelect" style="width: 200px; padding: 5px; margin-left: 10px;">
              ${names.length > 0 ? "" : '<option value="">Choose a character...</option>'}
              ${names
                .map(
                  (name, i) =>
                    `<option value="${name}" ${i === 0 ? "selected" : ""}>${name}</option>`,
                )
                .join("")}
            </select>
            <input type="text" id="customCharacterInput" value="${team}" placeholder="Or enter custom name..." style="width: 200px; padding: 5px; margin-left: 10px;">
            <button id="searchImagesBtn" style="margin-left: 10px; padding: 5px 15px; background-color: #2196f3; color: white; border: none; border-radius: 4px;">Search Images</button>
          </div>
          <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
            <label for="customImageUrl" style="display: block; margin-bottom: 8px; font-weight: bold;">Or paste custom image URL:</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="text" id="customImageUrl" placeholder="https://example.com/image.jpg" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <button id="addCustomImageBtn" style="padding: 8px 20px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Add Image</button>
            </div>
          </div>
          <div id="searchInfo" style="margin-bottom: 15px; padding: 10px; background-color: #e3f2fd; border-radius: 4px; font-family: Arial, sans-serif; display: none;">
            <!-- Search info will be displayed here -->
          </div>
          <div id="imageResults" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
            <!-- Images will be loaded here -->
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button id="completeImageSelection" style="padding: 10px 30px; background-color: #4caf50; color: white; border: none; border-radius: 4px; font-size: 16px;" disabled>Complete Selection</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to page
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Store current article index for later use
  window.currentArticleIndex = index;
  window.selectedImages = [];
  window.searchAttemptCount = 0;

  // Add event listeners
  document
    .getElementById("searchImagesBtn")
    .addEventListener("click", () => {
      window.searchAttemptCount = 0;
      searchImages();
    });
  document
    .getElementById("characterSelect")
    .addEventListener("change", () => {
      window.searchAttemptCount = 0;
      searchImages();
    });
  document
    .getElementById("completeImageSelection")
    .addEventListener("click", completeImageSelection);
  document
    .getElementById("closeImageSelector")
    .addEventListener("click", () => closeImageSelector(true));
  document
    .getElementById("addCustomImageBtn")
    .addEventListener("click", addCustomImage);
  // Allow Enter key to add custom image
  document
    .getElementById("customImageUrl")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addCustomImage();
      }
    });

  // Auto-search if a character/player is selected or custom name is provided
  const characterSelect = document.getElementById("characterSelect");
  const customInput = document.getElementById("customCharacterInput");
  if (
    (characterSelect && characterSelect.value) ||
    (customInput && customInput.value.trim())
  ) {
    searchImages();
  }
}

// Function to close image selector modal
function closeImageSelector(isManual = false) {
  if (window.autoCompleteTimeout) {
    clearTimeout(window.autoCompleteTimeout);
    window.autoCompleteTimeout = null;
  }
  const modal = document.getElementById("imageSelectorModal");
  if (modal) {
    modal.remove();
  }

  if (isManual === true && window.isAutoSelecting) {
    window.isAutoSelecting = false;
    window.autoSelectQueue = [];
    showToast("Auto image selection stopped.");
  }
}

// Function to search images using Google Custom Search API
async function searchImages() {
  if (window.autoCompleteTimeout) {
    clearTimeout(window.autoCompleteTimeout);
    window.autoCompleteTimeout = null;
  }
  const characterSelect = document.getElementById("characterSelect");
  const customInput = document.getElementById("customCharacterInput");

  // Combine both values for search query
  const selectValue = characterSelect.value.trim();
  const inputValue = customInput.value.trim();

  let query = "";
  if (selectValue && inputValue) {
    query = `${selectValue} ${inputValue}`;
  } else if (selectValue) {
    query = selectValue;
  } else if (inputValue) {
    query = inputValue;
  }

  if (!query) {
    alert("Choose a character or enter a custom name");
    return;
  }

  // Show search info
  const searchInfo = document.getElementById("searchInfo");
  searchInfo.innerHTML = `You are searching for images with the name: <strong>${query}</strong>`;
  searchInfo.style.display = "block";

  // Show loading state
  const container = document.getElementById("imageResults");
  const searchBtn = document.getElementById("searchImagesBtn");

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #666; font-family: Arial, sans-serif;">
      <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2196f3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
  `;

  // Disable search button during loading
  searchBtn.disabled = true;
  searchBtn.textContent = "Loading...";

  const apiKeys = [
    "AIzaSyAVLBtx1e1Pwfpc4K6C88iueJb_PcDsyoA",
    "AIzaSyC9oUJ3JA2-V8sdtARDoYRwr3S8mU0bseA",
    "AIzaSyDZ9knSYUMDMjhw2kylyq9rkKKINtO3QuQ",
    "AIzaSyAZvtBX00nG9sNpftlfmviTDOc60NJ8NXw",
    "AIzaSyCeX0EUr-G9U-UTUWfjIJkOjTAxbOSYdcs",
    // Add more keys below to enable automatic fallback when a key is over quota/invalid
    // "YOUR_SECOND_KEY",
    // "YOUR_THIRD_KEY",
  ];
  const cx = "c2c2a230058284516";
  window.searchAttemptCount = (window.searchAttemptCount || 0) + 1;
  const start = window.searchAttemptCount === 1 ? (Math.floor(Math.random() * 9) * 10 + 1) : 1;

  const buildUrl = (key) =>
    `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query + " person",
    )}&cx=${cx}&key=${key}&searchType=image&num=5&start=${start}&imgSize=xlarge&imgType=face&safe=active`;

  try {
    let data = null;

    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      try {
        const res = await fetch(buildUrl(currentKey));
        const json = await res.json();

        // If success and no API error payload, accept this response
        if (res.ok && !json.error) {
          data = json;
          break;
        }

        // If there's an API error (quota exceeded, invalid key, etc.), try next key
        const reason =
          (json &&
            json.error &&
            json.error.errors &&
            json.error.errors[0] &&
            json.error.errors[0].reason) ||
          (json && json.error && json.error.status) ||
          "unknown_error";
        console.warn(
          `Google CSE key failed (index ${i}) with reason: ${reason}`,
        );
        // Continue to next key
      } catch (e) {
        console.warn(`Fetch failed using key index ${i}:`, e);
        // Try next key
      }
    }

    if (!data) {
      container.innerHTML =
        '<div style="text-align: center; padding: 40px; color: #f44336; font-family: Arial, sans-serif; font-size: 16px;">Tất cả API key đều lỗi hoặc hết hạn/quota. Vui lòng thêm API key khác.</div>';
      return;
    }

    container.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      if (window.selectedImages.length < 2 && window.searchAttemptCount < 2) {
        console.log("No images found in results. Retrying with page 1...");
        searchImages();
        return;
      }
      container.innerHTML =
        '<div style="text-align: center; padding: 40px; color: #666; font-family: Arial, sans-serif; font-size: 16px;">Không tìm thấy ảnh.</div>';
      return;
    }

    let processedCount = 0;
    const totalItems = data.items.length;

    const checkAllProcessed = () => {
      processedCount++;
      if (processedCount === totalItems) {
        // All images have finished loading or failed.
        if (window.selectedImages.length < 2) {
          // If we haven't found 2 images yet and this was the first attempt,
          // try searching again with page 1 (start = 1).
          if (window.searchAttemptCount < 2) {
            console.log("Only found " + window.selectedImages.length + " images. Retrying with page 1...");
            searchImages();
            return;
          }

          // Otherwise (second attempt failed to find 2 images too), complete with whatever we have (at least 1)
          if (window.selectedImages.length > 0) {
            if (window.autoCompleteTimeout) {
              clearTimeout(window.autoCompleteTimeout);
            }
            window.autoCompleteTimeout = setTimeout(() => {
              const modal = document.getElementById("imageSelectorModal");
              if (modal && window.selectedImages.length > 0) {
                completeImageSelection();
              }
            }, 1500);
          }
        }
      }
    };

    data.items.forEach((item) => {
      const img = new Image();
      img.src = item.link;
      img.alt = item.title;

      img.onload = () => {
        try {
          if (img.naturalWidth >= 700) {
            const imageContainer = document.createElement("div");
            imageContainer.className = "image-container";
            imageContainer.style.cssText = `
              border: 2px solid #ddd;
              border-radius: 8px;
              padding: 10px;
              text-align: center;
              cursor: pointer;
              transition: border-color 0.3s;
            `;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = item.link;
            checkbox.style.marginBottom = "10px";

            // Function to update UI based on selection state
            const updateUIState = () => {
              const completeBtn = document.getElementById(
                "completeImageSelection",
              );
              if (completeBtn) {
                completeBtn.disabled = window.selectedImages.length === 0;
              }
            };

            checkbox.addEventListener("change", () => {
              if (window.autoCompleteTimeout) {
                clearTimeout(window.autoCompleteTimeout);
                window.autoCompleteTimeout = null;
              }
              if (checkbox.checked) {
                // Determine if we can select
                if (window.selectedImages.length >= 2) {
                  alert("You can only select up to 2 images");
                  checkbox.checked = false; // Revert
                  return;
                }

                // Add to selection
                imageContainer.classList.add("selected");
                imageContainer.style.borderColor = "#2196f3";
                window.selectedImages.push(item.link);
              } else {
                // Remove from selection
                imageContainer.classList.remove("selected");
                imageContainer.style.borderColor = "#ddd";
                window.selectedImages = window.selectedImages.filter(
                  (img) => img !== item.link,
                );
              }
              updateUIState();
            });

            img.style.cssText = `
              max-width: 100%;
              height: auto;
              border-radius: 4px;
            `;

            // Add click handler to imageContainer
            imageContainer.addEventListener("click", (e) => {
              if (window.autoCompleteTimeout) {
                clearTimeout(window.autoCompleteTimeout);
                window.autoCompleteTimeout = null;
              }
              // Don't trigger if clicking directly on checkbox (handled by change event)
              if (e.target !== checkbox) {
                const isSelected =
                  imageContainer.classList.contains("selected");

                if (isSelected) {
                  // Deselect
                  checkbox.checked = false;
                  imageContainer.classList.remove("selected");
                  imageContainer.style.borderColor = "#ddd";
                  window.selectedImages = window.selectedImages.filter(
                    (img) => img !== item.link,
                  );
                } else {
                  // Select
                  if (window.selectedImages.length >= 2) {
                    alert("You can only select up to 2 images");
                    return;
                  }

                  checkbox.checked = true;
                  imageContainer.classList.add("selected");
                  imageContainer.style.borderColor = "#2196f3";
                  window.selectedImages.push(item.link);
                }
                updateUIState();
              }
            });

            // Ensure imageContainer exists before appending
            if (imageContainer) {
              imageContainer.appendChild(checkbox);
              imageContainer.appendChild(img);
              container.appendChild(imageContainer);

              // Automatically select the first 2 valid images that load
              if (window.selectedImages.length < 2) {
                checkbox.checked = true;
                imageContainer.classList.add("selected");
                imageContainer.style.borderColor = "#2196f3";
                window.selectedImages.push(item.link);
                updateUIState();

                // If exactly 2 images are loaded and selected, auto-complete after 1.5 seconds
                if (window.selectedImages.length === 2) {
                  window.autoCompleteTimeout = setTimeout(() => {
                    const modal = document.getElementById("imageSelectorModal");
                    if (modal && window.selectedImages.length === 2) {
                      completeImageSelection();
                    }
                  }, 1500);
                }
              }
            }
          } else {
            console.warn("Ảnh nhỏ hơn 700px, bỏ qua:", item.link);
          }
        } catch (error) {
          console.error("Error processing image:", error);
        } finally {
          checkAllProcessed();
        }
      };
      img.onerror = () => {
        console.warn("Ảnh lỗi, bỏ qua:", item.link);
        checkAllProcessed();
      };
    });
  } catch (err) {
    console.error(err);
    document.getElementById("imageResults").innerHTML =
      '<div style="text-align: center; padding: 40px; color: #f44336; font-family: Arial, sans-serif; font-size: 16px;">Có lỗi xảy ra khi tìm ảnh.</div>';
  } finally {
    // Restore button state
    searchBtn.disabled = false;
    searchBtn.textContent = "Search Images";
  }
}

// Function to add custom image from URL
function addCustomImage() {
  if (window.autoCompleteTimeout) {
    clearTimeout(window.autoCompleteTimeout);
    window.autoCompleteTimeout = null;
  }
  const customUrlInput = document.getElementById("customImageUrl");
  const imageUrl = customUrlInput.value.trim();

  if (!imageUrl) {
    alert("Please enter an image URL");
    return;
  }

  // Validate URL format
  try {
    new URL(imageUrl);
  } catch (e) {
    alert("Please enter a valid URL");
    return;
  }

  const container = document.getElementById("imageResults");
  const addBtn = document.getElementById("addCustomImageBtn");

  // Show loading state
  const loadingIndicator = document.createElement("div");
  loadingIndicator.style.cssText = `
    text-align: center;
    padding: 20px;
    color: #666;
    font-family: Arial, sans-serif;
    grid-column: 1 / -1;
  `;
  loadingIndicator.textContent = "Loading image...";
  container.appendChild(loadingIndicator);

  // Disable button during loading
  addBtn.disabled = true;
  addBtn.textContent = "Loading...";

  // Create image element to validate and load
  const img = new Image();

  img.onload = () => {
    try {
      // Remove loading indicator
      if (loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }

      // Check if image is at least 700px wide (same as search images)
      if (img.naturalWidth >= 200) {
        // Check if image already exists in container
        const existingImages = container.querySelectorAll("img");
        let imageExists = false;
        existingImages.forEach((existingImg) => {
          if (existingImg.src === imageUrl) {
            imageExists = true;
          }
        });

        if (imageExists) {
          alert("This image is already added");
          addBtn.disabled = false;
          addBtn.textContent = "Add Image";
          return;
        }

        // Create image container (same structure as search images)
        const imageContainer = document.createElement("div");
        imageContainer.className = "image-container";
        imageContainer.style.cssText = `
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.3s;
        `;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = imageUrl;
        checkbox.style.marginBottom = "10px";

        // Check if image is already selected
        if (window.selectedImages.includes(imageUrl)) {
          checkbox.checked = true;
          imageContainer.classList.add("selected");
          imageContainer.style.borderColor = "#2196f3";
        }

        checkbox.addEventListener("change", () => {
          // Toggle selection
          if (imageContainer.classList.contains("selected")) {
            // Deselect
            imageContainer.classList.remove("selected");
            imageContainer.style.borderColor = "#ddd";
            window.selectedImages = window.selectedImages.filter(
              (img) => img !== imageUrl,
            );
          } else {
            // Select (max 2 images)
            if (window.selectedImages.length >= 2) {
              alert("You can only select up to 2 images");
              checkbox.checked = false;
              return;
            }

            imageContainer.classList.add("selected");
            imageContainer.style.borderColor = "#2196f3";
            window.selectedImages.push(imageUrl);
          }

          // Enable/disable complete button
          const completeBtn = document.getElementById("completeImageSelection");
          if (completeBtn) {
            completeBtn.disabled = window.selectedImages.length === 0;
          }
        });

        // Create a new img element for display (clone the loaded image)
        const displayImg = document.createElement("img");
        displayImg.src = imageUrl;
        displayImg.alt = "Custom image";
        displayImg.style.cssText = `
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        `;

        // Add click handler to imageContainer to toggle checkbox
        imageContainer.addEventListener("click", (e) => {
          // Don't trigger if clicking directly on checkbox
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            // Trigger the change event to run the existing logic
            checkbox.dispatchEvent(new Event("change"));
          }
        });

        imageContainer.appendChild(checkbox);
        imageContainer.appendChild(displayImg);
        container.appendChild(imageContainer);

        // Automatically select the newly added custom image if we have slots open
        if (
          window.selectedImages.length < 2 &&
          !window.selectedImages.includes(imageUrl)
        ) {
          checkbox.checked = true;
          imageContainer.classList.add("selected");
          imageContainer.style.borderColor = "#2196f3";
          window.selectedImages.push(imageUrl);
          const completeBtn = document.getElementById("completeImageSelection");
          if (completeBtn) {
            completeBtn.disabled = false;
          }
        }

        // Clear input field after successful addition
        customUrlInput.value = "";

        // Show success message
        const successMsg = document.createElement("div");
        successMsg.style.cssText = `
          text-align: center;
          padding: 10px;
          color: #4caf50;
          font-family: Arial, sans-serif;
          grid-column: 1 / -1;
          margin-bottom: 10px;
        `;
        successMsg.textContent = "✓ Image added successfully!";
        container.insertBefore(successMsg, imageContainer);

        // Remove success message after 3 seconds
        setTimeout(() => {
          if (successMsg.parentNode) {
            successMsg.remove();
          }
        }, 3000);
      } else {
        // Remove loading indicator
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
        alert(
          `Image is too small (${img.naturalWidth}px). Minimum width is 200px.`,
        );
      }
    } catch (error) {
      console.error("Error processing custom image:", error);
      if (loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }
      alert("Error processing image. Please try again.");
    } finally {
      // Restore button state
      addBtn.disabled = false;
      addBtn.textContent = "Add Image";
    }
  };

  img.onerror = () => {
    // Remove loading indicator
    if (loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }
    alert("Failed to load image. Please check the URL and try again.");
    // Restore button state
    addBtn.disabled = false;
    addBtn.textContent = "Add Image";
  };

  // Start loading the image
  img.src = imageUrl;
}

// Function to show loading countdown and trigger goBtn after 5 seconds
function startLoadingCountdown(index) {
  // Wait a bit for the table to reload, then find the buttons
  setTimeout(() => {
    const goBtn = document.querySelector(`.btn-go[data-index="${index}"]`);
    const loadingBtn = document.querySelector(
      `.btn-loading[data-index="${index}"]`,
    );

    if (!goBtn || !loadingBtn) {
      console.warn(`Could not find buttons for index ${index}`);
      return;
    }

    // Hide goBtn and show loadingBtn
    goBtn.style.display = "none";
    loadingBtn.style.display = "inline-block";

    let countdown = 1;
    loadingBtn.textContent = `Loading... (${countdown}s)`;

    const interval = setInterval(() => {
      countdown--;
      loadingBtn.textContent = `Loading... (${countdown}s)`;

      if (countdown <= 0) {
        clearInterval(interval);
        // Hide loadingBtn and show goBtn
        loadingBtn.style.display = "none";
        goBtn.style.display = "inline-block";
        // Trigger goBtn click
        goBtn.click();
      }
    }, 1000);
  }, 300); // Wait 300ms for table reload
}

// Bulk Paste Functions
function openBulkPasteModal() {
  const modal = document.getElementById("bulkPasteModal");
  modal.style.display = "block";

  // Focus on textarea after modal is rendered
  setTimeout(() => {
    const textarea = document.getElementById("bulkPasteTextarea");
    if (textarea) {
      textarea.focus();
    }
  }, 100);

  // Add keyboard event listener for ESC key
  document.addEventListener("keydown", handleBulkPasteKeydown);

  // Add click outside to close
  modal.addEventListener("click", handleBulkPasteBackdropClick);
}

function closeBulkPasteModal() {
  const modal = document.getElementById("bulkPasteModal");
  modal.style.display = "none";

  // Clear textarea
  const textarea = document.getElementById("bulkPasteTextarea");
  textarea.value = "";

  // Remove event listeners
  document.removeEventListener("keydown", handleBulkPasteKeydown);
  modal.removeEventListener("click", handleBulkPasteBackdropClick);
}

// Handle ESC key to close modal
function handleBulkPasteKeydown(event) {
  if (event.key === "Escape") {
    closeBulkPasteModal();
  }
}

// Handle click outside modal content to close
function handleBulkPasteBackdropClick(event) {
  const modalContent = document.querySelector(".bulk-paste-content");
  if (
    event.target === event.currentTarget &&
    !modalContent.contains(event.target)
  ) {
    closeBulkPasteModal();
  }
}

async function performBulkPaste() {
  const textarea = document.getElementById("bulkPasteTextarea");
  const content = textarea.value.trim();

  if (!content) {
    showToast("Please paste some content first!");
    return;
  }

  // Split content by double line breaks to separate articles
  const articles = content
    .split(/\n\s*\n/)
    .filter((article) => article.trim().length > 0);

  if (articles.length === 0) {
    showToast("No valid articles found!");
    return;
  }

  // Get all available article input textareas
  const articleInputs = document.querySelectorAll(".article-input");

  if (articleInputs.length === 0) {
    showToast("No article inputs found!");
    return;
  }

  // Determine how many articles to paste
  const maxArticles = Math.min(articles.length, articleInputs.length);
  let pastedCount = 0;

  // Paste articles into available inputs
  for (let i = 0; i < maxArticles; i++) {
    const articleInput = articleInputs[i];
    const articleContent = articles[i].trim();

    // Only paste if the input is empty or user confirms overwrite
    if (
      articleInput.value.trim() === "" ||
      confirm(`Article input ${i + 1} already has content. Overwrite?`)
    ) {
      articleInput.value = articleContent;

      // Get the article index from the data-index attribute
      const articleIndex = parseInt(articleInput.getAttribute("data-index"));

      // Clear any existing timeout for this textarea to prevent conflicts
      clearTimeout(articleInput.updateTimeout);

      // Directly call updateArticleContent with a small delay to avoid conflicts
      setTimeout(() => {
        updateArticleContent(articleIndex);
      }, i * 200); // Stagger the updates to avoid conflicts

      pastedCount++;
    }
  }

  // Close modal
  closeBulkPasteModal();

  // Show success message
  if (pastedCount > 0) {
    showToast(
      `Successfully pasted ${pastedCount} article${pastedCount > 1 ? "s" : ""}!`,
    );

    if (articles.length > articleInputs.length) {
      setTimeout(() => {
        showToast(
          `Note: ${articles.length - articleInputs.length} article${
            articles.length - articleInputs.length > 1 ? "s" : ""
          } could not be pasted (not enough inputs available)`,
        );
      }, 2000);
    }
  } else {
    showToast("No articles were pasted.");
  }
}

// Function to close all tabs with http://localhost:3000/ URL
async function closeAllXopbooTabs() {
  try {
    // Query all tabs with URL matching http://localhost:3000/*
    const tabs = await chrome.tabs.query({
      url: "http://localhost:3000/*",
    });

    if (tabs.length === 0) {
      showToast("No wp.xopboo.com tabs are currently open");
      return;
    }

    // Close all matching tabs
    const tabIds = tabs.map((tab) => tab.id);
    await chrome.tabs.remove(tabIds);

    showToast(
      `Closed ${tabs.length} wp.xopboo.com tab${tabs.length > 1 ? "s" : ""}`,
    );
  } catch (error) {
    console.error("Error closing tabs:", error);
    showToast("Error occurred while closing tabs");
  }
}

// Function to complete image selection
async function completeImageSelection() {
  if (window.selectedImages.length === 0) {
    alert("Choose Images");
    return;
  }

  const articles = await chrome.storage.local.get("xopbooArticles");
  const articlesData = articles.xopbooArticles || [];
  const article = articlesData[window.currentArticleIndex];

  if (!article) return;

  // Get the textarea content
  const textarea = document.querySelector(
    `.article-input[data-index="${window.currentArticleIndex}"]`,
  );

  // Use existing article content instead of replacing it
  let existingContent = article.description;

  // Extract iframes first to preserve them
  const iframeRegex = /<iframe[^>]*>.*?<\/iframe>/g;
  const iframes = existingContent.match(iframeRegex) || article.iframe;
  console.log(iframes);
  // Remove iframes temporarily to process paragraphs
  let contentWithoutIframes = existingContent.replace(iframeRegex, "");

  // Split content into paragraphs
  const paragraphs = contentWithoutIframes.match(/<p>.*?<\/p>/g) || [];

  // If we don't have enough paragraphs, create them from the textarea content
  const newInput = textarea ? textarea.value.trim() : "";

  if (paragraphs.length < 9) {
    const lines = newInput.split("\n").filter((line) => line.trim().length > 0);
    const contentLines = lines.slice(1); // Skip title line

    let additionalParagraphs = contentLines
      .map((line) => `<p>${line.trim()}</p>`)
      .join("");

    // Add additional paragraphs to existing content
    contentWithoutIframes = contentWithoutIframes + additionalParagraphs;

    // Re-split into paragraphs
    const allParagraphs = contentWithoutIframes.match(/<p>.*?<\/p>/g) || [];

    // Add images to paragraphs 7 and 9 (index 6 and 8)
    const result = [];
    for (let i = 0; i < allParagraphs.length; i++) {
      result.push(allParagraphs[i]);

      // Add first image after paragraph 7 (index 6)
      if (i === 6 && window.selectedImages[0]) {
        result.push(
          `<p><img src="${window.selectedImages[0]}" alt="Image 1" style="max-width: 100%; height: auto;"></p>`,
        );
      }

      // Add second image after paragraph 9 (index 8) if we have a second image
      if (i === 8 && window.selectedImages[1]) {
        result.push(
          `<p><img src="${window.selectedImages[1]}" alt="Image 2" style="max-width: 100%; height: auto;"></p>`,
        );
      }
    }

    // Add iframes back at the end
    result.push(iframes);

    // Update article content
    article.description = result.join("");
  } else {
    // We have enough paragraphs, just add images to existing content
    const result = [];
    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i]);

      // Add first image after paragraph 7 (index 6)
      if (i === 4 && window.selectedImages[0]) {
        result.push(
          `<p><img src="${window.selectedImages[0]}" alt="Image 1" style="max-width: 100%; height: auto;"></p>`,
        );
      }

      // Add second image after paragraph 9 (index 8) if we have a second image
      if (i === 7 && window.selectedImages[1]) {
        result.push(
          `<p><img src="${window.selectedImages[1]}" alt="Image 2" style="max-width: 100%; height: auto;"></p>`,
        );
      }
    }

    // Add iframes back at the end
    result.push(iframes);
    // Update article content
    article.description = result.join("");
  }
  articlesData[window.currentArticleIndex] = article;

  // Save back to storage
  await chrome.storage.local.set({ xopbooArticles: articlesData });

  // Clear the textarea
  textarea.value = "";

  // Hide Select Images button after clearing textarea
  /* const selectImageBtn = document.querySelector(
    `.btn-select-image[data-index="${window.currentArticleIndex}"]`
  );
  if (selectImageBtn) {
    selectImageBtn.style.display = "none";
  } */

  // Close modal
  closeImageSelector();

  // Reload the table
  loadArticles();

  // Show success message
  showToast("Images added to article successfully!");

  // Start loading countdown for goBtn
  startLoadingCountdown(window.currentArticleIndex);

  // Mark row as completed and tick checkbox after reload
  setTimeout(async () => {
    const currentRow = document.querySelector(
      `tr:has(.btn-select-image[data-index="${window.currentArticleIndex}"])`,
    );
    if (currentRow) {
      // Tick the checkbox for this article
      const checkbox = currentRow.querySelector(
        `.article-checkbox[data-index="${window.currentArticleIndex}"]`,
      );
      if (checkbox) {
        checkbox.checked = true;
        await saveCheckboxState(window.currentArticleIndex, true);
      }

      // Add row-completed class
      currentRow.classList.add("row-completed");
    }
  }, 200);

  // If auto selecting, proceed to the next article after a timeout
  if (window.isAutoSelecting) {
    setTimeout(() => {
      processNextAutoSelect();
    }, 3500); // 3.5 seconds delay to allow current article countdown/tab-opening to start
  }
}

// Function to start automatic image selection for articles
async function startAutoSelectImages() {
  const checkboxes = document.querySelectorAll(".article-checkbox:checked");
  let indices = [];

  if (checkboxes.length > 0) {
    indices = Array.from(checkboxes).map((checkbox) =>
      parseInt(checkbox.dataset.index),
    );
  } else {
    // If no checkboxes are checked, select all articles that are NOT yet completed
    const articles = await chrome.storage.local.get("xopbooArticles");
    const articlesData = articles.xopbooArticles || [];

    indices = articlesData
      .map((article, index) => ({ article, index }))
      .filter(({ article }) => !article.checkboxstates)
      .map(({ index }) => index);

    if (indices.length === 0 && articlesData.length > 0) {
      if (
        confirm(
          "All articles are already completed. Do you want to re-run auto image selection on all articles?",
        )
      ) {
        indices = articlesData.map((_, index) => index);
      }
    }
  }

  if (indices.length === 0) {
    showToast("No articles to process!");
    return;
  }

  window.autoSelectQueue = indices;
  window.isAutoSelecting = true;

  showToast(`Starting auto image selection for ${indices.length} articles...`);
  processNextAutoSelect();
}

// Function to process the next article in the auto-select queue
async function processNextAutoSelect() {
  if (!window.isAutoSelecting) return;

  if (!window.autoSelectQueue || window.autoSelectQueue.length === 0) {
    window.isAutoSelecting = false;
    showToast("Auto image selection completed!");
    return;
  }

  const index = window.autoSelectQueue.shift();

  // Scroll the row into view for visual feedback
  const row = document.querySelector(
    `.article-checkbox[data-index="${index}"]`,
  );
  if (row) {
    const tr = row.closest("tr");
    if (tr) {
      tr.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add a slight delay after scrolling before opening the selector
      setTimeout(async () => {
        // Try to auto-select from YouTube video if available
        try {
          const stored = await chrome.storage.local.get("xopbooArticles");
          const articles = stored.xopbooArticles || [];
          const article = articles[index];
          if (article && article.videoUrl) {
            // Extract YouTube ID and construct thumbnail URLs
            const vid = extractYouTubeId(article.videoUrl);
            if (vid) {
              window.currentArticleIndex = index;
              window.selectedImages = [
                `https://img.youtube.com/vi/${vid}/maxres1.jpg`,
                `https://img.youtube.com/vi/${vid}/maxres2.jpg`,
              ];
              // Directly complete selection without opening modal
              completeImageSelection();
              return;
            }
          }
        } catch (e) {
          console.warn("Auto-select YouTube thumbnails failed:", e);
        }

        // Fallback to the original selector if no YouTube video
        openImageSelector(index);
      }, 500);
      return;
    }
  }

  // If no row found, still try YouTube auto-selection, otherwise open selector
  try {
    const stored = await chrome.storage.local.get("xopbooArticles");
    const articles = stored.xopbooArticles || [];
    const article = articles[index];
    if (article && article.videoUrl) {
      const vid = extractYouTubeId(article.videoUrl);
      if (vid) {
        window.currentArticleIndex = index;
        window.selectedImages = [
          `https://img.youtube.com/vi/${vid}/maxres1.jpg`,
          `https://img.youtube.com/vi/${vid}/maxres2.jpg`,
        ];
        completeImageSelection();
        return;
      }
    }
  } catch (e) {
    console.warn("Auto-select YouTube thumbnails failed:", e);
  }

  openImageSelector(index);
}

// Helper: extract YouTube video ID from common URL formats
function extractYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  // Try several patterns: v=ID, youtu.be/ID, /embed/ID
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/, // v=ID
    /youtu\.be\/([A-Za-z0-9_-]{6,})/, // youtu.be/ID
    /embed\/([A-Za-z0-9_-]{6,})/, // /embed/ID
    /\/v\/([A-Za-z0-9_-]{6,})/, // /v/ID
  ];

  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }

  // As a last resort, try to parse the 'v' param from query string
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return v;
  } catch (e) {
    // ignore
  }

  return null;
}
