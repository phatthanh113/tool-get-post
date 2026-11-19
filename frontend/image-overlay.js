const IMAGE_OVERLAY_LAYOUTS = {
    "1:3": {
        id: "1:3",
        label: "Layout 1:3 (Two Bottom)",
        width: 1000,
        height: 1200,
        topHeight: 600,
        bottomHeight: 600,
        bottomHalfWidth: 500,
        draw(ctx, state, highlightSlot) {
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

            if (highlightSlot === "base" || highlightSlot === "third") {
                const cell = highlightSlot === "base"
                    ? { x: 0, y: topHeight, w: bottomHalfWidth - 5, h: bottomHeight }
                    : { x: bottomHalfWidth + 5, y: topHeight, w: bottomHalfWidth - 5, h: bottomHeight };
                ctx.save();
                ctx.setLineDash([14, 10]);
                ctx.lineWidth = 5;
                ctx.strokeStyle = "#2563eb";
                ctx.strokeRect(cell.x + 4, cell.y + 4, cell.w - 8, cell.h - 8);
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
    baseUrl: null,
    basePosition: { x: 0, y: 0, initialized: false },
    thirdImage: null,
    thirdLabel: "",
    thirdUrl: null,
    thirdPosition: { x: 0, y: 0, initialized: false },
    allowVerticalMove: false,
    contributors: [],
    activeContributors: [],
    currentBingQuery: "",
    currentBingFirstIndex: 1,
    drag: null,
    dropSlot: null,
};

const imageOverlayCache = new Map();

function imageOverlaySaveCache() {
    if (!Number.isFinite(imageOverlayState.index)) return;
    imageOverlayCache.set(imageOverlayState.index, {
        overlayImage: imageOverlayState.overlayImage,
        overlayLabel: imageOverlayState.overlayLabel,
        baseImage: imageOverlayState.baseImage,
        baseLabel: imageOverlayState.baseLabel,
        baseUrl: imageOverlayState.baseUrl,
        basePosition: { ...imageOverlayState.basePosition },
        thirdImage: imageOverlayState.thirdImage,
        thirdLabel: imageOverlayState.thirdLabel,
        thirdUrl: imageOverlayState.thirdUrl,
        thirdPosition: { ...imageOverlayState.thirdPosition },
    });
}

// Lưu lựa chọn ảnh (URL + vị trí) vào bài viết trong localStorage để khôi phục
// lại đúng ảnh cũ sau khi reload trang, thay vì tự tìm lại trên Bing.
function imageOverlayPersistSelection() {
    if (!Number.isFinite(imageOverlayState.index)) return;
    updateSavedArticle(imageOverlayState.index, "imageOverlaySelection", {
        base: imageOverlayState.baseUrl || "",
        baseLabel: imageOverlayState.baseLabel || "",
        baseX: Math.round(imageOverlayState.basePosition.x),
        baseY: Math.round(imageOverlayState.basePosition.y),
        third: imageOverlayState.thirdUrl || "",
        thirdLabel: imageOverlayState.thirdLabel || "",
        thirdX: Math.round(imageOverlayState.thirdPosition.x),
        thirdY: Math.round(imageOverlayState.thirdPosition.y),
    });
}

function imageOverlaySelectionHasStoredImage(article) {
    const selection = article?.imageOverlaySelection;
    if (!selection) return false;
    const hasBase = typeof selection.base === "string" && selection.base.startsWith("http");
    const hasThird = typeof selection.third === "string" && selection.third.startsWith("http");
    return hasBase || hasThird;
}

// Bài bị xóa: bỏ cache ảnh của bài đó, dồn cache các bài phía sau lên đúng index mới.
function imageOverlayCacheAfterDelete(deletedIndex) {
    if (!Number.isInteger(deletedIndex)) return;
    const shiftedEntries = [];
    imageOverlayCache.forEach((entry, cachedIndex) => {
        if (cachedIndex === deletedIndex) return;
        shiftedEntries.push([cachedIndex > deletedIndex ? cachedIndex - 1 : cachedIndex, entry]);
    });
    imageOverlayCache.clear();
    shiftedEntries.forEach(([cachedIndex, entry]) => imageOverlayCache.set(cachedIndex, entry));
}

// Xóa sạch cache ảnh (dùng khi remove toàn bộ saved_articles).
function imageOverlayCacheClearAll() {
    imageOverlayCache.clear();
}

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
    layout.draw(ctx, imageOverlayState, imageOverlayState.dropSlot);
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
    imageOverlaySaveCache();
    imageOverlayDraw();
}

function imageOverlayProxyUrl(imageUrl) {
    return "/bing-image-proxy?url=" + encodeURIComponent(imageUrl);
}

async function imageOverlayLoadImageToSlot(imageUrl, type) {
    const label = imageUrl.startsWith("data:")
        ? "Ảnh kéo thả"
        : imageUrl.length > 60
            ? imageUrl.slice(0, 57) + "..."
            : imageUrl;
    let img;
    if (imageUrl.startsWith("data:")) {
        img = await imageOverlayLoadImage(imageUrl, false);
    } else {
        img = await imageOverlayLoadImage(imageOverlayProxyUrl(imageUrl), true);
        if (!img) img = await imageOverlayLoadImage(imageUrl, false);
    }
    if (!img) {
        imageOverlaySetMessage("Không thể tải ảnh này.", true);
        return;
    }
    if (type === "base") {
        imageOverlayState.baseImage = img;
        imageOverlayState.baseLabel = label;
        imageOverlayState.baseUrl = imageUrl.startsWith("data:") ? null : imageUrl;
        imageOverlayState.basePosition = { x: 0, y: 0, initialized: false };
    } else {
        imageOverlayState.thirdImage = img;
        imageOverlayState.thirdLabel = label;
        imageOverlayState.thirdUrl = imageUrl.startsWith("data:") ? null : imageUrl;
        imageOverlayState.thirdPosition = { x: 0, y: 0, initialized: false };
    }
    imageOverlaySetMessage("");
    imageOverlaySaveCache();
    imageOverlayPersistSelection();
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
        container.draggable = true;
        container.addEventListener("dragstart", event => {
            event.dataTransfer.setData("text/x-overlay-url", imageUrl);
            event.dataTransfer.setData("text/uri-list", imageUrl);
            event.dataTransfer.effectAllowed = "copy";
        });
        const img = document.createElement("img");
        img.loading = "lazy";
        img.draggable = false;
        img.src = imageOverlayProxyUrl(imageUrl);
        img.addEventListener("error", () => {
            if (img.dataset.fallbackTried) return;
            img.dataset.fallbackTried = "1";
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
        btn.textContent = imageOverlayState.allowVerticalMove ? "↔ Move X" : "🔒 Lock Y";
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
        layout.draw(canvas.getContext("2d"), imageOverlayState, imageOverlayState.dropSlot);
    });

    const endDrag = () => {
        imageOverlayState.drag = null;
        imageOverlaySaveCache();
        imageOverlayPersistSelection();
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    const wrap = canvas.closest(".image-overlay-canvas-wrap");
    canvas.addEventListener("dragover", event => {
        if (!imageOverlayState.open) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        const point = getCanvasPoint(event);
        const slot = imageOverlayGetLayout().hitTest(point.x, point.y);
        if (slot !== imageOverlayState.dropSlot) {
            imageOverlayState.dropSlot = slot;
            imageOverlayDraw();
        }
        if (wrap) wrap.classList.add("drag-over");
    });

    const clearDropHighlight = () => {
        imageOverlayState.dropSlot = null;
        imageOverlayDraw();
        if (wrap) wrap.classList.remove("drag-over");
    };

    canvas.addEventListener("dragleave", clearDropHighlight);

    canvas.addEventListener("drop", async event => {
        if (!imageOverlayState.open) return;
        event.preventDefault();
        const point = getCanvasPoint(event);
        const slot = imageOverlayGetLayout().hitTest(point.x, point.y);
        clearDropHighlight();
        if (!slot) {
            imageOverlaySetMessage("Chỉ thả vào ô Base (trái) hoặc Third (phải).", true);
            return;
        }
        const payload = imageOverlayResolveDropData(event.dataTransfer);
        if (!payload) {
            imageOverlaySetMessage("Không tìm thấy ảnh trong dữ liệu kéo thả.", true);
            return;
        }
        try {
            if (payload.kind === "file") {
                const dataUrl = await imageOverlayFileToDataUrl(payload.file);
                await imageOverlayLoadImageToSlot(dataUrl, slot);
            } else {
                await imageOverlayLoadImageToSlot(payload.url, slot);
            }
            imageOverlaySetMessage("");
        } catch (error) {
            imageOverlaySetMessage(error.message || "Không thể gán ảnh vừa thả.", true);
        }
    });
}

function imageOverlayResolveDropData(dataTransfer) {
    if (!dataTransfer) return null;

    if (dataTransfer.files && dataTransfer.files.length > 0) {
        const file = [...dataTransfer.files].find(file => file.type.startsWith("image/"));
        if (file) return { kind: "file", file };
    }

    const customUrl = dataTransfer.getData("text/x-overlay-url");
    if (customUrl && /^https?:\/\//i.test(customUrl)) {
        return { kind: "url", url: customUrl };
    }

    const uriList = dataTransfer.getData("text/uri-list");
    if (uriList) {
        const url = uriList
            .split(/\r?\n/)
            .map(line => line.trim())
            .find(line => line && !line.startsWith("#"));
        if (url && /^https?:\/\//i.test(url)) {
            return { kind: "url", url };
        }
    }

    const html = dataTransfer.getData("text/html");
    if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && /^https?:\/\//i.test(match[1])) {
            return { kind: "url", url: match[1] };
        }
    }

    const text = dataTransfer.getData("text/plain");
    if (text && /^https?:\/\//i.test(text.trim())) {
        return { kind: "url", url: text.trim() };
    }

    return null;
}

function imageOverlayFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
        reader.readAsDataURL(file);
    });
}

async function imageOverlayChangeTopVariant(variant) {
    const index = imageOverlayState.index;
    if (index === null || index === undefined) return;
    const article = getSavedArticleByIndex(index);
    if (!article || !article.videoId) return;

    const url = getThumbnailVariantUrl(article.videoId, variant);
    const img = await imageOverlayLoadImage(url, true);
    if (!img) {
        imageOverlaySetMessage(`${variant} không tồn tại cho video này.`, true);
        const select = document.getElementById("imageOverlayTopVariantSelect");
        if (select) {
            select.value = ["maxresdefault", "maxres1", "maxres2", "hqdefault"].includes(article.thumbnailVariant)
                ? article.thumbnailVariant
                : "maxresdefault";
        }
        return;
    }

    updateThumbnailVariant(article.url, variant, index);
    imageOverlayState.overlayImage = img;
    imageOverlayState.overlayLabel = `${variant}.jpg`;
    imageOverlaySaveCache();
    imageOverlayDraw();
    imageOverlaySetMessage("");
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
    imageOverlayState.allowVerticalMove = false;
    imageOverlayState.currentBingQuery = "";
    imageOverlayState.currentBingFirstIndex = 1;
    imageOverlayState.drag = null;
    imageOverlayState.activeContributors = [];

    const fileName = getImageFileName(index);
    const fileNameElement = document.getElementById("imageOverlayFileName");
    if (fileNameElement) fileNameElement.textContent = `— ${fileName}`;
    const moveBtn = document.getElementById("imageOverlayMoveBtn");
    if (moveBtn) moveBtn.textContent = "🔒 Lock Y";
    const layoutSelect = document.getElementById("imageOverlayLayoutSelect");
    if (layoutSelect) layoutSelect.value = "1:3";
    const searchInput = document.getElementById("imageOverlaySearchInput");
    if (searchInput) searchInput.value = "";
    const topSelect = document.getElementById("imageOverlayTopVariantSelect");
    if (topSelect) {
        topSelect.value = ["maxresdefault", "maxres1", "maxres2", "hqdefault"].includes(article.thumbnailVariant)
            ? article.thumbnailVariant
            : "maxresdefault";
    }
    imageOverlaySetMessage("");

    imageOverlayRenderContributors(article);
    imageOverlaySetResultsHint();
    imageOverlayUpdateSlotStatus();

    imageOverlayBindCanvasEvents();

    const cached = imageOverlayCache.get(index);
    if (cached) {
        imageOverlayState.overlayImage = cached.overlayImage;
        imageOverlayState.overlayLabel = cached.overlayLabel;
        imageOverlayState.baseImage = cached.baseImage;
        imageOverlayState.baseLabel = cached.baseLabel;
        imageOverlayState.baseUrl = cached.baseUrl;
        imageOverlayState.basePosition = { ...cached.basePosition };
        imageOverlayState.thirdImage = cached.thirdImage;
        imageOverlayState.thirdLabel = cached.thirdLabel;
        imageOverlayState.thirdUrl = cached.thirdUrl;
        imageOverlayState.thirdPosition = { ...cached.thirdPosition };
        imageOverlayDraw();
        return;
    }

    imageOverlayState.overlayImage = null;
    imageOverlayState.overlayLabel = "";
    imageOverlayState.baseImage = null;
    imageOverlayState.baseLabel = "";
    imageOverlayState.baseUrl = null;
    imageOverlayState.basePosition = { x: 0, y: 0, initialized: false };
    imageOverlayState.thirdImage = null;
    imageOverlayState.thirdLabel = "";
    imageOverlayState.thirdUrl = null;
    imageOverlayState.thirdPosition = { x: 0, y: 0, initialized: false };

    imageOverlayDraw();
    await imageOverlayLoadTopImage(article);

    // Bài đã chọn ảnh trước đó: lấy lại đúng ảnh cũ đã lưu, không tự tìm lại trên Bing.
    const selection = article.imageOverlaySelection;
    if (imageOverlaySelectionHasStoredImage(article)) {
        if (typeof selection.base === "string" && selection.base.startsWith("http")) {
            await imageOverlayLoadImageToSlot(selection.base, "base");
            imageOverlayState.basePosition = {
                x: Number(selection.baseX) || 0,
                y: Number(selection.baseY) || 0,
                initialized: true,
            };
        }
        if (typeof selection.third === "string" && selection.third.startsWith("http")) {
            await imageOverlayLoadImageToSlot(selection.third, "third");
            imageOverlayState.thirdPosition = {
                x: Number(selection.thirdX) || 0,
                y: Number(selection.thirdY) || 0,
                initialized: true,
            };
        }
        imageOverlaySaveCache();
        imageOverlayPersistSelection();
        imageOverlayDraw();
        return;
    }

    // Tự gắn base/third: mỗi tên contributor đầu tìm riêng 1 ảnh để tránh
    // trùng ảnh giữa các bài khi trùng tên.
    if (imageOverlayState.contributors.length > 0) {
        await imageOverlayAutoFillSlots(imageOverlayState.contributors);
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
