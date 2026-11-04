const titleInput = document.querySelector(
  '#titlewrap input[name="post_title"]'
);
let permalinkElement = document.querySelector(
  "#edit-slug-box a#sample-permalink"
);

if (!permalinkElement) {
  // Trường hợp không có a#sample-permalink (nhiều site WordPress không dùng ID cho thẻ a này)
  const samplePermalink = document.querySelector("#sample-permalink a");
  if (samplePermalink) {
    permalinkElement = samplePermalink;
  }
}
let permalink = "";
if (permalinkElement) {
  permalink = permalinkElement.href;
  console.log("Permalink1:", permalink);
} else {
  console.log("Không tìm thấy permalink1.");
}
// Lấy shortlink nếu có
let shortlink = "";
const shortlinkInput = document.querySelector(
  'input#shortlink, input[name="shortlink"]'
);
if (shortlinkInput && shortlinkInput.value) {
  shortlink = shortlinkInput.value.trim();
} else {
  const shortlinkLinkEl = document.querySelector('link[rel="shortlink"]');
  if (shortlinkLinkEl && shortlinkLinkEl.href) {
    shortlink = shortlinkLinkEl.href.trim();
  }
}
if (shortlink) {
  console.log("Shortlink:", shortlink);
} else {
  console.log("Không tìm thấy shortlink.");
}
const contentTextarea = document.querySelector("textarea#content");
if (titleInput && permalink && contentTextarea) {
  // Giải mã HTML từ textarea
  const htmlContent = contentTextarea.value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  // Tạo DOM ảo để parse
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlContent;

  // Tìm ảnh đầu tiên
  const firstImage = tempDiv.querySelector("img");
  const thumbnail = firstImage ? firstImage.src.trim() : null;
  // Lấy nội dung từ textarea và xử lý
  const articleText = contentTextarea.value;
  console.log("Original content:", articleText);
  // Tìm contributors: tên trong HTML (dùng regex)
  const contributorsMatch = htmlContent.match(/contributors\s*:\s*([^\n<]+)/i);
  if (contributorsMatch) {
    contributors = contributorsMatch[1].trim();
  } else {
    // Dùng NLP để tìm tên người trong article
    const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const people = articleText.match(nameRegex);
    console.log(people);
    // Chỉ lấy tên có đúng 2 từ
    const twoWordNames = people
      ? people
          .map((name) => name.trim())
          .filter(
            (name) =>
              !/[\+\-－]/.test(name) && // Không chứa ký tự đặc biệt
              !/please/i.test(name) // Không chứa từ "please"
          )
      : [];

    // Xóa trùng
    const uniqueNames = [...new Set(twoWordNames)];

    // Xác thực lại bằng NLP để chỉ giữ lại tên người thật sự
    const validPeople = twoWordNames;

    // Viết hoa chữ cái đầu mỗi từ (title case)
    const titleCaseNames = validPeople.map((name) =>
      name
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    );

    contributors =
      titleCaseNames.length > 0 ? titleCaseNames.join(", ") : "Elvis Presley";
  }

  // Tạo summary từ nội dung (lấy đến dấu chấm thứ 2)
  let summary = "";
  const textContent = articleText.trim();

  // Loại bỏ các thẻ HTML
  const tempDiv2 = document.createElement("div");
  tempDiv2.innerHTML = textContent;
  const cleanText = tempDiv2.textContent;

  // Tách đoạn văn và lọc bỏ các đoạn trống
  // Tìm tất cả nội dung trong thẻ <p> - sử dụng regex linh hoạt hơn
  const pTagMatches = articleText.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);

  // Nếu tìm thấy thẻ <p>, sử dụng chúng
  const paragraphs = pTagMatches
    ? pTagMatches
        .map((p) => p.replace(/<\/?p[^>]*>/gi, "").trim()) // Loại bỏ thẻ <p> và </p>
        .filter((para) => para.length > 0 && !para.startsWith("<")) // Lọc bỏ đoạn trống và đoạn chỉ chứa HTML tags
    : cleanText // Nếu không tìm thấy thẻ <p>, sử dụng cách tách theo dòng trống
        .split(/\n\s*\n/)
        .map((para) => para.trim())
        .filter((para) => para.length > 0);
  console.log("Paragraphs count:", paragraphs.length);
  console.log("First paragraph:", paragraphs[0]);
  console.log("Last paragraph:", paragraphs[paragraphs.length - 1]);

  // Đọc cài đặt summaryFromLast từ storage và xử lý
  chrome.storage.local.get("summaryFromLast", (storageResult) => {
    // Mặc định là true (lấy từ đoạn cuối)
    const summaryFromLast =
      storageResult.summaryFromLast !== undefined
        ? storageResult.summaryFromLast
        : true;

    console.log("=== SUMMARY DEBUG ===");
    console.log("storageResult:", storageResult);
    console.log("summaryFromLast value:", summaryFromLast);
    console.log("typeof summaryFromLast:", typeof summaryFromLast);

    if (paragraphs.length >= 1) {
      if (summaryFromLast === true) {
        summary = paragraphs[paragraphs.length - 1]; // Lấy đoạn cuối cùng
        console.log("Lấy đoạn CUỐI");
      } else {
        summary = paragraphs[0]; // Lấy đoạn đầu tiên
        console.log("Lấy đoạn ĐẦU");
      }
    } else {
      summary = cleanText;
    }

    console.log("Final summary:", summary);
    console.log("=== END DEBUG ===");

    // Trích xuất Players và Team từ htmlContent
    let players = "";
    const playersMatch = htmlContent.match(/(?:<[^>]+>Players:<\/[^>]+>|Players:)\s*([^<\n]+)/i);
    if (playersMatch) {
      players = playersMatch[1].trim();
    }

    let team = "";
    const teamMatch = htmlContent.match(/(?:<[^>]+>Team:<\/[^>]+>|Team:)\s*([^<\n]+)/i);
    if (teamMatch) {
      team = teamMatch[1].trim();
    }

    const data = {
      title: titleInput.value.trim().replace(/\s*#TP\s*$/, ""),
      link: permalink.trim(),
      shortlink: shortlink || null,
      thumbnail: thumbnail,
      contributors: contributors,
      summary: summary,
      rawContent: articleText, // Lưu nội dung gốc để có thể tính toán lại summary
      players: players,
      team: team
    };

    if (data.title && data.link) {
      chrome.storage.local.get("tableRows", (result) => {
        const existingRows = result.tableRows || [];

        const isDuplicate = existingRows.some((row) => row.link === data.link);

        if (!isDuplicate) {
          const updatedRows = [...existingRows, data];

          chrome.storage.local.set({ tableRows: updatedRows }, () => {
            console.log("✅ Đã thêm dữ liệu vào tableRows:", data);
          });
        } else {
          console.log("⚠️ Link đã tồn tại, không thêm lại:", data.link);
        }

        chrome.storage.local.set({ postData: data }, () => {
          console.log("💾 Dữ liệu postData đã được lưu");
        });
      });
    }
  });
}
