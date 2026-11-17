const IMAGE_OVERLAY_LAYOUTS = {
    "1:3": {
        id: "1:3",
        label: "Layout 1:3 (Two Bottom)",
        width: 1000,
        height: 1200,
        topHeight: 600,
        bottomHeight: 600,
        bottomHalfWidth: 500,
        draw(ctx, state) {
            const topHeight = this.topHeight;
            const bottomHeight = this.bottomHeight;
            const bottomHalfWidth = this.bottomHalfWidth;
            ctx.clearRect(0, 0, this.width, this.height);

            if (state.overlayImage) {
                ctx.fillStyle = "white";
                ctx.fillRect(-5, -5, this.width + 10, topHeight + 10);
                ctx.drawImage(state.overlayImage, 0, 0, this.width, topHeight);
            }

            ctx.fillStyle = "white";
            ctx.fillRect(0, topHeight - 5, this.width, 10);
            ctx.fillRect(bottomHalfWidth - 5, topHeight, 10, bottomHeight);

            if (state.baseImage) {
                const scale = Math.max(
                    bottomHalfWidth / state.baseImage.width,
                    bottomHeight / state.baseImage.height,
                );
                const scaledWidth = state.baseImage.width * scale;
                const scaledHeight = state.baseImage.height * scale;
                if (!state.basePosition.initialized) {
                    state.basePosition.x = (bottomHalfWidth - scaledWidth) / 2;
                    state.basePosition.y = topHeight + (bottomHeight - scaledHeight) / 2;
                    state.basePosition.initialized = true;
                }
                ctx.fillStyle = "white";
                ctx.fillRect(0, topHeight, bottomHalfWidth - 5, bottomHeight);
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, topHeight, bottomHalfWidth - 5, bottomHeight);
                ctx.clip();
                ctx.drawImage(state.baseImage, state.basePosition.x, state.basePosition.y, scaledWidth, scaledHeight);
                ctx.restore();
            }

            if (state.thirdImage) {
                const scale = Math.max(
                    bottomHalfWidth / state.thirdImage.width,
                    bottomHeight / state.thirdImage.height,
                );
                const scaledWidth = state.thirdImage.width * scale;
                const scaledHeight = state.thirdImage.height * scale;
                if (!state.thirdPosition.initialized) {
                    state.thirdPosition.x = bottomHalfWidth + (bottomHalfWidth - scaledWidth) / 2;
                    state.thirdPosition.y = topHeight + (bottomHeight - scaledHeight) / 2;
                    state.thirdPosition.initialized = true;
                }
                ctx.fillStyle = "white";
                ctx.fillRect(bottomHalfWidth + 5, topHeight, bottomHalfWidth - 5, bottomHeight);
                ctx.save();
                ctx.beginPath();
                ctx.rect(bottomHalfWidth + 5, topHeight, bottomHalfWidth - 5, bottomHeight);
                ctx.clip();
                ctx.drawImage(state.thirdImage, state.thirdPosition.x, state.thirdPosition.y, scaledWidth, scaledHeight);
                ctx.restore();
            }
        },
        hitTest(x, y) {
            if (y <= this.topHeight) return null;
            return x < this.bottomHalfWidth ? "base" : "third";
        },
    },
};

const imageOverlayState = {
    open: false,
    index: null,
    layoutId: "1:3",
    overlayImage: null,
    overlayLabel: "",
    baseImage: null,
    baseLabel: "",
    basePosition: { x: 0, y: 0, initialized: false },
    thirdImage: null,
    thirdLabel: "",
    thirdPosition: { x: 0, y: 0, initialized: false },
    allowVerticalMove: false,
    contributors: [],
    activeContributors: [],
    currentBingQuery: "",
    currentBingFirstIndex: 1,
    drag: null,
};

function imageOverlayGetLayout() {
    return IMAGE_OVERLAY_LAYOUTS[imageOverlayState.layoutId] || IMAGE_OVERLAY_LAYOUTS["1:3"];
}

function imageOverlayDraw() {
    const canvas = document.getElementById("imageOverlayCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const layout = imageOverlayGetLayout();
    if (canvas.width !== layout.width || canvas.height !== layout.height) {
        canvas.width = layout.width;
        canvas.height = layout.height;
    }
    layout.draw(ctx, imageOverlayState);
    imageOverlayUpdateSlotStatus();
}

function imageOverlayUpdateSlotStatus() {
    const status = document.getElementById("imageOverlaySlotStatus");
    if (!status) return;
    const rows = [
        `⬆ Top: ${imageOverlayState.overlayLabel || "Chưa có"}`,
        `⬅ Base: ${imageOverlayState.baseLabel || "Trống (điền trước)"}`,
        `➡ Third: ${imageOverlayState.thirdLabel || "Trống"}`,
    ];
    status.innerHTML = rows.map(row => `<span>${row}</span>`).join("");
}

function imageOverlaySetMessage(message, isError = false) {
    const element = document.getElementById("imageOverlayMessage");
    if (!element) return;
    element.textContent = message || "";
    element.style.color = isError ? "#ef4444" : "#475569";
}

function imageOverlayLoadImage(sourceUrl, crossOrigin) {
    return new Promise(resolve => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = sourceUrl;
    });
}

async function imageOverlayLoadTopImage(article) {
    const url = article.customThumbnailUrl || getThumbnailVariantUrl(article.videoId, article.thumbnailVariant);
    let img = await imageOverlayLoadImage(url, true);
    if (!img) img = await imageOverlayLoadImage(url, false);
    if (img) {
        imageOverlayState.overlayImage = img;
        imageOverlayState.overlayLabel = article.customThumbnailUrl ? "Custom thumbnail" : `${article.thumbnailVariant || "maxresdefault"}.jpg`;
    } else {
        imageOverlayState.overlayImage = null;
        imageOverlayState.overlayLabel = "";
        imageOverlaySetMessage("Không tải được thumbnail của bài.", true);
    }
    imageOverlayDraw();
}

function imageOverlayProxyUrl(imageUrl) {
    return "/bing-image-proxy?url=" + encodeURIComponent(imageUrl);
}

async function imageOverlayLoadImageToSlot(imageUrl, type) {
    const label = imageUrl.length > 60 ? imageUrl.slice(0, 57) + "..." : imageUrl;
    let img = await imageOverlayLoadImage(imageOverlayProxyUrl(imageUrl), true);
    if (!img) img = await imageOverlayLoadImage(imageUrl, false);
    if (!img) {
        imageOverlaySetMessage("Không thể tải ảnh này.", true);
        return;
    }
    if (type === "base") {
        imageOverlayState.baseImage = img;
        imageOverlayState.baseLabel = label;
        imageOverlayState.basePosition = { x: 0, y: 0, initialized: false };
    } else {
        imageOverlayState.thirdImage = img;
        imageOverlayState.thirdLabel = label;
        imageOverlayState.thirdPosition = { x: 0, y: 0, initialized: false };
    }
    imageOverlaySetMessage("");
    imageOverlayDraw();
}

function imageOverlayExtractContributors(article) {
    const html = String(article?.contributors || "");
    if (html) {
        const names = html.split(",").map(name => name.trim()).filter(Boolean);
        if (names.length) return [...new Set(names)];
    }

    const articleHtml = String(article?.article || "");
    const explicit = articleHtml.match(/contributors\s*:\s*([^\n<]+)/i);
    if (explicit && explicit[1]) {
        const names = explicit[1].split(",").map(name => name.trim()).filter(Boolean);
        if (names.length) return [...new Set(names)];
    }

    const text = articleHtml.replace(/<[^>]*>/g, " ");
    const seen = new Set();
    const nameRegex = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}\b/g;
    let match;
    while ((match = nameRegex.exec(text)) && seen.size < 8) {
        seen.add(match[0].trim());
    }
    return [...seen];
}

function imageOverlayRenderContributors(article) {
    const container = document.getElementById("imageOverlayContributorsContainer");
    const list = document.getElementById("imageOverlayContributorsList");
    const quickSelects = document.getElementById("imageOverlayBingQuickSelects");
    if (!container || !list || !quickSelects) return;

    imageOverlayState.contributors = imageOverlayExtractContributors(article);
    list.innerHTML = "";
    quickSelects.innerHTML = "";
    container.style.display = imageOverlayState.contributors.length ? "block" : "none";

    const titleText = String(article?.title || "").toLowerCase();
    imageOverlayState.contributors.forEach(contributor => {
        const tag = document.createElement("span");
        tag.className = "image-overlay-contributor-tag";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = contributor;
        nameSpan.style.cursor = "pointer";

        const bingIcon = document.createElement("span");
        bingIcon.className = "image-overlay-bing-icon";
        bingIcon.textContent = "🔍";
        bingIcon.title = "Điền vào tìm kiếm Bing";
        bingIcon.style.cursor = "pointer";

        const words = contributor.toLowerCase().split(/\s+/);
        if (titleText && words.some(word => titleText.includes(word))) {
            tag.classList.add("is-highlighted");
        }

        nameSpan.addEventListener("click", () => {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(contributor)}`, "_blank");
        });

        bingIcon.addEventListener("click", () => {
            const input = document.getElementById("imageOverlaySearchInput");
            if (!input) return;
            const currentValue = input.value.trim();
            if (currentValue && !currentValue.includes(contributor)) {
                input.value = currentValue + " " + contributor;
            } else if (!currentValue) {
                input.value = contributor;
            }
            input.focus();
        });

        tag.appendChild(nameSpan);
        tag.appendChild(bingIcon);
        list.appendChild(tag);
    });

    imageOverlayState.contributors.forEach(contributor => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "image-overlay-quick-btn";
        btn.textContent = contributor;
        btn.addEventListener("click", () => {
            const input = document.getElementById("imageOverlaySearchInput");
            if (!input) return;
            const active = imageOverlayState.activeContributors;
            const pos = active.indexOf(contributor);
            if (pos > -1) {
                active.splice(pos, 1);
                btn.classList.remove("is-active");
            } else {
                active.push(contributor);
                btn.classList.add("is-active");
            }
            input.value = active.join(" ");
        });
        btn.addEventListener("dblclick", () => {
            const input = document.getElementById("imageOverlaySearchInput");
            if (!input) return;
            imageOverlayState.activeContributors = [contributor];
            input.value = contributor;
            quickSelects.querySelectorAll(".image-overlay-quick-btn").forEach(el => el.classList.remove("is-active"));
            btn.classList.add("is-active");
            imageOverlayRunSearch();
        });
        quickSelects.appendChild(btn);
    });
}

function imageOverlaySetResultsHint() {
    const results = document.getElementById("imageOverlaySearchResults");
    if (!results) return;
    const type = imageOverlayState.baseImage ? "third" : "base";
    results.innerHTML = `<p class="image-overlay-results-hint">Click để chọn (đang là <b>${type}</b>), Double Click để ép làm <b>Base</b></p>`;
}

function imageOverlayUpdateResultsHint() {
    const results = document.getElementById("imageOverlaySearchResults");
    if (!results) return;
    const hint = results.querySelector(".image-overlay-results-hint");
    if (!hint) return;
    const type = imageOverlayState.baseImage ? "third" : "base";
    hint.innerHTML = `Click để chọn (đang là <b>${type}</b>), Double Click để ép làm <b>Base</b>`;
}

function imageOverlayDisplayResults(urls) {
    const results = document.getElementById("imageOverlaySearchResults");
    if (!results) return;
    imageOverlaySetResultsHint();

    urls.forEach(imageUrl => {
        const container = document.createElement("div");
        container.className = "image-overlay-result-item";
        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = imageOverlayProxyUrl(imageUrl);
        img.addEventListener("error", () => {
            img.src = imageUrl;
        });
        container.appendChild(img);

        let clickTimer = null;
        container.onclick = () => {
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                const type = imageOverlayState.baseImage ? "third" : "base";
                imageOverlayLoadImageToSlot(imageUrl, type);
                imageOverlayUpdateResultsHint();
            }, 250);
        };
        container.ondblclick = event => {
            event.preventDefault();
            if (clickTimer) clearTimeout(clickTimer);
            imageOverlayLoadImageToSlot(imageUrl, "base");
            imageOverlayUpdateResultsHint();
        };

        results.appendChild(container);
    });
}

async function imageOverlayRunSearch() {
    const input = document.getElementById("imageOverlaySearchInput");
    const results = document.getElementById("imageOverlaySearchResults");
    if (!input || !results) return;
    const query = input.value.trim();
    if (!query) {
        imageOverlaySetMessage("Vui lòng nhập từ khóa tìm kiếm!", true);
        return;
    }

    if (query === imageOverlayState.currentBingQuery) {
        imageOverlayState.currentBingFirstIndex += 10;
    } else {
        imageOverlayState.currentBingQuery = query;
        imageOverlayState.currentBingFirstIndex = 1;
    }
    const type = imageOverlayState.baseImage ? "third" : "base";
    results.innerHTML = `<p class="image-overlay-results-hint">Đang tìm kiếm cho <b>${type}</b> (Trang ${Math.floor(imageOverlayState.currentBingFirstIndex / 10) + 1})...</p>`;

    try {
        const response = await fetch(`/bing-image-search?q=${encodeURIComponent(query)}&first=${imageOverlayState.currentBingFirstIndex}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.images || data.images.length === 0) {
            results.innerHTML = "<p class=\"image-overlay-results-hint\">Không tìm thấy ảnh. Thử lại nhé!</p>";
            return;
        }
        imageOverlayDisplayResults(data.images);

        if (imageOverlayState.baseImage && imageOverlayState.thirdImage) {
            return;
        }
        if (imageOverlayState.baseImage && !imageOverlayState.thirdImage) {
            imageOverlayLoadImageToSlot(data.images[0], "third");
        } else if (!imageOverlayState.baseImage && imageOverlayState.thirdImage) {
            imageOverlayLoadImageToSlot(data.images[0], "base");
        } else {
            imageOverlayLoadImageToSlot(data.images[0], "base");
            if (data.images.length >= 2) {
                imageOverlayLoadImageToSlot(data.images[1], "third");
            }
        }
    } catch (error) {
        results.innerHTML = `<p class="image-overlay-results-hint" style="color:#ef4444;">${error.message || "Lỗi khi tìm kiếm."}</p>`;
    }
}

function imageOverlayToggleMove() {
    imageOverlayState.allowVerticalMove = !imageOverlayState.allowVerticalMove;
    const btn = document.getElementById("imageOverlayMoveBtn");
    if (btn) {
        btn.textContent = imageOverlayState.allowVerticalMove ? "🔒 Lock Y" : "↔ Move X";
    }
    const canvas = document.getElementById("imageOverlayCanvas");
    if (canvas) {
        canvas.style.cursor = "move";
    }
}

function imageOverlayBindCanvasEvents() {
    const canvas = document.getElementById("imageOverlayCanvas");
    if (!canvas || canvas.dataset.imageOverlayBound) return;
    canvas.dataset.imageOverlayBound = "true";

    const getCanvasPoint = event => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };

    canvas.addEventListener("pointerdown", event => {
        if (!imageOverlayState.open) return;
        const layout = imageOverlayGetLayout();
        const point = getCanvasPoint(event);
        const slot = layout.hitTest(point.x, point.y);
        if (!slot) return;
        const position = slot === "base" ? imageOverlayState.basePosition : imageOverlayState.thirdPosition;
        const hasImage = slot === "base" ? imageOverlayState.baseImage : imageOverlayState.thirdImage;
        if (!hasImage) return;
        imageOverlayState.drag = {
            slot,
            startX: point.x,
            startY: point.y,
            originX: position.x,
            originY: position.y,
        };
        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", event => {
        if (!imageOverlayState.drag) return;
        const layout = imageOverlayGetLayout();
        const point = getCanvasPoint(event);
        const position = imageOverlayState.drag.slot === "base" ? imageOverlayState.basePosition : imageOverlayState.thirdPosition;
        if (imageOverlayState.allowVerticalMove) {
            position.x = imageOverlayState.drag.originX + (point.x - imageOverlayState.drag.startX);
        } else {
            position.y = imageOverlayState.drag.originY + (point.y - imageOverlayState.drag.startY);
        }
        layout.draw(canvas.getContext("2d"), imageOverlayState);
    });

    const endDrag = () => {
        imageOverlayState.drag = null;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
}

function switchStoryTab(tab) {
    const storyPane = document.getElementById("storyPane");
    const imagePane = document.getElementById("imagePane");
    const storyTabButton = document.getElementById("storyTabButton");
    const imageTabButton = document.getElementById("imageTabButton");
    const regenButton = document.getElementById("storyRegenThumbButton");
    const copyAllButton = document.getElementById("storyCopyAllButton");
    if (!storyPane || !imagePane) return;

    if (tab === "image") {
        storyPane.classList.remove("active");
        imagePane.classList.add("active");
        if (storyTabButton) storyTabButton.classList.remove("active");
        if (imageTabButton) imageTabButton.classList.add("active");
        if (regenButton) regenButton.style.display = "none";
        if (copyAllButton) copyAllButton.style.display = "none";
        imageOverlayState.open = true;
        imageOverlayActivate();
        return;
    }

    storyPane.classList.add("active");
    imagePane.classList.remove("active");
    if (storyTabButton) storyTabButton.classList.add("active");
    if (imageTabButton) imageTabButton.classList.remove("active");
    if (regenButton) regenButton.style.display = "";
    if (copyAllButton) copyAllButton.style.display = "";
    imageOverlayState.open = false;
    imageOverlayState.drag = null;
}

async function imageOverlayActivate() {
    const index = typeof activeStoryCardIndex === "number" ? activeStoryCardIndex : null;
    if (index === null) {
        imageOverlaySetMessage("Không xác định được bài viết đang mở.", true);
        return;
    }
    const article = getSavedArticleByIndex(index);
    if (!article || !article.videoId) {
        imageOverlaySetMessage("Chưa có bài viết cho bài " + (index + 1) + ".", true);
        return;
    }

    imageOverlayState.index = index;
    imageOverlayState.layoutId = "1:3";
    imageOverlayState.overlayImage = null;
    imageOverlayState.overlayLabel = "";
    imageOverlayState.baseImage = null;
    imageOverlayState.baseLabel = "";
    imageOverlayState.basePosition = { x: 0, y: 0, initialized: false };
    imageOverlayState.thirdImage = null;
    imageOverlayState.thirdLabel = "";
    imageOverlayState.thirdPosition = { x: 0, y: 0, initialized: false };
    imageOverlayState.allowVerticalMove = false;
    imageOverlayState.currentBingQuery = "";
    imageOverlayState.currentBingFirstIndex = 1;
    imageOverlayState.drag = null;
    imageOverlayState.activeContributors = [];

    const fileName = getImageFileName(index);
    const fileNameElement = document.getElementById("imageOverlayFileName");
    if (fileNameElement) fileNameElement.textContent = `— ${fileName}`;
    const moveBtn = document.getElementById("imageOverlayMoveBtn");
    if (moveBtn) moveBtn.textContent = "↔ Move X";
    const layoutSelect = document.getElementById("imageOverlayLayoutSelect");
    if (layoutSelect) layoutSelect.value = "1:3";
    const searchInput = document.getElementById("imageOverlaySearchInput");
    if (searchInput) searchInput.value = "";
    imageOverlaySetMessage("");

    imageOverlayRenderContributors(article);
    imageOverlaySetResultsHint();
    imageOverlayUpdateSlotStatus();

    imageOverlayBindCanvasEvents();
    imageOverlayDraw();
    await imageOverlayLoadTopImage(article);

    // Tự gắn base/third: mỗi tên contributor đầu tìm riêng 1 ảnh để tránh
    // trùng ảnh giữa các bài khi trùng tên.
    if (imageOverlayState.contributors.length > 0) {
        imageOverlayAutoFillSlots(imageOverlayState.contributors);
    }
}

async function imageOverlayFetchBingImages(query) {
    const response = await fetch(
        `/bing-image-search?q=${encodeURIComponent(query)}&first=1`,
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.images || [];
}

async function imageOverlayAutoFillSlots(names) {
    imageOverlayState.currentBingQuery = names[0];
    imageOverlayState.currentBingFirstIndex = 1;

    try {
        const baseImages = await imageOverlayFetchBingImages(names[0]);
        if (baseImages.length === 0) {
            const results = document.getElementById("imageOverlaySearchResults");
            if (results) {
                results.innerHTML = "<p class=\"image-overlay-results-hint\">Không tìm thấy ảnh. Thử lại nhé!</p>";
            }
            return;
        }

        const thirdImages = names.length > 1
            ? await imageOverlayFetchBingImages(names[1]).catch(() => [])
            : [];

        if (thirdImages.length > 0) {
            await imageOverlayLoadImageToSlot(baseImages[0], "base");
            await imageOverlayLoadImageToSlot(thirdImages[0], "third");
            imageOverlayDisplayResults(thirdImages);
        } else {
            await imageOverlayLoadImageToSlot(baseImages[0], "base");
            if (baseImages.length > 1) {
                await imageOverlayLoadImageToSlot(baseImages[1], "third");
            }
            imageOverlayDisplayResults(baseImages);
        }
    } catch (error) {
        imageOverlaySetMessage(error.message || "Lỗi khi tự tìm ảnh.", true);
    }
}

function imageOverlayToBlob() {
    const canvas = document.getElementById("imageOverlayCanvas");
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), "image/png");
    });
}

async function imageOverlayDownload() {
    try {
        const blob = await imageOverlayToBlob();
        if (!blob) {
            imageOverlaySetMessage("Không tạo được ảnh PNG.", true);
            return;
        }
        saveDownloadBlob(blob, getImageFileName(imageOverlayState.index));
        imageOverlaySetMessage("Đã tải PNG về máy.");
    } catch (error) {
        imageOverlaySetMessage(error.message || "Tải ảnh thất bại.", true);
    }
}

async function imageOverlaySaveToDir() {
    const dirPath = getDownloadDirPath();
    if (!dirPath) {
        imageOverlaySetMessage("Chưa nhập thư mục lưu video (Download folder).", true);
        return;
    }
    const saveButton = document.getElementById("imageOverlaySaveBtn");
    const originalLabel = saveButton ? saveButton.textContent : "";
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "⏳ Đang lưu...";
    }
    try {
        const blob = await imageOverlayToBlob();
        if (!blob) throw new Error("Không tạo được ảnh PNG.");
        const fileName = getImageFileName(imageOverlayState.index);
        await saveVideoToDirPath(blob, fileName, dirPath);
        imageOverlaySetMessage(`Đã lưu ${fileName} vào ${dirPath}`);
    } catch (error) {
        imageOverlaySetMessage(error.message || "Lưu ảnh thất bại.", true);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalLabel;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("imageOverlaySearchInput");
    if (searchInput) {
        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                imageOverlayRunSearch();
            }
        });
    }
    const layoutSelect = document.getElementById("imageOverlayLayoutSelect");
    if (layoutSelect) {
        layoutSelect.addEventListener("change", event => {
            imageOverlayState.layoutId = event.target.value;
            imageOverlayDraw();
        });
    }
});
