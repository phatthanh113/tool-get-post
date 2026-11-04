// Store original content and processed content
let originalContent = {
  title: "",
  description: "",
  image: "",
  iframe: "",
  videoUrl: "",
  sourceTabId: null,
};

// Store processed content
let processedContent = {
  firstParagraph: "",
  remainingHtml: "",
};

// Function to get URL parameters
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Function to load content from storage based on article index
async function loadContentFromStorage(articleIndex) {
  console.log("Loading content for articleIndex:", articleIndex);
  try {
    const result = await chrome.storage.local.get("xopbooArticles");
    const articles = result.xopbooArticles || [];
    const article = articles[articleIndex];

    if (article) {
      console.log("Found article in storage:", article);
      originalContent = {
        title: article.title,
        description: article.description,
        image: article.image,
        iframe: article.iframe || article.videoUrl || "",
        videoUrl: article.videoUrl || "",
        sourceTabId: article.tabId,
      };
      console.log("Populated originalContent from storage:", originalContent);
      displayContent();
    } else {
      console.log("No article found in storage for index:", articleIndex);
    }
  } catch (error) {
    console.error("Error loading article:", error);
  }
}

// Initialize content from storage or message
document.addEventListener("DOMContentLoaded", () => {
  const articleIndex = getUrlParameter("articleIndex");
  console.log("Got articleIndex from URL:", articleIndex);
  if (articleIndex !== null) {
    loadContentFromStorage(parseInt(articleIndex));
  } else {
    console.log("No articleIndex found in URL");
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in editor.js:", message);
  if (message.type === "CONTENT_DATA") {
    originalContent = {
      title: message.title,
      description: message.description,
      image: message.image,
      iframe: message.iframe || message.videoUrl || "",
      videoUrl: message.videoUrl || "",
      sourceTabId: message.sourceTabId,
    };
    console.log("Populated originalContent from message:", originalContent);

    // Display the content
    displayContent();
  }
});

function moveImageAfterParagraph(description, paragraphNumber) {
  // Tách nội dung thành các phần: main image, other blocks, và iframe
  // Chỉ tìm image có class media-preview để di chuyển
  const mainImgRegex = /<img[^>]*class="[^"]*media-preview[^"]*"[^>]*>/;
  const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>/;

  const mainImgMatch = description.match(mainImgRegex);
  const iframeMatch = description.match(iframeRegex);

  const mainImgTag = mainImgMatch ? mainImgMatch[0] : "";
  const iframeTag = iframeMatch ? iframeMatch[0] : originalContent.iframe || "";

  // Loại bỏ ONLY main image và iframe để xử lý paragraphs
  let cleanedDescription = description
    .replace(mainImgRegex, "")
    .replace(iframeRegex, "");

  // Tìm tất cả các khối nội dung (p, div, blockquote, v.v.), bao gồm cả các ảnh khác nếu đã được bọc
  const paragraphs =
    cleanedDescription.match(
      /<(p|div|blockquote|h[1-6])[^>]*>[\s\S]*?<\/\1>/g,
    ) || [];

  // Nếu không đủ số đoạn văn yêu cầu và có ảnh, trả về nguyên bản
  if (mainImgTag && paragraphs.length < paragraphNumber) {
    return description;
  }

  // Tạo mảng mới chứa các đoạn văn với ảnh được chèn vào vị trí mong muốn
  const result = [];
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i]);
    if (i + 1 === paragraphNumber && mainImgTag) {
      result.push(`<p>${mainImgTag}</p>`);
    }
  }

  // Nếu không có paragraph nào nhưng có mainImgTag
  if (paragraphs.length === 0 && mainImgTag) {
    result.push(`<p>${mainImgTag}</p>`);
  }

  // Thêm iframe vào cuối nếu có
  if (iframeTag) {
    result.push(iframeTag);
  }
  return result.join("");
}

function extractNames(text) {
  // Create a temporary div to get text without HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = text;
  const articleText = tempDiv.textContent;
  const htmlContent = text;

  let players = "";
  const playersMatch = htmlContent.match(/(?:<[^>]+>Players:<\/[^>]+>|Players:)\s*([^<\n]+)/i);
  if (playersMatch) {
    players = playersMatch[1].trim();
  }

  if (players) {
    return players
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  }

  // Find potential names using regex fallback
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const people = articleText.match(nameRegex) || [];

  // Filter names
  const twoWordNames = people
    .map((name) => name.trim())
    .filter(
      (name) =>
        !/[\+\-－]/.test(name) && // No special characters
        !/please/i.test(name), // Don't include "please"
    );

  // Remove duplicates and convert to title case
  return [...new Set(twoWordNames)].map((name) =>
    name
      .toLowerCase()
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  );
}

function extractTeams(text) {
  const htmlContent = text;
  let team = "";
  const teamMatch = htmlContent.match(/(?:<[^>]+>Team:<\/[^>]+>|Team:)\s*([^<\n]+)/i);
  if (teamMatch) {
    team = teamMatch[1].trim();
  }

  if (team) {
    return [team];
  }

  const nflTeams = [
    "Cardinals",
    "Falcons",
    "Ravens",
    "Bills",
    "Panthers",
    "Bears",
    "Bengals",
    "Browns",
    "Cowboys",
    "Broncos",
    "Lions",
    "Packers",
    "Texans",
    "Colts",
    "Jaguars",
    "Chiefs",
    "Raiders",
    "Chargers",
    "Rams",
    "Dolphins",
    "Vikings",
    "Patriots",
    "Saints",
    "Giants",
    "Jets",
    "Eagles",
    "Steelers",
    "49ers",
    "Seahawks",
    "Buccaneers",
    "Titans",
    "Commanders",
  ];

  const foundTeams = [];
  nflTeams.forEach((teamName) => {
    const regex = new RegExp(`\\b${teamName}\\b`, "i");
    if (regex.test(text)) {
      foundTeams.push(teamName);
    }
  });

  // Also check for full names like "Minnesota Vikings"
  const fullTeamRegex =
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Vikings|Chiefs|Cowboys|Packers|Giants|Jets|Eagles|Steelers|49ers|Seahawks|Bears|Lions|Packers|Vikings|Falcons|Panthers|Saints|Buccaneers|Cardinals|Rams|49ers|Seahawks|Bills|Dolphins|Patriots|Jets|Ravens|Bengals|Browns|Steelers|Texans|Colts|Jaguars|Titans|Broncos|Chiefs|Raiders|Chargers|Commanders))\b/g;
  const fullMatches = text.match(fullTeamRegex) || [];

  // Combine and deduplicate
  const allFound = [...new Set([...foundTeams, ...fullMatches])];

  // Sort to prioritize longer names (e.g. "Minnesota Vikings" over "Vikings")
  return allFound.sort((a, b) => b.length - a.length);
}

function displayContent() {
  // Display description content
  const descContent = document.getElementById("descContent");
  // Only show title and description once
  descContent.innerHTML = originalContent.description
    ? `
        <h4>${originalContent.title}</h4>
         ${
           originalContent.videoUrl
             ? `<small style="color: #666; display: block; margin-bottom: 10px;">Video: ${originalContent.videoUrl}</small>`
             : ""
         }
        <div class="description-text">${originalContent.description}</div>
    `
    : "";

  // Extract and display names
  const names = extractNames(
    originalContent.title + " " + originalContent.description,
  );
  const namesList = document.getElementById("namesList");
  namesList.innerHTML = names
    .map(
      (name) =>
        `<span class="name-tag" data-search-term="${encodeURIComponent(
          name,
        )}">${name}</span>`,
    )
    .join("");

  // Extract and display teams
  const teams = extractTeams(
    originalContent.title + " " + originalContent.description,
  );
  const teamsList = document.getElementById("teamsList");
  teamsList.innerHTML = teams
    .map(
      (team) =>
        `<span class="name-tag" data-search-term="${encodeURIComponent(
          team,
        )}">${team}</span>`,
    )
    .join("");
}

// Handle update button click
document.getElementById("updateButton").addEventListener("click", () => {
  const newInput = document.getElementById("newInput").value.trim();

  if (!newInput) {
    alert("Please enter some text first!");
    return;
  }

  // Check for new video URL in input
  const videoRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=|tiktok\.com\/@[^\/]+\/video\/)(\S+)/;
  const videoMatch = newInput.match(videoRegex);
  if (videoMatch) {
    originalContent.videoUrl = videoMatch[0];
  }

  // Create initial content with paragraph tags, preserving line breaks
  // Only wrap in <p> if not already wrapped, and auto-apply metadata classes
  let updatedHtml = newInput
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      let trimmed = paragraph.trim();

      // Auto-wrap metadata if it starts with Players: or Team: and isn't already wrapped
      if (!trimmed.startsWith("<")) {
        const lowerTrimmed = trimmed.toLowerCase();
        if (
          lowerTrimmed.startsWith("players:") ||
          lowerTrimmed.startsWith("player:")
        ) {
          const parts = trimmed.split(":");
          const label = parts[0].trim();
          const value = parts.slice(1).join(":").trim();
          return `<p class="players-wrap"><strong>${label}:</strong> ${value}</p>`;
        }
        if (
          lowerTrimmed.startsWith("team:") ||
          lowerTrimmed.startsWith("teams:")
        ) {
          const parts = trimmed.split(":");
          const label = parts[0].trim();
          const value = parts.slice(1).join(":").trim();
          return `<p class="team-wrap"><strong>${label}:</strong> ${value}</p>`;
        }
      }

      // If already wrapped or is a tag, return as is
      if (
        trimmed.startsWith("<") &&
        (trimmed.endsWith(">") || trimmed.includes("</"))
      ) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("");

  // Auto-append metadata if missing, drawing from original content and new input
  const fullTextContext =
    originalContent.title + " " + originalContent.description + " " + newInput;
  const namesFound = extractNames(fullTextContext);
  const teamsFound = extractTeams(fullTextContext);

  if (!updatedHtml.includes('class="players-wrap"') && namesFound.length > 0) {
    const playersList = namesFound.slice(0, 3).join(", ");
    updatedHtml += `<p class="players-wrap"><strong>Players:</strong> ${playersList}</p>`;
  }

  if (!updatedHtml.includes('class="team-wrap"') && teamsFound.length > 0) {
    const mainTeam = teamsFound[0];
    updatedHtml += `<p class="team-wrap"><strong>Team:</strong> ${mainTeam}</p>`;
  }

  // Add image and iframe if they exist
  const selectedPosition = parseInt(
    document.querySelector('input[name="imagePosition"]:checked').value,
  );

  // Prepare complete HTML with image and iframe
  let completeHtml = updatedHtml;

  if (originalContent.image) {
    completeHtml += `<img src="${originalContent.image}" class="media-preview" alt="Preview">`;
  }

  if (
    originalContent.iframe &&
    originalContent.iframe.trim().startsWith("<iframe")
  ) {
    completeHtml += originalContent.iframe;
  } else {
    const videoToUse = originalContent.iframe || originalContent.videoUrl;
    if (videoToUse) {
      const videoId = videoToUse.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      )?.[1];
      if (videoId) {
        completeHtml += `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      }
    }
  }

  // Move image to selected position while preserving iframe
  updatedHtml = moveImageAfterParagraph(completeHtml, selectedPosition);

  // Get the first non-metadata block for title and remove it from updatedHtml
  const allBlocks =
    updatedHtml.match(/<(p|div|blockquote|h[1-6])[^>]*>[\s\S]*?<\/\1>/g) || [];
  let titleBlock = "";

  // Find first block that isn't metadata
  for (const block of allBlocks) {
    if (!block.includes("players-wrap") && !block.includes("team-wrap")) {
      titleBlock = block;
      break;
    }
  }

  if (titleBlock) {
    processedContent.firstParagraph = titleBlock;
    processedContent.remainingHtml = updatedHtml.replace(titleBlock, "");
  } else if (allBlocks.length > 0) {
    processedContent.firstParagraph = allBlocks[0];
    processedContent.remainingHtml = updatedHtml.substring(allBlocks[0].length);
  } else {
    processedContent.firstParagraph = "";
    processedContent.remainingHtml = updatedHtml;
  }

  // Display updated content preview without the first paragraph
  const updatedContent = document.getElementById("updatedContent");
  updatedContent.innerHTML = processedContent.remainingHtml;

  // Clear the input field
  document.getElementById("newInput").value = "";
});

// Function to extract text content from HTML string
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

// Function to copy content
function copyContent(elementId) {
  let textToCopy = "";

  if (elementId === "descContent") {
    // For description content, get the raw description without HTML
    const extraText =
      "A long English article written in a continuous flow without paragraph breaks, in a tabloid-style tone that is sensational, emotional, and fictionalized, exactly as you requested, expanded and more profound than the original version,broken into clear paragraphs for easier reading,make the entire headline sensational";
    const descriptionText = extractTextFromHTML(originalContent.description);
    textToCopy = `${extraText}:\n${originalContent.title}.${descriptionText}`;
  } else if (elementId === "updatedContent") {
    // For updated content, get everything including new input, image, and iframe
    const updatedHtml = document.getElementById("updatedContent").innerHTML;
    textToCopy = updatedHtml;

    // Send the updated content to Hanoi Pho
    console.log("Sending UPDATE_CONTENT message:", {
      title: processedContent.firstParagraph,
      videoUrl: originalContent.videoUrl,
    });
    chrome.runtime.sendMessage({
      type: "UPDATE_CONTENT",
      sourceTabId: originalContent.sourceTabId,
      content: {
        title: processedContent.firstParagraph
          .replace(/<(p|div|blockquote|h[1-6])[^>]*>/, "")
          .replace(/<\/(p|div|blockquote|h[1-6])>$/, ""),
        description: processedContent.remainingHtml,
        image: originalContent.image,
        iframe: originalContent.iframe || originalContent.videoUrl,
        videoUrl: originalContent.videoUrl,
      },
    });
  }

  // Create a temporary textarea to hold the text
  const textarea = document.createElement("textarea");
  textarea.value = textToCopy;
  document.body.appendChild(textarea);

  // Select and copy the text
  textarea.select();
  document.execCommand("copy");

  // Remove the temporary textarea
  document.body.removeChild(textarea);

  // Change button text temporarily to show feedback
  const button = document
    .querySelector(`#${elementId}`)
    .parentElement.querySelector(".copy-btn");
  const originalText = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => {
    button.textContent = originalText;
  }, 1000);
}

// Add event listeners for copy buttons
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("copyDescBtn").addEventListener("click", () => {
    copyContent("descContent");
  });

  document.getElementById("copyUpdatedBtn").addEventListener("click", () => {
    copyContent("updatedContent");
  });

  // Add event delegation for name tags and team tags
  const handleTagClick = (event) => {
    const tag = event.target.closest(".name-tag");
    if (tag) {
      const searchTerm = tag.dataset.searchTerm;
      if (searchTerm) {
        window.open(`https://www.google.com/search?q=${searchTerm}`, "_blank");
      }
    }
  };

  document
    .getElementById("namesList")
    .addEventListener("click", handleTagClick);
  document
    .getElementById("teamsList")
    .addEventListener("click", handleTagClick);
});
