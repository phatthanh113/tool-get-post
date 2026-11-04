const baseInput = document.getElementById("baseImageInput");
const overlayInput = document.getElementById("overlayImageInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const filenameInput = document.getElementById("filenameInput");
const toggleMoveBtn = document.getElementById("toggleMoveBtn");
const toggleRangeBtn = document.getElementById("toggleRangeBtn");
const rangeControls = document.querySelector(".range-controls");
const layoutSelect = document.getElementById("layoutSelect");
// Range input elements
const overlayWidthInput = document.getElementById("overlayWidth");
const overlayHeightInput = document.getElementById("overlayHeight");
const overlayWidthValue = document.getElementById("overlayWidthValue");
const overlayHeightValue = document.getElementById("overlayHeightValue");
const downloadBtn = document.getElementById("downloadBtn");
const prefixInput = document.getElementById("prefixInput");
const convertToVideoBtn = document.getElementById("convertToVideoBtn");
const loadingOverlay = document.querySelector(".loading-overlay");

// Mặc định ẩn range-controls
if (rangeControls) {
  rangeControls.style.display = "none";
  if (toggleRangeBtn) {
    toggleRangeBtn.innerHTML = '<i class="fas fa-sliders"></i> Show Change';
  }
}

// Kiểm tra layout từ storage và hiển thị/ẩn các elements tương ứng
const currentLayoutFromStorage = localStorage.getItem("selectedLayout");
if (currentLayoutFromStorage === "video") {
  // Hiển thị các elements cho layout video
  if (convertToVideoBtn) convertToVideoBtn.style.display = "inline-block";
  if (baseInput) baseInput.style.display = "block";

  // Ẩn các controls không cần thiết cho layout video
  if (overlayInput) overlayInput.style.display = "none";
  if (rangeControls) rangeControls.style.display = "none";
  if (toggleMoveBtn) toggleMoveBtn.style.display = "none";
} else if (currentLayoutFromStorage === "16:3") {
  // Hiển thị nút convert cho layout 16:3
  if (convertToVideoBtn) convertToVideoBtn.style.display = "inline-block";
  if (baseInput) baseInput.style.display = "none";

  // Hiển thị các controls cho layout thường
  if (overlayInput) overlayInput.style.display = "block";
  if (toggleMoveBtn) toggleMoveBtn.style.display = "flex";
} else {
  // Ẩn các elements của layout video cho các layout khác
  if (convertToVideoBtn) convertToVideoBtn.style.display = "none";
  if (baseInput) baseInput.style.display = "none";

  // Hiển thị các controls cho layout thường
  if (overlayInput) overlayInput.style.display = "block";
  if (toggleMoveBtn) toggleMoveBtn.style.display = "flex";
}

function showLoading() {
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Load prefix from chrome.storage and set to input
if (prefixInput) {
  chrome.storage.sync.get(["prefixInputValue"], (result) => {
    if (typeof result.prefixInputValue === "string") {
      prefixInput.value = result.prefixInputValue;
    }
  });
  // Save prefix to chrome.storage on input
  prefixInput.addEventListener("input", () => {
    chrome.storage.sync.set({ prefixInputValue: prefixInput.value });
    updateCanvasDownloadName();
  });
}
// Default overlay dimensions
let overlayDimensions = {
  width: 600,
  height: 350,
};

// Load saved dimensions from Chrome storage
function loadSavedDimensions() {
  const savedWidth = localStorage.getItem("overlayWidth");
  const savedHeight = localStorage.getItem("overlayHeight");

  if (savedWidth) {
    overlayDimensions.width = parseInt(savedWidth);
    overlayWidthInput.value = savedWidth;
    overlayWidthValue.textContent = savedWidth;
  }

  if (savedHeight) {
    overlayDimensions.height = parseInt(savedHeight);
    overlayHeightInput.value = savedHeight;
    overlayHeightValue.textContent = savedHeight;
  }
}

// Save dimensions to Chrome storage
function saveDimensions() {
  localStorage.setItem("overlayWidth", overlayDimensions.width);
  localStorage.setItem("overlayHeight", overlayDimensions.height);
}

// Range input event handlers
overlayWidthInput.addEventListener("input", (e) => {
  overlayDimensions.width = parseInt(e.target.value);
  overlayWidthValue.textContent = e.target.value;
  saveDimensions();
  if (overlayImage) drawImages();
});

overlayHeightInput.addEventListener("input", (e) => {
  overlayDimensions.height = parseInt(e.target.value);
  overlayHeightValue.textContent = e.target.value;
  saveDimensions();
  if (overlayImage) drawImages();
});

// Load saved dimensions when page loads
loadSavedDimensions();

let allowVerticalMove = false;

// Toggle button event handler
toggleMoveBtn.addEventListener("click", () => {
  allowVerticalMove = !allowVerticalMove;
  toggleMoveBtn.innerHTML = allowVerticalMove
    ? '<i class="fas fa-arrows-left-right"></i> Move X'
    : '<i class="fas fa-arrows-up-down"></i> Move Y';
  canvas.style.cursor = allowVerticalMove ? "move" : "ew-resize";
});

let baseImage = null;
let overlayImage = null;
let thirdImage = null;
let imageData = { name: "output" }; // Thêm biến để lưu thông tin file

// Thêm input cho ảnh thứ ba
const thirdImageInput = document.createElement("input");
thirdImageInput.type = "file";
thirdImageInput.id = "thirdImageInput";
thirdImageInput.accept = "image/*";
thirdImageInput.style.display = "none";
document.body.appendChild(thirdImageInput);

// Xử lý sự kiện khi chọn ảnh thứ ba
thirdImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    thirdImage = img;
    drawImages();
  };
  img.src = URL.createObjectURL(file);
});

// Dữ liệu vị trí vẽ base image
let baseDraw = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

let isDraggingBase = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const base = params.get("base");
  const overlay = params.get("overlay");
  const currentLayoutFromStorage = localStorage.getItem("selectedLayout");

  // Tạo container cho overlay preview và controls
  const overlayControlsContainer = document.createElement("div");
  overlayControlsContainer.style.cssText = `
    margin: 20px 0;
    padding: 15px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #f9f9f9;
  `;

  // Tạo preview cho overlay image
  const overlayPreview = document.createElement("img");
  overlayPreview.style.cssText = `
    max-width: 200px;
    height: auto;
    margin-bottom: 10px;
    border-radius: 4px;
    display: block;
  `;

  // Tạo nút để sử dụng overlay làm base image
  const useAsBaseBtn = document.createElement("button");
  useAsBaseBtn.innerHTML = "🔄 Dùng làm ảnh nền";
  useAsBaseBtn.style.cssText = `
    padding: 8px 16px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  `;
  useAsBaseBtn.onclick = () => {
    if (overlayImage) {
      baseImage = overlayImage;
      setBaseDrawDimensions();
      drawImages();
    }
  };

  // Thêm các elements vào container
  overlayControlsContainer.appendChild(overlayPreview);
  overlayControlsContainer.appendChild(useAsBaseBtn);

  // Chèn container vào sau bảng điều khiển
  const controlPanel = document.querySelector(".range-controls");
  if (controlPanel && controlPanel.parentElement) {
    controlPanel.parentElement.insertBefore(
      overlayControlsContainer,
      controlPanel.nextSibling
    );
  }

  // Ẩn/hiện container dựa vào layout
  overlayControlsContainer.style.display =
    currentLayoutFromStorage === "video" ? "block" : "none";

  if (overlay) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      overlayImage = img;
      // Cập nhật preview
      overlayPreview.src = overlay;
      drawImages();
    };
    img.src = overlay;
  }

  if (base) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseImage = img;
      setBaseDrawDimensions();
      drawImages();
    };
    img.src = base;
  }

  // Cập nhật hiển thị container khi thay đổi layout
  layoutSelect.addEventListener("change", (e) => {
    overlayControlsContainer.style.display =
      e.target.value === "video" ? "block" : "none";
  });

  const urlParams = new URLSearchParams(window.location.search);
  const stt = urlParams.get("stt") || "";
  window.sttFromUrl = stt;
  if (downloadBtn && prefixInput) {
    downloadBtn.addEventListener("click", () => {
      const prefix = prefixInput.value || "";
      const fileName = `${prefix}${window.sttFromUrl || ""}.png`;

      // Lấy canvas
      const canvas = document.getElementById("canvas");
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }

  // Gợi ý prefix hoặc focus input khi vào trang
  if (window.sttFromUrl) {
    prefixInput.placeholder = "Prefix tên ảnh...";
  }
});
baseInput.addEventListener("change", (e) => loadImage(e, true));
overlayInput.addEventListener("change", (e) => loadImage(e, false));

// Xử lý paste ảnh
document.addEventListener("paste", (e) => {
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const blob = items[i].getAsFile();
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        if (currentLayout === "1:3") {
          // Xử lý đặc biệt cho layout 1:3
          if (!baseImage) {
            // Nếu chưa có baseImage, set làm baseImage (phần dưới bên trái)
            baseImage = img;
          } else if (!thirdImage) {
            // Nếu đã có baseImage nhưng chưa có thirdImage, set làm thirdImage (phần dưới bên phải)
            thirdImage = img;
          } else {
            // Nếu cả hai đã có, thay thế baseImage và di chuyển baseImage cũ sang thirdImage
            const oldBaseImage = baseImage;
            baseImage = img;
            thirdImage = oldBaseImage;
          }
        } else if (currentLayout === "16:3") {
          // Xử lý cho layout 16:3
          if (overlayImage) {
            baseImage = img;
            const scale = Math.max(
              canvas.width / img.width,
              canvas.height / img.height
            );
            baseDraw.width = img.width * scale;
            baseDraw.height = img.height * scale;
            baseDraw.x = (canvas.width - baseDraw.width) / 2;
            baseDraw.y = (canvas.height - baseDraw.height) / 2;
          } else {
            overlayImage = img;
          }
        } else {
          // Xử lý cho các layout khác
          if (overlayImage) {
            baseImage = img;
            setBaseDrawDimensions();
          } else {
            overlayImage = img;
          }
        }
        drawImages();
      };
      img.src = url;
      break;
    }
  }
});

function loadImage(e, isBase) {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    if (currentLayout === "1:3") {
      // Xử lý đặc biệt cho layout 1:3
      if (e.target.id === "thirdImageInput") {
        // Nếu là input thứ 3
        thirdImage = img;
      } else if (isBase) {
        baseImage = img;
      } else {
        overlayImage = img;
      }
    } else if (isBase) {
      baseImage = img;
      if (currentLayout === "16:3") {
        // Tính toán lại kích thước cho baseImage để lấp đầy canvas
        const scale = Math.max(
          canvas.width / img.width,
          canvas.height / img.height
        );
        baseDraw.width = img.width * scale;
        baseDraw.height = img.height * scale;
        baseDraw.x = (canvas.width - baseDraw.width) / 2;
        baseDraw.y = (canvas.height - baseDraw.height) / 2;
      } else {
        setBaseDrawDimensions();
      }
    } else {
      overlayImage = img;
    }
    drawImages();
  };
  img.src = URL.createObjectURL(file);
}

function setBaseDrawDimensions() {
  if (!baseImage) return;

  // Tính toán tỷ lệ để ảnh vừa với canvas và giữ nguyên tỷ lệ
  const scale = Math.min(
    canvas.width / baseImage.width,
    canvas.height / baseImage.height
  );

  baseDraw.width = baseImage.width * scale;
  baseDraw.height = baseImage.height * scale;

  // Căn giữa ảnh trong canvas
  baseDraw.x = (canvas.width - baseDraw.width) / 2;
  baseDraw.y = (canvas.height - baseDraw.height) / 2;
}

// Biến lưu vị trí base image cho layout 1:1
let baseImagePosition = {
  x: 0,
  y: 0,
};

// Thêm biến theo dõi vị trí cho ảnh thứ ba
let thirdImagePosition = {
  x: 0,
  y: 0,
};

function drawImages() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentLayout === "video") {
    if (baseImage) {
      ctx.drawImage(
        baseImage,
        baseDraw.x,
        baseDraw.y,
        baseDraw.width,
        baseDraw.height
      );
    }
  } else if (currentLayout === "1:3") {
    // Layout 1:3: Chia canvas thành 2 phần chính, phần dưới chia đôi
    const topHeight = 600; // Phần trên cao 600px
    const bottomHeight = 600; // Phần dưới cao 500px
    const bottomHalfWidth = canvas.width * 0.5;

    // Vẽ overlayImage ở phần trên
    if (overlayImage) {
      const overlayX = 0;
      const overlayY = 0;
      const overlayWidth = canvas.width;
      const overlayHeight = topHeight;

      ctx.fillStyle = "white";
      ctx.fillRect(
        overlayX - 5,
        overlayY - 5,
        overlayWidth + 10,
        overlayHeight + 10
      );
      ctx.drawImage(
        overlayImage,
        overlayX,
        overlayY,
        overlayWidth,
        overlayHeight
      );
    }

    // Vẽ viền trắng ngăn cách giữa phần trên và dưới
    ctx.fillStyle = "white";
    ctx.fillRect(0, topHeight - 5, canvas.width, 10);

    // Vẽ viền trắng dọc ở giữa phần dưới
    ctx.fillStyle = "white";
    ctx.fillRect(bottomHalfWidth - 5, topHeight, 10, bottomHeight);

    // Vẽ baseImage ở phần dưới bên trái
    if (baseImage) {
      // Tính toán scale để ảnh lấp đầy hoàn toàn phần 50% của nó
      const scale = Math.max(
        bottomHalfWidth / baseImage.width,
        bottomHeight / baseImage.height
      );

      const scaledWidth = baseImage.width * scale;
      const scaledHeight = baseImage.height * scale;

      // Tính toán vị trí ban đầu nếu chưa có
      if (!baseImagePosition.x && !baseImagePosition.y) {
        baseImagePosition.x = (bottomHalfWidth - scaledWidth) / 2;
        baseImagePosition.y = topHeight + (bottomHeight - scaledHeight) / 2;
      }

      ctx.fillStyle = "white";
      ctx.fillRect(0, topHeight, bottomHalfWidth - 5, bottomHeight);

      // Vẽ ảnh với clip để giới hạn trong phần 50%
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, topHeight, bottomHalfWidth - 5, bottomHeight);
      ctx.clip();
      ctx.drawImage(
        baseImage,
        baseImagePosition.x,
        baseImagePosition.y,
        scaledWidth,
        scaledHeight
      );
      ctx.restore();
    }

    // Vẽ thirdImage (nếu có) ở phần dưới bên phải
    if (thirdImage) {
      // Tính toán scale để ảnh lấp đầy hoàn toàn phần 50% của nó
      const scale = Math.max(
        bottomHalfWidth / thirdImage.width,
        bottomHeight / thirdImage.height
      );

      const scaledWidth = thirdImage.width * scale;
      const scaledHeight = thirdImage.height * scale;

      // Tính toán vị trí ban đầu nếu chưa có
      if (!thirdImagePosition.x && !thirdImagePosition.y) {
        thirdImagePosition.x =
          bottomHalfWidth + (bottomHalfWidth - scaledWidth) / 2;
        thirdImagePosition.y = topHeight + (bottomHeight - scaledHeight) / 2;
      }

      ctx.fillStyle = "white";
      ctx.fillRect(
        bottomHalfWidth + 5,
        topHeight,
        bottomHalfWidth - 5,
        bottomHeight
      );

      // Vẽ ảnh với clip để giới hạn trong phần 50%
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        bottomHalfWidth + 5,
        topHeight,
        bottomHalfWidth - 5,
        bottomHeight
      );
      ctx.clip();
      ctx.drawImage(
        thirdImage,
        thirdImagePosition.x,
        thirdImagePosition.y,
        scaledWidth,
        scaledHeight
      );
      ctx.restore();
    }
  } else if (currentLayout === "1:1") {
    // Layout 1:1: Chia canvas thành 2 phần
    const topHeight = canvas.height * 0.45;
    const bottomHeight = canvas.height * 0.55;

    // Vẽ baseImage ở nửa dưới
    if (baseImage) {
      const scale =
        Math.max(
          canvas.width / baseImage.width,
          bottomHeight / baseImage.height
        ) * 1;

      const scaledWidth = baseImage.width * scale;
      const scaledHeight = baseImage.height * scale;

      baseImagePosition.x = Math.min(
        Math.max(baseImagePosition.x, canvas.width - scaledWidth),
        0
      );

      if (allowVerticalMove) {
        baseImagePosition.y = Math.min(
          Math.max(baseImagePosition.y, canvas.height - scaledHeight),
          topHeight
        );
      } else {
        baseImagePosition.y = topHeight;
      }

      ctx.drawImage(
        baseImage,
        baseImagePosition.x,
        baseImagePosition.y,
        scaledWidth,
        scaledHeight
      );
    }

    // Vẽ overlayImage ở nửa trên
    if (overlayImage) {
      const overlayX = 0;
      const overlayY = 0;
      const overlayWidth = canvas.width;
      const overlayHeight = topHeight;

      ctx.fillStyle = "yellow";
      ctx.fillRect(
        overlayX - 5,
        overlayY - 5,
        overlayWidth + 10,
        overlayHeight + 10
      );
      ctx.drawImage(
        overlayImage,
        overlayX,
        overlayY,
        overlayWidth,
        overlayHeight
      );
    }
  } else {
    // Layout 16:3
    if (baseImage) {
      // Chỉ tính toán kích thước khi chưa có hoặc khi baseImage thay đổi
      if (baseDraw.width === 0 || baseDraw.height === 0) {
        const scale = Math.max(
          canvas.width / baseImage.width,
          canvas.height / baseImage.height
        );
        baseDraw.width = baseImage.width * scale;
        baseDraw.height = baseImage.height * scale;
        // Chỉ căn giữa khi chưa có vị trí
        if (baseDraw.x === 0 && baseDraw.y === 0) {
          baseDraw.x = (canvas.width - baseDraw.width) / 2;
          baseDraw.y = (canvas.height - baseDraw.height) / 2;
        }
      }

      // Giới hạn vị trí để ảnh không bị kéo ra ngoài canvas
      baseDraw.x = Math.min(
        Math.max(baseDraw.x, canvas.width - baseDraw.width),
        0
      );
      if (allowVerticalMove) {
        baseDraw.y = Math.min(
          Math.max(baseDraw.y, canvas.height - baseDraw.height),
          0
        );
      }

      ctx.drawImage(
        baseImage,
        baseDraw.x,
        baseDraw.y,
        baseDraw.width,
        baseDraw.height
      );
    }

    if (overlayImage) {
      const x = (canvas.width - overlayDimensions.width) / 2;
      const y = canvas.height - overlayDimensions.height - 40;

      ctx.fillStyle = "yellow";
      ctx.fillRect(
        x - 5,
        y - 5,
        overlayDimensions.width + 10,
        overlayDimensions.height + 10
      );
      ctx.drawImage(
        overlayImage,
        x,
        y,
        overlayDimensions.width,
        overlayDimensions.height
      );
    }
  }
}

// Sự kiện kéo base image
let isDraggingThird = false;

canvas.addEventListener("mousedown", (e) => {
  const mx = e.offsetX;
  const my = e.offsetY;

  if (currentLayout === "1:3") {
    const topHeight = canvas.height * 0.5;
    const bottomHeight = canvas.height * 0.5;
    const bottomHalfWidth = canvas.width * 0.5;

    if (my > topHeight) {
      // Kiểm tra xem đang click vào nửa trái hay phải của phần dưới
      if (mx < bottomHalfWidth && baseImage) {
        // Click vào phần bên trái (baseImage)
        isDraggingBase = true;
        dragOffsetX = mx - baseImagePosition.x;
        if (!allowVerticalMove) {
          dragOffsetY = my - baseImagePosition.y;
        }
        canvas.style.cursor = !allowVerticalMove ? "ns-resize" : "ew-resize";
      } else if (mx >= bottomHalfWidth && thirdImage) {
        // Click vào phần bên phải (thirdImage)
        isDraggingThird = true;
        dragOffsetX = mx - thirdImagePosition.x;
        if (!allowVerticalMove) {
          dragOffsetY = my - thirdImagePosition.y;
        }
        canvas.style.cursor = !allowVerticalMove ? "ns-resize" : "ew-resize";
      }
    }
  } else if (currentLayout === "1:1") {
    const topHeight = canvas.height * 0.45;
    if (my > topHeight && baseImage) {
      isDraggingBase = true;
      dragOffsetX = mx - baseImagePosition.x;
      // Chỉ lưu offset Y khi được phép di chuyển theo chiều dọc
      if (allowVerticalMove) {
        dragOffsetY = my - baseImagePosition.y;
      }
      // Cập nhật con trỏ chuột dựa vào trạng thái allowVerticalMove
      canvas.style.cursor = allowVerticalMove ? "move" : "ew-resize";
    }
  } else {
    if (
      baseImage &&
      mx >= baseDraw.x &&
      mx <= baseDraw.x + baseDraw.width &&
      my >= baseDraw.y &&
      my <= baseDraw.y + baseDraw.height
    ) {
      isDraggingBase = true;
      dragOffsetX = mx - baseDraw.x;
      if (allowVerticalMove) {
        dragOffsetY = my - baseDraw.y;
      }
      canvas.style.cursor = allowVerticalMove ? "move" : "ew-resize";
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDraggingBase && !isDraggingThird) return;

  if (currentLayout === "1:3") {
    if (isDraggingBase) {
      if (allowVerticalMove) {
        // Khi unlock - chỉ di chuyển theo X
        baseImagePosition.x = e.offsetX - dragOffsetX;
      } else {
        // Khi lock - chỉ di chuyển theo Y
        baseImagePosition.y = e.offsetY - dragOffsetY;
      }
    } else if (isDraggingThird) {
      if (allowVerticalMove) {
        // Khi unlock - chỉ di chuyển theo X
        thirdImagePosition.x = e.offsetX - dragOffsetX;
      } else {
        // Khi lock - chỉ di chuyển theo Y
        thirdImagePosition.y = e.offsetY - dragOffsetY;
      }
    }
    drawImages();
  } else if (currentLayout === "1:1") {
    baseImagePosition.x = e.offsetX - dragOffsetX;
    if (allowVerticalMove) {
      baseImagePosition.y = e.offsetY - dragOffsetY;
    }
    drawImages();
  } else {
    baseDraw.x = e.offsetX - dragOffsetX;
    if (allowVerticalMove) {
      baseDraw.y = e.offsetY - dragOffsetY;
    }
    drawImages();
  }
});

canvas.addEventListener("mouseup", () => {
  isDraggingBase = false;
  isDraggingThird = false;
  canvas.style.cursor =
    currentLayout === "1:3" ? "move" : allowVerticalMove ? "move" : "ew-resize";
});

canvas.addEventListener("mouseleave", () => {
  isDraggingBase = false;
  isDraggingThird = false;
  canvas.style.cursor =
    currentLayout === "1:3" ? "move" : allowVerticalMove ? "move" : "ew-resize";
});

/* // Tải ảnh
downloadBtn.addEventListener("click", () => {
  let filename = filenameInput.value.trim();
  if (!filename) filename = "canvas_output";
  const link = document.createElement("a");
  link.download = filename + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
 */
// Alt + S để tải ảnh
document.addEventListener("keydown", (event) => {
  if (event.altKey && event.key === "S") {
    event.preventDefault();
    let filename = filenameInput.value.trim();
    if (!filename) filename = "canvas_output";
    const link = document.createElement("a");
    link.download = fileName + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
});

toggleRangeBtn.addEventListener("click", () => {
  const isHidden = rangeControls.style.display === "none";
  rangeControls.style.display = isHidden ? "grid" : "none";
  toggleRangeBtn.innerHTML = isHidden
    ? '<i class="fas fa-sliders"></i> Show Change'
    : '<i class="fas fa-sliders"></i> Hide Change';
});

// Initialize controls as hidden
rangeControls.style.display = "none";
toggleRangeBtn.innerHTML = '<i class="fas fa-sliders"></i> Show Change';

// Load saved layout and set initial canvas height
function setCanvasHeight() {
  // Cố định kích thước canvas cho tất cả layout
  canvas.width = 1000;

  // Điều chỉnh chiều cao dựa vào layout
  if (currentLayout === "1:3") {
    canvas.height = 1200; // Thêm 1000px cho layout 1:3
  } else if (currentLayout === "1:1") {
    canvas.height = 1000;
  } else if (currentLayout === "16:3") {
    canvas.height = 1200;
  } else {
    canvas.height = 1000;
  }

  if (baseImage) {
    setBaseDrawDimensions();
    drawImages();
  }
}

// Layout state
let currentLayout = "16:3";

// Load saved layout from storage
const savedLayout = localStorage.getItem("selectedLayout");
if (savedLayout) {
  currentLayout = savedLayout;
  layoutSelect.value = savedLayout;
}
setCanvasHeight();

// Hàm cập nhật kích thước canvas dựa trên layout
function updateCanvasSize(layout) {
  // Cố định kích thước canvas cho tất cả layout
  canvas.width = 1000;
  canvas.height = 1000;

  if (baseImage) {
    setBaseDrawDimensions();
    drawImages();
  }
}

// Layout select handler
layoutSelect.addEventListener("change", (e) => {
  const layout = e.target.value;
  const baseImageInput = document.getElementById("baseImageInput");
  const overlayImageInput = document.getElementById("overlayImageInput");
  const rangeControls = document.querySelector(".range-controls");
  const toggleMoveBtn = document.getElementById("toggleMoveBtn");

  // Cập nhật layout và lưu vào storage
  currentLayout = layout;
  localStorage.setItem("selectedLayout", layout);

  // Reset canvas và các biến trạng thái
  canvas.width = 1000;
  canvas.height = layout === "1:3" ? 1100 : 1000;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reset các biến vị trí
  baseDraw = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  baseImagePosition = {
    x: 0,
    y: layout === "1:1" ? canvas.height * 0.45 : 0,
  };

  // Cập nhật giao diện dựa trên layout
  if (layout === "video") {
    // Show base image input and hide overlay-related elements
    baseImageInput.style.display = "block";
    overlayImageInput.style.display = "none";
    thirdImageInput.style.display = "none";
    rangeControls.style.display = "none";
    toggleMoveBtn.style.display = "none";
    if (convertToVideoBtn) convertToVideoBtn.style.display = "inline-block";

    // Nếu có overlay image, giữ lại để có thể dùng làm base
    if (overlayImage) {
      baseImage = overlayImage;
      overlayImage = null;
    }
  } else if (layout === "1:3") {
    // Show all image inputs for 1:3 layout
    baseImageInput.style.display = "block";
    overlayImageInput.style.display = "block";
    thirdImageInput.style.display = "block";
    toggleMoveBtn.style.display = "flex";
    if (convertToVideoBtn) convertToVideoBtn.style.display = "none";
  } else if (layout === "16:3") {
    // Hide base image input but show convert button
    baseImageInput.style.display = "none";
    overlayImageInput.style.display = "block";
    thirdImageInput.style.display = "none";
    toggleMoveBtn.style.display = "flex";
    if (convertToVideoBtn) convertToVideoBtn.style.display = "inline-block";
  } else {
    // Hide video-related elements for other layouts
    baseImageInput.style.display = "none";
    overlayImageInput.style.display = "block";
    thirdImageInput.style.display = "none";
    toggleMoveBtn.style.display = "flex";
    if (convertToVideoBtn) convertToVideoBtn.style.display = "none";
  }

  // Cập nhật kích thước overlay dựa trên layout
  if (layout === "1:1" && baseImage) {
    // Set overlay dimensions to match base image dimensions
    const scale = Math.min(
      canvas.width / baseImage.width,
      canvas.height / baseImage.height
    );
    const baseWidth = baseImage.width * scale;
    const baseHeight = baseImage.height * scale;

    overlayDimensions.width = baseWidth;
    overlayDimensions.height = baseHeight;

    // Update range inputs
    overlayWidthInput.value = baseWidth;
    overlayHeightInput.value = baseHeight;
    overlayWidthValue.textContent = baseWidth;
    overlayHeightValue.textContent = baseHeight;
  } else {
    // Reset to default 16:3 dimensions
    overlayDimensions.width = 600;
    overlayDimensions.height = 350;

    // Update range inputs
    overlayWidthInput.value = 600;
    overlayHeightInput.value = 350;
    overlayWidthValue.textContent = "600";
    overlayHeightValue.textContent = "350";
  }

  // Tính toán lại kích thước và vị trí cho base image
  if (baseImage) {
    setBaseDrawDimensions();
  }

  // Save dimensions
  saveDimensions();

  // Vẽ lại ảnh
  drawImages();

  // Log trạng thái để debug
  console.log("Layout changed:", {
    layout,
    baseImage: !!baseImage,
    overlayImage: !!overlayImage,
    baseDraw,
    baseImagePosition,
    overlayDimensions,
  });
});

// Xử lý chuyển đổi ảnh thành video
convertToVideoBtn.addEventListener("click", async () => {
  if (
    (!baseImage && currentLayout === "video") ||
    (!baseImage && !overlayImage && currentLayout === "16:3")
  ) {
    alert("Vui lòng chọn ảnh trước khi chuyển đổi!");
    return;
  }

  showLoading();

  try {
    // Tạo canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 1000;
    tempCanvas.height = 1000;
    const tempCtx = tempCanvas.getContext("2d");

    // Tính scale và vẽ ảnh dựa vào layout
    if (currentLayout === "video") {
      const scale = Math.min(
        tempCanvas.width / baseImage.width,
        tempCanvas.height / baseImage.height
      );
      const newWidth = baseImage.width * scale;
      const newHeight = baseImage.height * scale;
      const x = (tempCanvas.width - newWidth) / 2;
      const y = (tempCanvas.height - newHeight) / 2;

      // Vẽ baseImage cho layout video
      tempCtx.fillStyle = "#000000";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(baseImage, x, y, newWidth, newHeight);
    } else if (currentLayout === "16:3") {
      // Vẽ baseImage nếu có
      if (baseImage) {
        // Sử dụng kích thước và vị trí hiện tại từ baseDraw
        tempCtx.drawImage(
          baseImage,
          baseDraw.x,
          baseDraw.y,
          baseDraw.width,
          baseDraw.height
        );
      }

      // Vẽ overlayImage nếu có
      if (overlayImage) {
        const x = (canvas.width - overlayDimensions.width) / 2;
        const y = canvas.height - overlayDimensions.height - 40;

        tempCtx.fillStyle = "yellow";
        tempCtx.fillRect(
          x - 5,
          y - 5,
          overlayDimensions.width + 10,
          overlayDimensions.height + 10
        );
        tempCtx.drawImage(
          overlayImage,
          x,
          y,
          overlayDimensions.width,
          overlayDimensions.height
        );
      }
    }

    // Sử dụng WebM với H.264 - tương thích nhất
    let mimeType = "video/webm;codecs=h264";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm"; // Fallback
    }

    const stream = tempCanvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 2000000, // 2 Mbps
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    mediaRecorder.onstop = async () => {
      try {
        const webmBlob = new Blob(chunks, { type: mimeType });

        // Tạo MP4 thật bằng cách sử dụng File API
        const mp4Blob = new Blob([webmBlob], {
          type: "video/mp4",
        });

        // Tạo URL và download
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement("a");
        a.href = url;
        const prefix = prefixInput ? prefixInput.value : "";
        const stt = window.sttFromUrl || "";
        a.download = `video_${prefix}${stt}.mp4`;

        // Force download với user gesture
        const clickEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: false,
        });

        document.body.appendChild(a);
        a.dispatchEvent(clickEvent);
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 5000);
        hideLoading();
      } catch (error) {
        console.error("Lỗi convert:", error);
        hideLoading();
      }
    };

    // Animation loop
    mediaRecorder.start();
    const startTime = performance.now();
    const duration = 5000;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;

      if (elapsed < duration) {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Vẽ lại ảnh dựa vào layout
        if (currentLayout === "video") {
          const scale = Math.min(
            tempCanvas.width / baseImage.width,
            tempCanvas.height / baseImage.height
          );
          const newWidth = baseImage.width * scale;
          const newHeight = baseImage.height * scale;
          const x = (tempCanvas.width - newWidth) / 2;
          const y = (tempCanvas.height - newHeight) / 2;

          tempCtx.fillStyle = "#000000";
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(baseImage, x, y, newWidth, newHeight);
        } else if (currentLayout === "16:3") {
          // Vẽ baseImage nếu có
          if (baseImage) {
            // Sử dụng kích thước và vị trí hiện tại từ baseDraw
            tempCtx.drawImage(
              baseImage,
              baseDraw.x,
              baseDraw.y,
              baseDraw.width,
              baseDraw.height
            );
          }

          // Vẽ overlayImage nếu có
          if (overlayImage) {
            const x = (canvas.width - overlayDimensions.width) / 2;
            const y = canvas.height - overlayDimensions.height - 40;

            tempCtx.fillStyle = "yellow";
            tempCtx.fillRect(
              x - 5,
              y - 5,
              overlayDimensions.width + 10,
              overlayDimensions.height + 10
            );
            tempCtx.drawImage(
              overlayImage,
              x,
              y,
              overlayDimensions.width,
              overlayDimensions.height
            );
          }
        }

        requestAnimationFrame(animate);
      } else {
        mediaRecorder.stop();
      }
    }

    requestAnimationFrame(animate);
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Có lỗi xảy ra!");
    hideLoading();
  }
});

// Handle contributors
function handleContributors() {
  const urlParams = new URLSearchParams(window.location.search);
  const contributors = urlParams.get("contributors");
  const title = urlParams.get("title");
  const contributorsList = document.getElementById("contributorsList");

  if (contributors) {
    const contributorArray = contributors
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c);

    // Loại bỏ trùng lặp bằng Set
    const uniqueContributors = [...new Set(contributorArray)];

    // Lấy title để kiểm tra
    const titleText = title ? decodeURIComponent(title).toLowerCase() : "";

    uniqueContributors.forEach((contributor) => {
      const tag = document.createElement("span");
      tag.className = "contributor-tag";
      
      // Tạo phần text cho tên contributor
      const nameSpan = document.createElement("span");
      nameSpan.textContent = contributor;
      nameSpan.title = "Tìm trên Google";
      nameSpan.style.cursor = "pointer";
      
      // Tạo icon cho Bing
      const bingIcon = document.createElement("span");
      bingIcon.className = "bing-icon";
      bingIcon.textContent = "🔍";
      bingIcon.title = "Điền vào tìm kiếm Bing";
      bingIcon.style.cursor = "pointer";

      tag.appendChild(nameSpan);
      tag.appendChild(bingIcon);

      // Kiểm tra nếu contributor có trong title
      const words = contributor.toLowerCase().split(/\s+/);
      if (titleText) {
        const titleLower = titleText.toLowerCase();
        const hasMatch = words.some((word) => titleLower.includes(word));
        if (hasMatch) {
          tag.style.backgroundColor = "#ef4444";
          tag.style.fontWeight = "600";
        }
      }

      // Click vào tên -> Mở Google
      nameSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(contributor)}`;
        chrome.tabs.create({ url: searchUrl });
      });

      // Click vào icon -> Điền vào ô tìm kiếm Bing
      bingIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        const bingSearchInput = document.getElementById("bingSearchInput");
        const clearBtn = document.getElementById("clearBingSearch");
        if (bingSearchInput) {
          const currentValue = bingSearchInput.value.trim();
          if (currentValue) {
            // Kiểm tra nếu tên này chưa có trong chuỗi thì mới thêm vào
            if (!currentValue.includes(contributor)) {
              bingSearchInput.value = currentValue + " " + contributor;
            }
          } else {
            bingSearchInput.value = contributor;
          }
          
          if (clearBtn) clearBtn.style.display = "block";
          bingSearchInput.focus();
          // Cuộn xuống phần tìm kiếm Bing
          document.getElementById("bingSearchContainer").scrollIntoView({ behavior: 'smooth' });
        }
      });

      contributorsList.appendChild(tag);
    });
  } else {
    document.getElementById("contributorsContainer").style.display = "none";
  }
}

// Pre-populate Bing Search Input and run search if players and/or team are provided in URL
function initBingSearchFromParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const players = urlParams.get("players") ? decodeURIComponent(urlParams.get("players")).trim() : "";
  const team = urlParams.get("team") ? decodeURIComponent(urlParams.get("team")).trim() : "";

  // Split players by comma to get a list
  const playerList = players ? players.split(",").map(p => p.trim()).filter(Boolean) : [];

  let searchQuery = "";
  if (playerList.length > 0) {
    // Only take the first player + team
    searchQuery = team ? `${playerList[0]} ${team}` : playerList[0];
  } else if (team) {
    searchQuery = team;
  }

  // Create quick selects for all players
  const bingQuickSelects = document.getElementById("bingQuickSelects");
  if (bingQuickSelects && playerList.length > 0) {
    bingQuickSelects.innerHTML = ""; // Clear existing
    playerList.forEach((player, idx) => {
      const qQuery = team ? `${player} ${team}` : player;
      
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-select-btn";
      btn.textContent = qQuery;
      
      // Premium, dynamic style with smooth transitions and subtle hover/active effects
      btn.style.cssText = `
        padding: 5px 10px;
        background-color: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        height: auto;
        margin: 0;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      `;
      
      const setInactiveStyle = () => {
        btn.style.backgroundColor = "#f3f4f6";
        btn.style.color = "#374151";
        btn.style.borderColor = "#e5e7eb";
      };

      const setActiveStyle = () => {
        btn.style.backgroundColor = "#2563eb";
        btn.style.color = "#ffffff";
        btn.style.borderColor = "#2563eb";
      };

      const setHoverStyle = () => {
        btn.style.backgroundColor = "#e5e7eb";
        btn.style.color = "#1f2937";
        btn.style.borderColor = "#d1d5db";
      };

      const setActiveHoverStyle = () => {
        btn.style.backgroundColor = "#1d4ed8";
        btn.style.color = "#ffffff";
        btn.style.borderColor = "#1d4ed8";
      };

      // Set initial active state on first player
      let isActive = (idx === 0);
      if (isActive) {
        setActiveStyle();
      } else {
        setInactiveStyle();
      }

      // Hover events
      btn.addEventListener("mouseenter", () => {
        if (isActive) {
          setActiveHoverStyle();
        } else {
          setHoverStyle();
        }
      });

      btn.addEventListener("mouseleave", () => {
        if (isActive) {
          setActiveStyle();
        } else {
          setInactiveStyle();
        }
      });

      btn.addEventListener("click", () => {
        const bingSearchInput = document.getElementById("bingSearchInput");
        const clearBingSearch = document.getElementById("clearBingSearch");
        if (bingSearchInput) {
          bingSearchInput.value = qQuery;
          if (clearBingSearch) {
            clearBingSearch.style.display = "block";
          }
          
          // Reset all other buttons to inactive
          const allButtons = bingQuickSelects.querySelectorAll(".quick-select-btn");
          allButtons.forEach((b) => {
            b.dispatchEvent(new Event("deactivate"));
          });

          // Activate this button
          isActive = true;
          setActiveStyle();

          // Auto search
          performBingSearch();
        }
      });

      // Custom event listener for state coordination
      btn.addEventListener("deactivate", () => {
        isActive = false;
        setInactiveStyle();
      });

      bingQuickSelects.appendChild(btn);
    });
  }

  if (searchQuery) {
    const bingSearchInput = document.getElementById("bingSearchInput");
    const clearBingSearch = document.getElementById("clearBingSearch");
    if (bingSearchInput) {
      bingSearchInput.value = searchQuery;
      if (clearBingSearch) {
        clearBingSearch.style.display = "block";
      }
      // Run the search automatically
      performBingSearch();
    }
  }
}

// Call handleContributors when the page loads
document.addEventListener("DOMContentLoaded", () => {
  handleContributors();
  handleVideoInfo();
  initBingSearchFromParams();
});

// Handle video info (title and YouTube link)
function handleVideoInfo() {
  const urlParams = new URLSearchParams(window.location.search);
  const title = urlParams.get("title");
  const youtubeLink = urlParams.get("youtubeLink");

  const videoInfoContainer = document.getElementById("videoInfoContainer");
  const videoTitle = document.getElementById("videoTitle");
  const videoLinkDiv = document.getElementById("videoLink");

  if (title || youtubeLink) {
    videoInfoContainer.style.display = "block";

    if (title) {
      videoTitle.textContent = decodeURIComponent(title);
    }

    if (youtubeLink) {
      const decodedLink = decodeURIComponent(youtubeLink);
      videoLinkDiv.innerHTML = `<a href="${decodedLink}" target="_blank" style="color: #2563eb; text-decoration: none; word-break: break-all;">🔗 ${decodedLink}</a>`;
    }
  } else {
    videoInfoContainer.style.display = "none";
  }
}

// Đặt thuộc tính download cho canvas để khi chuột phải -> Save image as sẽ lấy đúng tên
function updateCanvasDownloadName() {
  if (!canvas) return;
  const prefix = prefixInput ? prefixInput.value : "";
  const stt = window.sttFromUrl || "";
  // Tạo một link ẩn để set thuộc tính download
  canvas.setAttribute("data-download-filename", `${prefix}${stt}.png`);
}

if (prefixInput) {
  prefixInput.addEventListener("input", updateCanvasDownloadName);
}
document.addEventListener("DOMContentLoaded", updateCanvasDownloadName);

// Hook contextmenu để đổi tên file khi Save image as
canvas.addEventListener("contextmenu", function (e) {
  updateCanvasDownloadName();
});

// Gợi ý cho user: khi muốn lưu đúng tên, nên dùng nút Download hoặc kéo thả ảnh ra ngoài

// Thêm listener để nhận message từ background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkImageStatus") {
    // Trả về trạng thái của baseImage và thirdImage
    sendResponse({
      hasBaseImage: baseImage !== null && baseImage !== undefined,
      hasThirdImage: thirdImage !== null && thirdImage !== undefined,
    });
    return true;
  }

  if (message.action === "loadImageFromUrl") {
    const imageUrl = message.imageUrl;
    const imageType = message.imageType; // 'base' hoặc 'third'

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (imageType === "base") {
        baseImage = img;
        // Xử lý đặc biệt cho layout 16:3
        if (currentLayout === "16:3") {
          // Tính toán lại kích thước cho baseImage để lấp đầy canvas
          const scale = Math.max(
            canvas.width / img.width,
            canvas.height / img.height
          );
          baseDraw.width = img.width * scale;
          baseDraw.height = img.height * scale;
          baseDraw.x = (canvas.width - baseDraw.width) / 2;
          baseDraw.y = (canvas.height - baseDraw.height) / 2;
        } else {
          setBaseDrawDimensions();
        }
      } else if (imageType === "third") {
        thirdImage = img;
      }
      drawImages();
      sendResponse({ success: true });
    };

    img.onerror = () => {
      console.error("Không thể tải ảnh từ URL:", imageUrl);
      alert("Không thể tải ảnh từ URL này. Vui lòng thử lại.");
      sendResponse({ success: false });
    };

    img.src = imageUrl;
    return true; // Giữ kết nối để send response
  }
});

// Xử lý URL parameters khi trang load (để tương thích với cách mở tab mới)
document.addEventListener("DOMContentLoaded", () => {
  // Thêm xử lý cho base và third từ URL
  const urlParams = new URLSearchParams(window.location.search);
  const baseParam = urlParams.get("base");
  const thirdParam = urlParams.get("third");

  if (baseParam && currentLayout === "1:3") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseImage = img;
      setBaseDrawDimensions();
      drawImages();
    };
    img.src = baseParam;
  }

  if (thirdParam && currentLayout === "1:3") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      thirdImage = img;
      drawImages();
    };
    img.src = thirdParam;
  }

  // ... existing code ...
});

// Bing Image Search Logic
const bingSearchInput = document.getElementById("bingSearchInput");
const searchBingBtn = document.getElementById("searchBingBtn");
const clearBingSearch = document.getElementById("clearBingSearch");
const bingResults = document.getElementById("bingResults");

let currentBingQuery = "";
let currentBingFirstIndex = 1;

// Xử lý nút xóa nhanh
if (clearBingSearch && bingSearchInput) {
  clearBingSearch.addEventListener("click", () => {
    bingSearchInput.value = "";
    clearBingSearch.style.display = "none";
    bingSearchInput.focus();
  });

  bingSearchInput.addEventListener("input", () => {
    clearBingSearch.style.display = bingSearchInput.value ? "block" : "none";
  });
}

async function performBingSearch() {
  const query = bingSearchInput.value.trim();
  if (!query) {
    alert("Vui lòng nhập từ khóa tìm kiếm!");
    return;
  }

  // Phân trang: nếu trùng query cũ thì tăng offset lên 10 để lấy loạt ảnh tiếp theo, nếu query mới thì reset về 1
  if (query === currentBingQuery) {
    currentBingFirstIndex += 10;
  } else {
    currentBingQuery = query;
    currentBingFirstIndex = 1;
  }

  // Tự động quyết định target dựa trên trạng thái baseImage
  // Nếu baseImage chưa có -> tìm cho base
  // Nếu baseImage đã có -> tìm cho third
  const type = baseImage ? "third" : "base";

  bingResults.innerHTML = `<p style='width: 100%; text-align: center;'>Đang tìm kiếm cho <b>${type}</b> (Trang ${Math.floor(currentBingFirstIndex / 10) + 1})...</p>`;

  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${currentBingFirstIndex}`;
    // Mở tab mới ở chế độ background (active: false)
    const tab = await chrome.tabs.create({ url, active: false });

    let urls = [];
    // Chờ tab load và thử lấy dữ liệu tối đa 10 lần (mỗi lần cách nhau 1s)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const results = [...document.querySelectorAll(".iusc")];
            const imgs = results.map(el => {
              try {
                const data = JSON.parse(el.getAttribute("m"));
                return data.murl;
              } catch {
                return null;
              }
            }).filter(Boolean);
            return imgs.slice(0, 10);
          }
        });

        if (results && results[0] && results[0].result && results[0].result.length > 0) {
          urls = results[0].result;
          break;
        }
      } catch (e) {
        console.warn("Chưa lấy được data, đang thử lại...", e);
      }
    }

    // Đóng tab sau khi lấy xong hoặc hết thời gian chờ
    chrome.tabs.remove(tab.id);

    if (urls.length === 0) {
      bingResults.innerHTML = "<p style='width: 100%; text-align: center;'>Không tìm thấy ảnh hoặc Bing chưa tải xong. Thử lại nhé!</p>";
      return;
    }

    displayBingResults(urls);

    // Tự động gán ảnh vào các slot trống nếu chưa đủ cả hai ảnh
    if (baseImage && thirdImage) {
      console.log("Cả ảnh base và third đều đã có, không tự động load.");
    } else if (baseImage && !thirdImage) {
      // Đã có base, chưa có third -> load ảnh đầu tiên tìm được vào third
      if (urls.length >= 1) {
        loadImageToSlot(urls[0], "third");
      }
    } else if (!baseImage && thirdImage) {
      // Chưa có base, đã có third -> load ảnh đầu tiên tìm được vào base
      if (urls.length >= 1) {
        loadImageToSlot(urls[0], "base");
      }
    } else {
      // Chưa có cả hai -> tự động gán ảnh 1 vào base và ảnh 2 vào third
      if (urls.length >= 1) {
        loadImageToSlot(urls[0], "base");
      }
      if (urls.length >= 2) {
        loadImageToSlot(urls[1], "third");
      }
    }
  } catch (error) {
    console.error("Lỗi khi tìm kiếm Bing:", error);
    bingResults.innerHTML = "<p style='width: 100%; text-align: center; color: red;'>Lỗi khi tìm kiếm. Vui lòng kiểm tra console.</p>";
  }
}

function displayBingResults(urls) {
  // Tiêu đề hướng dẫn
  bingResults.innerHTML = `<div id="bingTargetInfo" style="width: 100%; margin-bottom: 8px; font-size: 13px; color: #666; text-align: center;">Click để chọn, Double Click để ép làm <b>Base</b></div>`;
  
  const updateTargetInfo = () => {
    const info = document.getElementById("bingTargetInfo");
    if (info) {
      const currentType = baseImage ? "third" : "base";
      info.innerHTML = `Click để chọn (đang là <b>${currentType}</b>), Double Click để ép làm <b>Base</b>`;
    }
  };

  urls.forEach((imageUrl) => {
    const container = document.createElement("div");
    container.style.cssText = `
      width: 120px;
      height: 120px;
      position: relative;
      cursor: pointer;
      border: 2px solid transparent;
      border-radius: 4px;
      overflow: hidden;
      transition: all 0.2s;
    `;

    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;

    container.onmouseover = () => {
      container.style.transform = "scale(1.05)";
      container.style.borderColor = "#2563eb";
    };
    container.onmouseout = () => {
      container.style.transform = "scale(1.0)";
      container.style.borderColor = "transparent";
    };

    let clickTimer = null;

    container.onclick = () => {
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        const type = baseImage ? "third" : "base";
        loadImageToSlot(imageUrl, type);
        updateTargetInfo();
      }, 250); // Đợi xem có phải double click không
    };

    container.ondblclick = (e) => {
      if (clickTimer) clearTimeout(clickTimer);
      loadImageToSlot(imageUrl, "base");
      updateTargetInfo();
    };

    container.appendChild(img);
    bingResults.appendChild(container);
  });
  
  updateTargetInfo();
}

function loadImageToSlot(imageUrl, type) {
  const tempImg = new Image();
  tempImg.crossOrigin = "anonymous";
  tempImg.onload = () => {
    if (type === "base") {
      baseImage = tempImg;
      if (currentLayout === "16:3") {
        const scale = Math.max(canvas.width / tempImg.width, canvas.height / tempImg.height);
        baseDraw.width = tempImg.width * scale;
        baseDraw.height = tempImg.height * scale;
        baseDraw.x = (canvas.width - baseDraw.width) / 2;
        baseDraw.y = (canvas.height - baseDraw.height) / 2;
      } else {
        setBaseDrawDimensions();
      }
    } else if (type === "third") {
      thirdImage = tempImg;
    }
    drawImages();
    console.log(`Đã chọn ảnh ${type} từ Bing`);
  };
  tempImg.onerror = () => {
    alert("Không thể tải ảnh này trực tiếp.");
  };
  tempImg.src = imageUrl;
}

if (searchBingBtn) searchBingBtn.addEventListener("click", performBingSearch);
