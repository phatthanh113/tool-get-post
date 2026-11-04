let baseImg = null;
let overlayImg = null;

document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const submitBtn = document.getElementById("submitBtn");
  const contributorSelect = document.getElementById("contributorSelect");
  const searchInput = document.getElementById("search");

  searchBtn.addEventListener("click", searchImages);
  submitBtn.addEventListener("click", submitImages);

  // Xử lý khi chọn contributor
  contributorSelect.addEventListener("change", (e) => {
    searchInput.value = e.target.value;
    /*  if (e.target.value) {
      searchImages();
    } */
  });
  // Lấy dữ liệu của dòng từ storage
  chrome.storage.local.get("rowData", (result) => {
    if (result.rowData) {
      const { contributors, selectedContributor, title } = result.rowData;

      // Thêm tất cả contributors vào select
      contributors.forEach((contributor) => {
        const option = document.createElement("option");
        option.value = contributor;
        option.textContent = contributor;
        contributorSelect.appendChild(option);
      });

      // Chọn contributor mặc định
      if (selectedContributor) {
        contributorSelect.value = selectedContributor;
      }

      // Thêm tiêu đề vào trang
      const titleElement = document.createElement("h4");
      titleElement.className = "article-title";
      titleElement.textContent = `🎯 Đang tạo ảnh cho: ${title}`;
      document
        .querySelector(".search-container")
        .insertBefore(titleElement, contributorSelect.parentNode);
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get("search");
  if (searchParam) {
    searchInput.value = searchParam;
  }

  // Lấy ảnh overlay từ storage
  chrome.storage.local.get("imagesHtmlData", (result) => {
    if (result.imagesHtmlData) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = result.imagesHtmlData;
      const img = tempDiv.querySelector("img");
      if (img) {
        overlayImg = img.src;
        document.getElementById("overlayPreview").appendChild(img);
      }
      chrome.storage.local.remove("imagesHtmlData");
    }
  });
});

async function searchImages() {
  const query = document.getElementById("search").value.trim();
  if (!query) return alert("Vui lòng nhập từ khóa");

  const apiKey = "AIzaSyAZvtBX00nG9sNpftlfmviTDOc60NJ8NXw";
  const cx = "c2c2a230058284516";
  const randomStart = Math.floor(Math.random() * 9) * 10 + 1;

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&cx=${cx}&key=${apiKey}&searchType=image&num=10&start=${randomStart}&imgSize=xlarge`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const container = document.getElementById("result");
    container.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      container.innerHTML = "Không tìm thấy ảnh.";
      return;
    }

    data.items.forEach((item) => {
      const img = new Image(); // Tạo ảnh mới cho mỗi item
      img.src = item.link;
      img.alt = item.title;

      img.onload = () => {
        if (img.naturalWidth >= 700) {
          const imageContainer = document.createElement("div");
          imageContainer.className = "image-container";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "background-image";
          radio.value = item.link;

          radio.addEventListener("change", () => {
            // Xóa class selected từ tất cả các container
            document
              .querySelectorAll(".image-container")
              .forEach((container) => container.classList.remove("selected"));
            // Thêm class selected vào container được chọn
            imageContainer.classList.add("selected");
            baseImg = item.link;
          });

          imageContainer.appendChild(radio);
          imageContainer.appendChild(img);
          container.appendChild(imageContainer);
        } else {
          console.warn("Ảnh nhỏ hơn 700px, bỏ qua:", item.link);
        }
      };
      img.onerror = () => {
        console.warn("Ảnh lỗi, bỏ qua:", item.link);
      };
    });
  } catch (err) {
    console.error(err);
    document.getElementById("result").innerHTML = "Có lỗi xảy ra khi tìm ảnh.";
  }
}

function submitImages() {
  if (!overlayImg) {
    alert("Vui lòng đảm bảo có ảnh overlay.");
    return;
  }

  const layout = document.querySelector('input[name="layout"]:checked').value;

  // Tạo URL với baseImg (nếu có) hoặc không có baseImg
  let url =
    chrome.runtime.getURL("get_img_bg.html") +
    `?overlay=${encodeURIComponent(overlayImg)}&layout=${layout}`;

  // Thêm baseImg vào URL nếu có
  if (baseImg) {
    url += `&base=${encodeURIComponent(baseImg)}`;
  }

  chrome.tabs.create({ url });
}
