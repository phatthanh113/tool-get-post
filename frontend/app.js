            const DEFAULT_LINASTORY_COPY_TEMPLATE = "{title}\t{link}";
            const LINASTORY_STORY_PHRASES = {
                English: "Full Story",
                German: "Vollständige Geschichte",
            };
            let matchedLinastoryArticles = [];

            function getLinastoryCopyTemplate() {
                return localStorage.getItem("linastoryCustomCopyTemplate") || DEFAULT_LINASTORY_COPY_TEMPLATE;
            }

            function setLinastoryCopyStatus(message, isError = false) {
                const status = document.getElementById("linastoryCopyStatus");
                if (!status) return;
                status.textContent = message;
                status.style.color = isError ? "#dc2626" : "var(--text-muted)";
            }

            function openLinastoryCopySettings(event) {
                event.preventDefault();
                const articlesDialog = document.getElementById("linastoryArticlesDialog");
                if (articlesDialog.open) articlesDialog.close();
                const dialog = document.getElementById("linastoryCopyDialog");
                document.getElementById("linastoryCopyTemplate").value = getLinastoryCopyTemplate();
                updateLinastoryCopyPreview();
                if (!dialog.open) dialog.showModal();
            }

            function openLinastoryCopySettingsFromList() {
                const articlesDialog = document.getElementById("linastoryArticlesDialog");
                if (articlesDialog.open) articlesDialog.close();
                openLinastoryCopySettings({ preventDefault() {} });
            }

            function backToLinastoryArticles() {
                const settingsDialog = document.getElementById("linastoryCopyDialog");
                if (settingsDialog.open) settingsDialog.close();
                const articlesDialog = document.getElementById("linastoryArticlesDialog");
                renderLinastoryArticlesList();
                if (!articlesDialog.open) articlesDialog.showModal();
            }

            function closeLinastoryCopySettings() {
                document.getElementById("linastoryCopyDialog").close();
            }

            function closeLinastoryArticlesModal() {
                document.getElementById("linastoryArticlesDialog").close();
            }

            function setLinastoryCopyPreset(template) {
                document.getElementById("linastoryCopyTemplate").value = template;
                updateLinastoryCopyPreview();
            }

            function escapeLinastoryRegExp(value) {
                return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }

            function getLinastoryStoryPhrase(language) {
                return LINASTORY_STORY_PHRASES[language] || LINASTORY_STORY_PHRASES.English;
            }

            function getLinastoryStoryPhrasePattern() {
                const phrases = Object.values(LINASTORY_STORY_PHRASES).map(escapeLinastoryRegExp);
                return new RegExp(`(${phrases.join("|")})(\\s*👉)?`, "i");
            }

            function adaptLinastoryCopyTemplateToLanguage(template, language) {
                const text = String(template || "");
                const match = text.match(getLinastoryStoryPhrasePattern());
                if (!match) return null;
                const phrase = getLinastoryStoryPhrase(language);
                const replacement = match[2] ? `${phrase} 👉` : phrase;
                return text.replace(match[0], replacement);
            }

            function renderLinastoryPresetCards() {
                const container = document.getElementById("linastoryPresetCards");
                if (!container) return;
                container.replaceChildren();
                Object.values(LINASTORY_STORY_PHRASES).forEach((phrase) => {
                    const template = `${phrase} 👉 {shortlink}`;
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "linastory-template-card";
                    button.dataset.copyTemplate = template;
                    button.textContent = template;
                    button.addEventListener("click", () => insertLinastoryCopyToken(template));
                    container.appendChild(button);
                });
            }

            function syncLinastoryCopyTemplateToArticleLanguage() {
                const language = document.getElementById("language-select")?.value || "English";
                const stored = getLinastoryCopyTemplate();
                const adapted = adaptLinastoryCopyTemplateToLanguage(stored, language);
                if (adapted === null || adapted === stored) return;
                const input = document.getElementById("linastoryCopyTemplate");
                const dialog = document.getElementById("linastoryCopyDialog");
                if (input && dialog?.open) {
                    input.value = adapted;
                    updateLinastoryCopyPreview();
                    document.querySelector("#linastoryCopyDialog .btn-primary")?.click();
                    return;
                }
                try {
                    localStorage.setItem("linastoryCustomCopyTemplate", adapted);
                } catch (error) {}
            }

            function insertLinastoryCopyToken(token) {
                const input = document.getElementById("linastoryCopyTemplate");
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.slice(0, start) + token + input.value.slice(end);
                input.focus();
                input.setSelectionRange(start + token.length, start + token.length);
                updateLinastoryCopyPreview();
            }

            function renderLinastoryCopyTemplate(template, row, index) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, "0");
                const month = String(now.getMonth() + 1).padStart(2, "0");
                return template
                    .split("{stt}").join(String(index + 1).padStart(2, "0"))
                    .split("{ngay}").join(day + month)
                    .split("{title}").join(row.title || "")
                    .split("{link}").join(row.link || "")
                    .split("{shortlink}").join(row.shortlink || "")
                    .split("{tab}").join("\t");
            }

            function buildLinastoryExcelRow(text) {
                const quoteCell = (cell) => {
                    cell = cell.replace(/~/g, "");
                    return cell.includes("\n") || cell.includes('"') || cell.includes("\t")
                        ? '"' + cell.replace(/"/g, '""') + '"'
                        : cell;
                };
                const cells = [];
                let current = "";
                let inGroup = false;
                for (const character of text) {
                    if (character === "~") {
                        inGroup = !inGroup;
                        current += character;
                    } else if ((character === "\t" || character === "\n") && !inGroup) {
                        if (character === "\t") {
                            cells.push(current);
                            current = "";
                        } else {
                            current += "\n";
                        }
                    } else {
                        current += character;
                    }
                }
                cells.push(current);
                return cells.map(quoteCell).join("\t");
            }

            function buildLinastoryCells(text) {
                const cells = [];
                let current = "";
                let inGroup = false;
                for (const character of String(text)) {
                    if (character === "~") {
                        inGroup = !inGroup;
                        current += character;
                    } else if ((character === "\t" || character === "\n") && !inGroup) {
                        if (character === "\t") {
                            cells.push(current);
                            current = "";
                        } else {
                            current += "\n";
                        }
                    } else {
                        current += character;
                    }
                }
                cells.push(current);
                return cells.map((cell) => cell.replace(/~/g, ""));
            }

            function updateLinastoryCopyPreview() {
                const template = document.getElementById("linastoryCopyTemplate").value;
                document.querySelectorAll(".linastory-template-card").forEach((card) => {
                    const selected = card.dataset.copyTemplate === template;
                    card.classList.toggle("is-selected", selected);
                    card.setAttribute("aria-pressed", String(selected));
                });
                const sample = renderLinastoryCopyTemplate(template, {
                    title: "Sample title",
                    link: "https://example.com/post",
                    shortlink: "https://example.com/?p=1",
                }, 0);
                document.getElementById("linastoryCopyPreview").textContent =
                    buildLinastoryExcelRow(sample).replace(/~/g, "").split("\t").join(" ⇥ ");
            }

            function saveLinastoryCopyTemplate() {
                const template = document.getElementById("linastoryCopyTemplate").value;
                if (!template.trim()) {
                    setLinastoryCopyStatus("Mẫu copy đang trống.", true);
                    return;
                }
                try {
                    localStorage.setItem("linastoryCustomCopyTemplate", template);
                    backToLinastoryArticles();
                    setLinastoryCopyStatus("Đã lưu mẫu copy Linastory.");
                } catch (error) {
                    setLinastoryCopyStatus(error.message || "Không thể lưu mẫu copy.", true);
                }
            }

            function resetLinastoryCopyTemplate() {
                document.getElementById("linastoryCopyTemplate").value = DEFAULT_LINASTORY_COPY_TEMPLATE;
                updateLinastoryCopyPreview();
            }

            function normalizeLinastoryTitle(title) {
                return String(title || "")
                    .normalize("NFKC")
                    .replace(/\s*#TP\s*$/i, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLocaleLowerCase();
            }

            function requestLinastoryRows(titles) {
                return new Promise((resolve, reject) => {
                    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const timeoutId = setTimeout(() => {
                        window.removeEventListener("message", onResponse);
                        reject(new Error("Không nhận được dữ liệu từ extension Linastory. Hãy kiểm tra extension đã bật, reload extension và mở index bằng localhost hoặc 127.0.0.1."));
                    }, 3000);
                    const onResponse = (event) => {
                        if (event.source !== window || event.data?.channel !== "tool-get-post:linastory-bridge") return;
                        if (event.data.requestId !== requestId || event.data.action !== "response") return;
                        clearTimeout(timeoutId);
                        window.removeEventListener("message", onResponse);
                        if (!event.data.success) {
                            reject(new Error(event.data.error || "Không thể đọc dữ liệu Linastory."));
                            return;
                        }
                        resolve(Array.isArray(event.data.rows) ? event.data.rows : []);
                    };
                    window.addEventListener("message", onResponse);
                    window.postMessage({
                        channel: "tool-get-post:linastory-bridge",
                        action: "request",
                        requestId,
                        titles,
                    }, window.location.origin);
                });
            }

            function getLinastoryArticlesForCopy() {
                const copyMode = document.getElementById("linastoryCopyMode").value;
                return matchedLinastoryArticles.filter((article) =>
                    copyMode !== "selected" || selectedArticleIndexes.has(Number(article.index))
                );
            }

            function updateLinastoryCopyButtonStatus() {
                const button = document.getElementById("copyLinastoryButton");
                if (!button) return;

                const copyRows = getLinastoryArticlesForCopy();
                const allMatched = copyRows.length > 0 && copyRows.every((article) => Boolean(article.link));
                const sheetMode = getLinastorySheetMode();
                if (sheetMode) {
                    if (linastoryPasteState.state === "loading") {
                        button.disabled = true;
                        button.textContent = "⏳ Đang dán vào Google Sheet...";
                        return;
                    }
                    if (linastoryPasteState.state === "done") {
                        button.disabled = true;
                        button.textContent = "✅ Đã dán vào Google Sheet";
                        return;
                    }
                }
                button.disabled = false;
                button.textContent = `${sheetMode ? "🧩" : "📋"} Copy Linastory${allMatched ? " ✅" : ""}`;
                button.dataset.linastoryMatched = allMatched ? "true" : "false";
            }

            function getLinastorySheetMode() {
                return Boolean(document.getElementById("linastorySheetModeCheck")?.checked);
            }

            function handleCopyLinastoryClick(event) {
                if (getLinastorySheetMode()) {
                    pasteLinastoryToSheet();
                } else {
                    openLinastoryCopyModal();
                }
            }

            let linastoryAutoMatchTimer = null;
            let linastoryAutoMatchInProgress = false;

            function scheduleLinastoryAutoMatch(delay = 800) {
                if (linastoryAutoMatchTimer) clearTimeout(linastoryAutoMatchTimer);
                linastoryAutoMatchTimer = setTimeout(() => {
                    refreshLinastoryMatchStatus();
                }, delay);
            }

            async function refreshLinastoryMatchStatus() {
                if (linastoryAutoMatchInProgress) return;
                linastoryAutoMatchInProgress = true;
                try {
                    await loadMatchedLinastoryArticles();
                    updateLinastoryCopyButtonStatus();
                } catch (error) {
                    updateLinastoryCopyButtonStatus();
                } finally {
                    linastoryAutoMatchInProgress = false;
                    resetLinastoryPasteButtonIfStale();
                }
            }

            function renderLinastoryArticlesList() {
                const list = document.getElementById("linastoryArticlesList");
                const matchedCount = matchedLinastoryArticles.filter((article) => article.link).length;
                const missingCount = matchedLinastoryArticles.length - matchedCount;
                updateLinastoryCopyButtonStatus();
                document.getElementById("linastoryArticlesSummary").textContent =
                    `${matchedCount} bài có permalink${missingCount ? ` · ${missingCount} bài chưa tìm thấy title tương ứng` : ""}. Thứ tự theo index; title trùng được ghép theo thứ tự trong extension.`;
                list.replaceChildren();

                matchedLinastoryArticles.forEach((article) => {
                    const row = document.createElement("tr");
                    row.style.borderTop = "1px solid #e2e8f0";
                    const values = [
                        String(Number(article.index) + 1),
                        article.title || "(Không có title)",
                    ];
                    values.forEach((value, index) => {
                        const cell = document.createElement("td");
                        cell.textContent = value;
                        cell.className = index === 0 ? "linastory-number" : "linastory-title";
                        row.appendChild(cell);
                    });

                    [article.link, article.shortlink].forEach((url) => {
                        const cell = document.createElement("td");
                        if (url) {
                            const link = document.createElement("a");
                            link.href = url;
                            link.textContent = url;
                            link.target = "_blank";
                            link.rel = "noopener noreferrer";
                            link.style.overflowWrap = "anywhere";
                            cell.appendChild(link);
                        } else {
                            cell.textContent = "—";
                        }
                        row.appendChild(cell);
                    });

                    const statusCell = document.createElement("td");
                    statusCell.textContent = article.link ? "✅ Khớp" : "⚠️ Không tìm thấy";
                    statusCell.className = article.link ? "linastory-status" : "linastory-status linastory-status-missing";
                    row.appendChild(statusCell);
                    list.appendChild(row);
                });
            }

            async function loadMatchedLinastoryArticles() {
                let saved;
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles") || "[]");
                } catch (error) {
                    throw new Error("Dữ liệu bài viết đã lưu không hợp lệ.");
                }
                if (!Array.isArray(saved) || saved.length === 0) {
                    throw new Error("Không có bài viết nào trong index để copy.");
                }
                const articles = saved
                    .slice()
                    .sort((a, b) => Number(a.index) - Number(b.index))
                    .filter((article) => Number.isFinite(Number(article.index)));
                if (articles.length === 0) {
                    throw new Error("Không có bài viết hợp lệ trong index.");
                }

                const linastoryRows = await requestLinastoryRows(articles.map((article) => article.title || ""));
                const rowsByTitle = new Map();
                linastoryRows.forEach((row) => {
                    const key = normalizeLinastoryTitle(row.title);
                    if (!key || !row.link) return;
                    if (!rowsByTitle.has(key)) rowsByTitle.set(key, []);
                    rowsByTitle.get(key).push(row);
                });

                matchedLinastoryArticles = articles.map((article) => {
                    const matches = rowsByTitle.get(normalizeLinastoryTitle(article.title));
                    const match = matches?.shift();
                    return {
                        index: Number(article.index),
                        title: article.title || "",
                        link: match?.link || "",
                        shortlink: match?.shortlink || "",
                    };
                });
                updateLinastoryCopyButtonStatus();
                return matchedLinastoryArticles;
            }

            async function openLinastoryCopyModal(event) {
                event?.preventDefault();
                const dialog = document.getElementById("linastoryArticlesDialog");
                const summary = document.getElementById("linastoryArticlesSummary");
                const list = document.getElementById("linastoryArticlesList");
                if (!dialog.open) dialog.showModal();
                summary.textContent = "Đang tải và đối chiếu dữ liệu từ extension Linastory...";
                list.replaceChildren();

                const button = document.getElementById("copyLinastoryButton");
                try {
                    button.disabled = true;
                    setLinastoryCopyStatus("Đang tải và đối chiếu bài viết Linastory...");
                    await loadMatchedLinastoryArticles();
                    renderLinastoryArticlesList();
                    setLinastoryCopyStatus("");
                } catch (error) {
                    const message = error.message || "Không thể tải dữ liệu Linastory.";
                    summary.textContent = message;
                    setLinastoryCopyStatus(message, true);
                } finally {
                    button.disabled = false;
                }
            }

            async function quickCopyLinastory(event) {
                event?.preventDefault();
                const button = document.getElementById("copyLinastoryButton");
                try {
                    button.disabled = true;
                    setLinastoryCopyStatus("Đang lấy permalink Linastory để copy...");
                    await loadMatchedLinastoryArticles();
                    const copied = await copyMatchedLinastoryCustom();
                    if (copied) {
                        const closedCount = await closeLinastoryTabsAfterQuickCopy();
                        if (closedCount > 0) {
                            const message = `Đã copy và đóng ${closedCount} tab Linastory.`;
                            setLinastoryCopyStatus(message);
                            document.getElementById("linastoryArticlesSummary").textContent = message;
                        }
                    }
                } catch (error) {
                    setLinastoryCopyStatus(error.message || "Không thể copy dữ liệu Linastory.", true);
                } finally {
                    button.disabled = false;
                }
            }

            function closeLinastoryTabsAfterQuickCopy() {
                return new Promise((resolve) => {
                    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const timeoutId = setTimeout(() => {
                        window.removeEventListener("message", onResponse);
                        resolve(0);
                    }, 1500);
                    const onResponse = (event) => {
                        if (event.source !== window || event.data?.channel !== "tool-get-post:linastory-bridge") return;
                        if (event.data.requestId !== requestId || event.data.action !== "close-response") return;
                        clearTimeout(timeoutId);
                        window.removeEventListener("message", onResponse);
                        resolve(Number.isFinite(Number(event.data.closedCount)) ? Number(event.data.closedCount) : 0);
                    };
                    window.addEventListener("message", onResponse);
                    window.postMessage({
                        channel: "tool-get-post:linastory-bridge",
                        action: "close-tabs",
                        requestId,
                    }, window.location.origin);
                });
            }

            async function copyMatchedLinastoryCustom() {
                try {
                    const matchedRows = getLinastoryArticlesForCopy();
                    if (matchedRows.length === 0) {
                        throw new Error("Không có bài viết nào được chọn để copy.");
                    }
                    const unmatchedCount = matchedRows.filter((article) => !article.link).length;
                    const rowsToCopy = matchedRows.filter((article) => article.link);
                    if (rowsToCopy.length === 0) {
                        throw new Error("Các bài được chọn đều chưa có permalink Linastory.");
                    }
                    const template = getLinastoryCopyTemplate().trim();
                    if (!template) throw new Error("Mẫu copy đang trống. Nhấn chuột phải để chỉnh mẫu.");
                    const text = rowsToCopy
                        .map((row, index) => buildLinastoryExcelRow(renderLinastoryCopyTemplate(template, row, index)))
                        .join("\n");
                    await navigator.clipboard.writeText(text);
                    const message = `Đã copy ${rowsToCopy.length} bài theo thứ tự index.${unmatchedCount ? ` Bỏ qua ${unmatchedCount} bài không có link.` : ""}`;
                    setLinastoryCopyStatus(message);
                    document.getElementById("linastoryArticlesSummary").textContent = message;
                    return true;
                } catch (error) {
                    setLinastoryCopyStatus(error.message || "Không thể copy dữ liệu Linastory.", true);
                    document.getElementById("linastoryArticlesSummary").textContent =
                        error.message || "Không thể copy dữ liệu Linastory.";
                    return false;
                }
            }

            const linastoryPasteState = { state: "", signature: "" };

            function getLinastoryRowsSignature() {
                return matchedLinastoryArticles
                    .filter((article) => article.link)
                    .map((article) => `${article.index}:${article.title}:${article.link}:${article.shortlink}`)
                    .join("|");
            }

            function setLinastoryPasteButtonState(state) {
                linastoryPasteState.state = state === "loading" || state === "done" ? state : "";
                const button = document.getElementById("pasteLinastorySheetButton");
                if (button) {
                    if (state === "loading") {
                        button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Đang dán...</span>';
                    } else if (state === "done") {
                        button.innerHTML = "✅ Đã dán vào Google Sheet";
                    } else {
                        button.innerHTML = "🧩 Dán vào Google Sheet";
                    }
                    button.disabled = state === "loading" || state === "done";
                }
                updateLinastoryCopyButtonStatus();
            }

            function resetLinastoryPasteButtonIfStale() {
                if (linastoryPasteState.state !== "done") return;
                if (linastoryPasteState.signature !== getLinastoryRowsSignature()) {
                    setLinastoryPasteButtonState("default");
                }
            }

            async function pasteLinastoryToSheet() {
                if (linastoryPasteState.state === "loading") return false;
                if (linastoryPasteState.state === "done") {
                    setLinastoryCopyStatus("Đã dán lần này rồi. Dữ liệu thay đổi mới thì nút mới bật lên để dán tiếp.", true);
                    return false;
                }
                let button = null;
                try {
                    const prefix = getVideoFilePrefixValue();
                    if (!prefix) {
                        throw new Error("Nhập Video filename prefix trước (vd: B) để xác định trang Google Sheet.");
                    }
                    const matchedRows = getLinastoryArticlesForCopy();
                    if (matchedRows.length === 0) {
                        throw new Error("Không có bài viết nào được chọn để dán.");
                    }
                    const rowsToPaste = matchedRows.filter((article) => article.link);
                    if (rowsToPaste.length === 0) {
                        throw new Error("Các bài được chọn đều chưa có permalink Linastory.");
                    }
                    button = document.getElementById("pasteLinastorySheetButton");
                    setLinastoryPasteButtonState("loading");
                    const unmatchedCount = matchedRows.length - rowsToPaste.length;
                    const template = getLinastoryCopyTemplate().trim();
                    if (!template) throw new Error("Mẫu copy đang trống. Hãy thiết lập mẫu copy Linastory trước.");
                    const rows = rowsToPaste.map((row, index) => buildLinastoryCells(renderLinastoryCopyTemplate(template, row, index)));
                    setLinastoryCopyStatus("Đang dán vào Google Sheet...");
                    const response = await fetch("/sheet-paste", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prefix, rows }),
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || "Không thể dán vào Google Sheet.");
                    let message = `Đã dán ${data.count} hàng vào tab "${data.tab}", bắt đầu từ row ${data.startRow}.${unmatchedCount ? ` Bỏ qua ${unmatchedCount} bài không có link.` : ""}`;
                    const closedCount = await closeLinastoryTabsAfterQuickCopy();
                    if (closedCount > 0) {
                        message += ` Đã đóng ${closedCount} tab Linastory.`;
                    }
                    setLinastoryCopyStatus(message);
                    document.getElementById("linastoryArticlesSummary").textContent = message;
                    linastoryPasteState.signature = getLinastoryRowsSignature();
                    setLinastoryPasteButtonState("done");
                    return true;
                } catch (error) {
                    const message = error.message || "Không thể dán vào Google Sheet.";
                    setLinastoryCopyStatus(message, true);
                    const summary = document.getElementById("linastoryArticlesSummary");
                    if (summary) summary.textContent = message;
                    setLinastoryPasteButtonState("default");
                    return false;
                }
            }

            function getStoryModeForCard(card) {
                return getActiveStoryMode();
            }

            function showStoryRetryButton(index) {
                const card = document.getElementById(`card-${index}`);
                const retryButton = card?.querySelector(".story-retry-btn");
                if (retryButton) {
                    retryButton.style.display = "inline-flex";
                }
            }

            function handleStoryActionButtonClick(index) {
                openStoryTool(index);
            }

            function getStoryArticleIndexes() {
                return Array.from(document.querySelectorAll('#output .result-card[id^="card-"]'))
                    .map((card) => Number(card.id.replace("card-", "")))
                    .filter((value) => Number.isFinite(value))
                    .sort((a, b) => a - b);
            }

            function updateStoryNavigationButtons() {
                const prevButton = document.getElementById("storyPrevButton");
                const nextButton = document.getElementById("storyNextButton");
                const counter = document.getElementById("storyArticleCounter");
                const indexes = getStoryArticleIndexes();

                if (!prevButton || !nextButton || !counter) return;

                if (indexes.length === 0) {
                    prevButton.disabled = true;
                    nextButton.disabled = true;
                    counter.textContent = "No article";
                    return;
                }

                const currentPosition = indexes.indexOf(activeStoryCardIndex);
                const safePosition = currentPosition >= 0 ? currentPosition : 0;
                prevButton.disabled = safePosition <= 0;
                nextButton.disabled = safePosition >= indexes.length - 1;
                counter.textContent = `Article ${safePosition + 1}/${indexes.length}`;
            }

            function goToStoryCard(direction) {
                const indexes = getStoryArticleIndexes();
                if (indexes.length === 0) return;

                const currentPosition = indexes.indexOf(activeStoryCardIndex);
                const safePosition = currentPosition >= 0 ? currentPosition : 0;
                const targetPosition = Math.min(indexes.length - 1, Math.max(0, safePosition + direction));
                const targetIndex = indexes[targetPosition];
                if (targetIndex !== undefined) {
                    openStoryTool(targetIndex);
                }
            }

            function buildStoryActionMarkup(index, url, selectedMode = "story") {
                return `
                                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px;">
                                    <button type="button" onclick="handleStoryActionButtonClick(${index})" class="btn-secondary" style="padding: 10px 16px; font-size: 0.92rem;">🎬 Create Story</button>
                                    <button type="button" onclick="retrySingle('${url}', ${index})" class="btn-secondary story-retry-btn" style="display:none; padding: 10px 16px; font-size: 0.92rem; background-color: #3b82f6; border-color: #3b82f6; color: white;">🔄</button>
                                </div>
                            `;
            }

            function getSavedArticleByUrl(url) {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                return saved.find((item) => item.url === url) || null;
            }

            function getThumbnailVariantUrl(videoId, variant) {
                const normalized = variant === "maxres1" || variant === "maxres2" ? variant : "maxresdefault";
                return `https://i.ytimg.com/vi/${videoId}/${normalized}.jpg`;
            }

            function escapeAttributeValue(value) {
                return String(value || "")
                    .replace(/'/g, "\\'")
                    .replace(/"/g, "&quot;");
            }

            function buildThumbnailControls(item) {
                const safeUrl = escapeAttributeValue(item.url);
                const variant = item.thumbnailVariant || "maxresdefault";
                const customUrl = item.customThumbnailUrl || "";
                const previewUrl = customUrl || getThumbnailVariantUrl(item.videoId, variant);
                const variantLabel = variant === "custom" ? "Custom image loaded" : `${variant}.jpg`;
                return `
                                <div style="margin-bottom: 15px;">
                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Thumbnail source</label>
                                    <div style="display:none; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px;" >
                                        <select onchange="updateThumbnailVariant('${safeUrl}', this.value, ${item.index})" style="padding: 8px 10px; border-radius: 10px; border: 1px solid #cbd5e1; min-width: 180px;">
                                            <option value="maxresdefault" ${variant === "maxresdefault" ? "selected" : ""}>maxresdefault.jpg</option>
                                            <option value="maxres1" ${variant === "maxres1" ? "selected" : ""}>maxres1.jpg</option>
                                            <option value="maxres2" ${variant === "maxres2" ? "selected" : ""}>maxres2.jpg</option>
                                            <option value="hqdefault" ${variant === "hqdefault" ? "selected" : ""}>hqdefault.jpg</option>
                                            <option value="custom" ${variant === "custom" ? "selected" : ""}>Tải ảnh ngoài</option>
                                        </select>
                                        <button type="button" class="btn-secondary" style="padding: 10px 14px; font-size: 0.9rem;" onclick="document.getElementById('thumbnail-file-${item.index}').click()">
                                            Chọn file
                                        </button>
                                        <input id="thumbnail-file-${item.index}" type="file" accept="image/*" style="display:none" onchange="handleThumbnailFileChange(this, '${safeUrl}', ${item.index})" />
                                    </div>
                                    <div id="thumbnail-preview-${item.index}" style="display:none; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                                        <img src="${previewUrl}" alt="Thumbnail preview" style="max-width: 200px; width: 100%; max-height: 120px; object-fit: contain; border-radius: 12px; border: 1px solid #cbd5e1;" />
                                        <span style="color:#64748b; font-size:0.95rem;">${variantLabel}</span>
                                    </div>
                                    <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.95rem;">
                                        ${customUrl ? '<span style="color:#10b981;">Custom thumbnail selected</span>' : `<a id="thumbnail-link-${item.index}" href="${previewUrl}" target="_blank" style="color: var(--primary); text-decoration: none;">Thumbnail image</a>`}
                                    </p>
                                </div>
                            `;
            }

            function saveArticleToLocalStorage(index, url, title, players, videoId, article, options = {}) {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                const existingIndex = saved.findIndex((item) => item.url === url);
                const existing = existingIndex > -1 ? saved[existingIndex] : null;
                const item = {
                    index,
                    url,
                    title,
                    players,
                    videoId,
                    article,
                    thumbnailVariant: options.thumbnailVariant ?? existing?.thumbnailVariant ?? "maxresdefault",
                    customThumbnailUrl: options.customThumbnailUrl ?? existing?.customThumbnailUrl ?? "",
                    storyFontSize: options.storyFontSize ?? existing?.storyFontSize ?? null,
                    timestamp: Date.now(),
                };
                if (existingIndex > -1) {
                    saved[existingIndex] = item;
                } else {
                    saved.push(item);
                }
                localStorage.setItem("saved_articles", JSON.stringify(saved));
                scheduleLinastoryAutoMatch();
            }

            function getSavedArticleByIndex(index) {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                return saved.find((item) => item.index === index) || null;
            }

            function updateCardThumbnailPreview(index, item) {
                const preview = document.getElementById(`thumbnail-preview-${index}`);
                const link = document.getElementById(`thumbnail-link-${index}`);
                if (!item) return;
                const imageUrl = item.customThumbnailUrl || getThumbnailVariantUrl(item.videoId, item.thumbnailVariant);
                const labelText = item.thumbnailVariant === "custom" ? "Custom image loaded" : `${item.thumbnailVariant || "maxresdefault"}.jpg`;
                const img = preview?.querySelector("img");
                const label = preview?.querySelector("span");
                if (img) img.src = imageUrl;
                if (label) label.textContent = labelText;
                if (link) link.href = imageUrl;
            }

            function syncArticleThumbnailVariant(articleHtml, videoId, variant) {
                const imageUrl = getThumbnailVariantUrl(videoId, variant || "maxresdefault");
                const imgTag = `<img style="max-width: 100%; margin-top: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" src="${imageUrl}" />`;
                const imgRegex = /<img[^>]*src=["'][^"']*["'][^>]*>/i;
                if (!articleHtml || !videoId) return articleHtml;
                if (imgRegex.test(articleHtml)) {
                    return articleHtml.replace(imgRegex, imgTag);
                }
                return injectImage(articleHtml, videoId, variant);
            }

            function updateThumbnailVariant(url, variant, index, customUrl = "") {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                const idx = saved.findIndex((item) => item.url === url);
                if (idx === -1) return;
                saved[idx].thumbnailVariant = variant;
                if (variant === "custom") {
                    saved[idx].customThumbnailUrl = customUrl || saved[idx].customThumbnailUrl || "";
                } else {
                    saved[idx].customThumbnailUrl = "";
                }

                const articleCard = document.getElementById(`card-${index}`);
                const articleTextArea = articleCard?.querySelector("textarea.w-full.min-h-52");
                if (articleTextArea && saved[idx].article) {
                    const updatedArticle = syncArticleThumbnailVariant(saved[idx].article, saved[idx].videoId, variant);
                    saved[idx].article = updatedArticle;
                    articleTextArea.value = updatedArticle;
                }

                localStorage.setItem("saved_articles", JSON.stringify(saved));
                storyCoverImagePromise = null;
                updateCardThumbnailPreview(index, saved[idx]);
                renderThumbnailSelectorForActiveCard();
                renderStoryPreview();
            }

            function handleThumbnailFileChange(input, url, index) {
                const file = input?.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    updateThumbnailVariant(url, "custom", index, reader.result);
                };
                reader.readAsDataURL(file);
            }

            function renderThumbnailSelectorForActiveCard() {
                const select = document.getElementById("storyThumbnailVariantSelect");
                const previewImg = document.getElementById("storyThumbnailPreviewImg");
                const previewLabel = document.getElementById("storyThumbnailPreviewLabel");
                const previewLink = document.getElementById("storyThumbnailPreviewLink");
                const article = getSavedArticleByIndex(activeStoryCardIndex);
                if (!article || !select || !previewImg || !previewLabel || !previewLink) return;
                select.value = article.thumbnailVariant || "maxresdefault";
                const imageUrl = article.customThumbnailUrl || getThumbnailVariantUrl(article.videoId, article.thumbnailVariant || "maxresdefault");
                previewImg.src = imageUrl;
                previewLabel.textContent = article.thumbnailVariant === "custom" ? "Custom image loaded" : `${article.thumbnailVariant || "maxresdefault"}.jpg`;
                previewLink.href = imageUrl;
            }

            function handleStoryModalThumbnailVariantChange(value) {
                const article = getSavedArticleByIndex(activeStoryCardIndex);
                if (!article) return;
                updateThumbnailVariant(article.url, value, activeStoryCardIndex);
            }

            function handleStoryModalThumbnailFileChange(event) {
                const article = getSavedArticleByIndex(activeStoryCardIndex);
                if (!article) return;
                const input = event.target;
                handleThumbnailFileChange(input, article.url, activeStoryCardIndex);
            }

            function normalizeSavedArticleIndexes(saved) {
                return saved
                    .sort((a, b) => Number(a.index) - Number(b.index))
                    .map((item, newIndex) => ({ ...item, index: newIndex }));
            }

            function deleteArticle(index, url) {
                if (!confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                saved = saved.filter((item) => item.url !== url);
                saved = normalizeSavedArticleIndexes(saved);
                localStorage.setItem("saved_articles", JSON.stringify(saved));
                scheduleLinastoryAutoMatch();
                const nextSelectedIndexes = new Set();
                const nextDownloadedIndexes = new Set();
                selectedArticleIndexes.forEach((selectedIndex) => {
                    if (selectedIndex > index) nextSelectedIndexes.add(selectedIndex - 1);
                    else if (selectedIndex < index) nextSelectedIndexes.add(selectedIndex);
                });
                downloadedArticleIndexes.forEach((downloadedIndex) => {
                    if (downloadedIndex > index) nextDownloadedIndexes.add(downloadedIndex - 1);
                    else if (downloadedIndex < index) nextDownloadedIndexes.add(downloadedIndex);
                });
                selectedArticleIndexes.clear();
                nextSelectedIndexes.forEach((selectedIndex) => selectedArticleIndexes.add(selectedIndex));
                downloadedArticleIndexes.clear();
                nextDownloadedIndexes.forEach((downloadedIndex) => downloadedArticleIndexes.add(downloadedIndex));

                if (activeStoryCardIndex === index) closeStoryTool();
                else if (activeStoryCardIndex > index) activeStoryCardIndex -= 1;

                restoreArticlesFromLocalStorage();
                nextDownloadedIndexes.forEach((downloadedIndex) => downloadedArticleIndexes.add(downloadedIndex));
                resetDownloadSelectedStatus();
                updateArticleDisplayNumbers();
                updateStoryNavigationButtons();
            }

            function updateArticleDisplayNumbers() {
                const cards = Array.from(document.querySelectorAll('#output .result-card[id^="card-"]'));
                cards.forEach((card, position) => {
                    card.querySelectorAll("label").forEach((label) => {
                        label.textContent = label.textContent.replace(
                            /^Article \d+ (Title|Content \(HTML\))$/,
                            `Article ${position + 1} $1`,
                        );
                    });
                });

                const selectAllBtn = document.getElementById("selectAllBtn");
                if (selectAllBtn) selectAllBtn.textContent = selectedArticleIndexes.size > 0 ? "Clear" : "Select All";
                scheduleLinastoryAutoMatch();
            }

            function updateSavedArticle(idOrUrl, field, value) {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    return;
                }

                if (idOrUrl === null || idOrUrl === undefined) return;

                let idx = -1;
                // Accept either numeric index or URL string
                if (typeof idOrUrl === "number" || /^\d+$/.test(String(idOrUrl))) {
                    const num = Number(idOrUrl);
                    idx = saved.findIndex((item) => Number(item.index) === num);
                } else {
                    idx = saved.findIndex((item) => item.url === idOrUrl);
                }

                if (idx > -1) {
                    saved[idx][field] = value;
                    localStorage.setItem("saved_articles", JSON.stringify(saved));
                    scheduleLinastoryAutoMatch();
                }
            }

            function updateThumbnailText(idOrUrl, value) {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    return;
                }

                const savedIndex = saved.findIndex((item) => {
                    if (typeof idOrUrl === "number" || /^\d+$/.test(String(idOrUrl))) {
                        return Number(item.index) === Number(idOrUrl);
                    }
                    return item.url === idOrUrl;
                });
                if (savedIndex === -1) return;

                const article = saved[savedIndex];
                article.players = value;
                article.storyText = value;
                localStorage.setItem("saved_articles", JSON.stringify(saved));
                scheduleLinastoryAutoMatch();
            }

            function buildThumbnailTextRegenButton(index) {
                return `<button id="regenThumbBtn-${index}" type="button" class="icon-btn" title="Ép load lại Thumbnail Text (chỉ text, không đụng bài viết)" style="background: #eef2ff; border: 1px solid #e2e8f0;" onclick="regenerateThumbnailText(${index})">🔄</button>`;
            }

            function regenerateThumbnailTextFromStoryModal() {
                if (!Number.isFinite(activeStoryCardIndex)) {
                    storyUpdateMessage("Không xác định được bài viết đang mở trong modal.", true);
                    return;
                }
                return regenerateThumbnailText(activeStoryCardIndex, { syncStoryModal: true });
            }

            async function regenerateThumbnailText(index, options = {}) {
                const { syncStoryModal = false } = options;
                const button = document.getElementById(syncStoryModal ? "storyRegenThumbButton" : `regenThumbBtn-${index}`);
                if (!button || button.disabled) return;

                const savedArticle = getSavedArticleByIndex(index);
                if (!savedArticle) {
                    setLinastoryCopyStatus("Không tìm thấy bài viết đã lưu để tạo lại thumbnail text.", true);
                    return;
                }

                const originalHtml = button.innerHTML;
                button.disabled = true;
                button.innerHTML = '<span class="button-spinner" style="border-color: rgba(139, 92, 246, 0.35); border-top-color: #8b5cf6;" aria-hidden="true"></span>';

                try {
                    const language = document.getElementById("language-select")?.value || "English";
                    const provider = document.getElementById("ai-provider")?.value || "groq";
                    const res = await fetch("/generate-thumbnail-text", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: savedArticle.title || "",
                            article: savedArticle.article || "",
                            language,
                            provider,
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || "Không thể tạo lại thumbnail text.");

                    const players = data.players || "";
                    updateThumbnailText(index, players);

                    const card = document.getElementById(`card-${index}`);
                    const textarea = card?.querySelector("textarea.player-input");
                    if (textarea) textarea.value = players;

                    const refreshed = getSavedArticleByIndex(index);
                    if (refreshed) {
                        updateCardThumbnailPreview(index, refreshed);
                        if (!syncStoryModal) renderStoryPreview();
                    }

                    if (syncStoryModal) {
                        const storyTextInput = document.getElementById("storyTextInput");
                        activeStoryBaseText = removeStorySuffix(players);
                        if (storyTextInput) storyTextInput.value = applyStorySuffix(activeStoryBaseText);
                        await renderStoryPreview();
                        storyUpdateMessage("Đã tạo lại thumbnail text cho bài đang mở.");
                    }

                    setLinastoryCopyStatus(`Đã tạo lại thumbnail text cho bài ${Number(index) + 1}.`);
                } catch (error) {
                    setLinastoryCopyStatus(`Tạo lại thumbnail text thất bại: ${error.message || "lỗi không xác định."}`, true);
                } finally {
                    button.disabled = false;
                    button.innerHTML = originalHtml;
                }
            }

            function restoreArticlesFromLocalStorage() {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                if (saved.length === 0) {
                    alert("Không có bài viết nào được lưu trong localStorage!");
                    return;
                }
                const resultSection = document.getElementById("resultSection");
                const output = document.getElementById("output");
                resultSection.style.display = "block";
                output.innerHTML = "";
                downloadedArticleIndexes.clear();
                selectedArticleIndexes.clear();

                saved.sort((a, b) => a.index - b.index);
                saved.forEach((item) => {
                    selectedArticleIndexes.add(Number(item.index));
                    const articleCard = document.createElement("div");
                    articleCard.className = "result-card";
                    articleCard.id = `card-${item.index}`;
                    articleCard.style.marginBottom = "20px";
                    articleCard.innerHTML = `
                                    <div class="card-controls">
                                        <button id="select-btn-${item.index}" class="icon-btn select" onclick="toggleSelectArticle(${item.index})" title="Select">${selectedArticleIndexes.has(Number(item.index)) ? "✅" : "⬜"}</button>
                                        <button class="icon-btn copy" onclick="copyArticle(${item.index})" title="Copy article">📋</button>
                                        <button class="icon-btn delete" onclick="deleteArticle(${item.index}, '${item.url}')" title="Delete article">🗑</button>
                                    </div>
                                    <div style="margin-bottom: 20px;">
                                        <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Article ${item.index + 1} Title</label>
                                        <input type="text" class="flex-1 border" value="${item.title || ""}" style="margin-bottom:15px; width: 100%;" oninput="updateSavedArticle('${item.url}', 'title', this.value)">

                                        <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                            <div>
                                                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                                    <label style="color:var(--text-muted);">Thumbnail Text</label>
                                                    ${buildThumbnailTextRegenButton(item.index)}
                                                </div>
                                                <textarea class="player-input border" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;" placeholder="Thumbnail text..." oninput="updateThumbnailText('${item.url}', this.value)">${item.players || ""}</textarea>
                                                ${buildThumbnailControls(item)}
                                                ${buildStoryActionMarkup(item.index, item.url, "story")}
                                            </div>
                                        </div>

                                        <label style="display:block; margin-bottom:8px; color:var(--text-muted); cursor:pointer;" ondblclick="showStoryRetryButton(${item.index})">Article ${item.index + 1} Content (HTML)</label>
                                        <textarea class="w-full min-h-52" style="min-height: 100px; font-family: 'Inter', monospace; font-size: 0.9rem;" oninput="updateSavedArticle('${item.url}', 'article', this.value)">${item.article}</textarea>
                                    </div>
                                `;
                    output.appendChild(articleCard);
                });
                updateStoryNavigationButtons();
                scheduleLinastoryAutoMatch(300);
                alert(`Đã khôi phục thành công ${saved.length} bài viết!`);
            }

            async function copyArticle(index) {
                try {
                    let saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                    const item = saved.find((s) => s.index === index);
                    if (!item) {
                        storyUpdateMessage("Không tìm thấy bài viết để copy.", true);
                        return;
                    }
                    const text = `${item.title || ""}\n\n${item.players || ""}\n\n${(item.article || "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ")}`;
                    await navigator.clipboard.writeText(text);
                    storyUpdateMessage("Đã copy bài viết vào clipboard.");
                } catch (err) {
                    storyUpdateMessage("Không thể copy bài viết.", true);
                }
            }

            async function copySampleArticle(sampleIndex) {
                try {
                    const sample = sampleArticles[sampleIndex % sampleArticles.length];
                    if (!sample) return;
                    const text = `${sample.title}\n\n${sample.players}\n\n${sample.body}`;
                    await navigator.clipboard.writeText(text);
                    storyUpdateMessage("Đã copy sample vào clipboard.");
                } catch (err) {
                    storyUpdateMessage("Không thể copy sample.", true);
                }
            }

            // Selection state for batch download
            const selectedArticleIndexes = new Set();
            const downloadedArticleIndexes = new Set();
            let selectedDownloadsInProgress = false;

            function selectArticleIndexByDefault(index) {
                const normalizedIndex = Number(index);
                if (!Number.isFinite(normalizedIndex)) return;
                selectedArticleIndexes.add(normalizedIndex);
                const button = document.getElementById(`select-btn-${normalizedIndex}`);
                if (button) button.textContent = "✅";
            }

            function resetDownloadSelectedStatus() {
                if (selectedDownloadsInProgress) return;
                const downloadButton = document.getElementById("downloadSelectedBtn");
                if (downloadButton) downloadButton.textContent = "Download Selected";
            }

            window.addEventListener("beforeunload", (event) => {
                const articleIndexes = getStoryArticleIndexes();
                if (articleIndexes.length === 0 || articleIndexes.every((index) => downloadedArticleIndexes.has(index))) return;
                event.preventDefault();
                event.returnValue = "";
            });

            function extractAutoSelectYouTubeId(url) {
                if (!url || typeof url !== "string") return null;
                const patterns = [/[?&]v=([A-Za-z0-9_-]{6,})/, /youtu\.be\/([A-Za-z0-9_-]{6,})/, /\/embed\/([A-Za-z0-9_-]{6,})/, /\/v\/([A-Za-z0-9_-]{6,})/];
                for (const pattern of patterns) {
                    const match = url.match(pattern);
                    if (match?.[1]) return match[1];
                }
                try { return new URL(url).searchParams.get("v"); } catch (error) { return null; }
            }

            function getExistingThumbnailVariant(articleHtml, videoId) {
                if (!articleHtml) return null;
                const html = String(articleHtml);
                const variants = ["maxresdefault", "maxres1", "maxres2"];
                for (const variant of variants) {
                    const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const pattern = new RegExp(`i\\\\.ytimg\\\\.com/[^\\\\s\"'<>]+/${escapedVariant}\\\\.jpg`, "i");
                    if (pattern.test(html)) return variant;
                }

                if (videoId) {
                    for (const variant of variants) {
                        const url = `https://i.ytimg.com/vi/${videoId}/${variant}.jpg`;
                        if (html.includes(url)) return variant;
                    }
                }
                return null;
            }

            function injectAutoSelectedImages(articleHtml, videoId) {
                if (!videoId) return articleHtml;
                const defaultUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                const firstUrl = `https://i.ytimg.com/vi/${videoId}/maxres1.jpg`;
                const secondUrl = `https://i.ytimg.com/vi/${videoId}/maxres2.jpg`;
                const parser = new DOMParser();
                const doc = parser.parseFromString(`<div id="auto-image-root">${articleHtml}</div>`, "text/html");
                const root = doc.getElementById("auto-image-root");
                if (!root) return articleHtml;

                const imageWrapper = (imageUrl, altText) => {
                    const wrapper = doc.createElement("p");
                    const image = doc.createElement("img");
                    image.src = imageUrl;
                    image.alt = altText;
                    image.style.cssText = "max-width: 100%; height: auto;";
                    wrapper.appendChild(image);
                    return wrapper;
                };

                const existingVariants = new Set();
                for (const image of root.querySelectorAll("img")) {
                    const src = image.getAttribute("src") || image.src || "";
                    let pathname;
                    try {
                        pathname = new URL(src, doc.baseURI).pathname;
                    } catch (error) {
                        continue;
                    }
                    const variant = ["maxresdefault", "maxres1", "maxres2"].find((name) =>
                        pathname.endsWith(`/vi/${videoId}/${name}.jpg`)
                    );
                    if (!variant) continue;
                    if (existingVariants.has(variant)) image.remove();
                    else existingVariants.add(variant);
                }

                const insertImage = (paragraph, imageUrl, altText) => {
                    const image = imageWrapper(imageUrl, altText);
                    if (paragraph) paragraph.insertAdjacentElement("afterend", image);
                    else root.appendChild(image);
                };

                if (!existingVariants.has("maxresdefault")) {
                    insertImage(root.querySelector("p"), defaultUrl, "Auto thumbnail");
                }

                const textParagraphs = Array.from(root.querySelectorAll("p")).filter((paragraph) => !paragraph.querySelector("img"));
                if (!existingVariants.has("maxres1")) insertImage(textParagraphs[2], firstUrl, "Image 1");
                if (!existingVariants.has("maxres2")) insertImage(textParagraphs[4], secondUrl, "Image 2");

                return root.innerHTML;
            }

            async function sendToLinastory(payload) {
                return new Promise((resolve) => {
                    let settled = false;
                    const timeoutId = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        window.removeEventListener("tool-get-post:linastory-status", handleStatus);
                        resolve(false);
                    }, 1500);
                    const handleStatus = (event) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeoutId);
                        window.removeEventListener("tool-get-post:linastory-status", handleStatus);
                        resolve(Boolean(event.detail?.success));
                    };
                    window.addEventListener("tool-get-post:linastory-status", handleStatus);
                    try {
                        window.dispatchEvent(new CustomEvent("tool-get-post:fill-linastory", { detail: payload }));
                    } catch (error) {
                        settled = true;
                        clearTimeout(timeoutId);
                        window.removeEventListener("tool-get-post:linastory-status", handleStatus);
                        resolve(false);
                    }
                });
            }

            async function startAutoSelectImages() {
                const indexes = getSelectedIndexes();
                if (indexes.length === 0) { alert("Vui lòng tick bài viết muốn tự động chọn ảnh."); return; }

                const button = document.getElementById("autoSelectImagesBtn");
                const originalHtml = button?.innerHTML || "";
                if (button) { button.disabled = true; button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Đang chọn ảnh...</span>'; }

                let updatedCount = 0;
                let skippedCount = 0;
                const linastoryArticles = [];
                try {
                    const saved = JSON.parse(localStorage.getItem("saved_articles") || "[]");
                    for (const index of indexes) {
                        const articleIndex = saved.findIndex((item) => Number(item.index) === Number(index));
                        if (articleIndex === -1) { skippedCount++; continue; }
                        const article = saved[articleIndex];
                        const videoId = article.videoId || extractAutoSelectYouTubeId(article.url);
                        if (!videoId) { skippedCount++; continue; }
                        article.videoId = videoId;
                        const existingVariant = getExistingThumbnailVariant(article.article || "", videoId);
                        if (!existingVariant) {
                            if (isAutoFlowDownloadEnabled()) {
                                const workingVariant = await probeThumbnailVariant(videoId);
                                article.thumbnailVariant = workingVariant || "maxresdefault";
                            } else {
                                article.thumbnailVariant = "maxresdefault";
                            }
                            article.customThumbnailUrl = "";
                        }
                        article.article = injectAutoSelectedImages(article.article || "", videoId);
                        saved[articleIndex] = article;
                        const card = document.getElementById(`card-${index}`);
                        const textarea = card?.querySelector("textarea.w-full.min-h-52");
                        if (textarea) textarea.value = article.article || "";
                        updateCardThumbnailPreview(index, article);
                        const publishImage = existingVariant
                            ? getThumbnailVariantUrl(videoId, existingVariant)
                            : (article.customThumbnailUrl || getThumbnailVariantUrl(videoId, article.thumbnailVariant || "maxresdefault"));
                        linastoryArticles.push({
                            title: article.title || "",
                            description: article.article || "",
                            image: publishImage,
                            videoUrl: "",
                            autoPublish: document.getElementById("autoPublishCheckbox")?.checked !== false,
                        });
                        updatedCount++;
                    }
                    localStorage.setItem("saved_articles", JSON.stringify(saved));
                    renderThumbnailSelectorForActiveCard();
                    renderStoryPreview();

                    let bridgedCount = 0;
                    for (let i = 0; i < linastoryArticles.length; i++) {
                        const delivered = await sendToLinastory(linastoryArticles[i]);
                        if (delivered) bridgedCount++;
                        await new Promise((resolve) => setTimeout(resolve, 3500));
                    }

                    console.log(`Auto selected images for ${updatedCount} articles; Linastory deliveries: ${bridgedCount}; skipped: ${skippedCount}.`);
                } finally {
                    if (button) { button.disabled = false; button.innerHTML = originalHtml; }
                }
            }

            function toggleSelectArticle(index) {
                if (selectedArticleIndexes.has(index)) {
                    selectedArticleIndexes.delete(index);
                    const btn = document.getElementById(`select-btn-${index}`) || document.getElementById(`select-sample-${index}`);
                    if (btn) btn.textContent = "⬜";
                } else {
                    selectedArticleIndexes.add(index);
                    const btn = document.getElementById(`select-btn-${index}`) || document.getElementById(`select-sample-${index}`);
                    if (btn) btn.textContent = "✅";
                }
                resetDownloadSelectedStatus();
                const selectAllBtn = document.getElementById("selectAllBtn");
                if (selectAllBtn) selectAllBtn.textContent = selectedArticleIndexes.size > 0 ? "Clear" : "Select All";
                updateLinastoryCopyButtonStatus();
            }

            function toggleSelectAll() {
                const output = document.getElementById("output");
                const cards = output ? Array.from(output.querySelectorAll('[id^="card-"]')) : [];
                if (selectedArticleIndexes.size > 0) {
                    // clear
                    selectedArticleIndexes.clear();
                    cards.forEach((c) => {
                        const id = Number(c.id.replace("card-", ""));
                        const btn = document.getElementById(`select-btn-${id}`);
                        if (btn) btn.textContent = "⬜";
                    });
                    const selectAllBtn = document.getElementById("selectAllBtn");
                    if (selectAllBtn) selectAllBtn.textContent = "Select All";
                    resetDownloadSelectedStatus();
                    updateLinastoryCopyButtonStatus();
                    return;
                }
                // select all
                cards.forEach((c) => {
                    const id = Number(c.id.replace("card-", ""));
                    selectedArticleIndexes.add(id);
                    const btn = document.getElementById(`select-btn-${id}`);
                    if (btn) btn.textContent = "✅";
                });
                const selectAllBtn = document.getElementById("selectAllBtn");
                if (selectAllBtn) selectAllBtn.textContent = "Clear";
                resetDownloadSelectedStatus();
                updateLinastoryCopyButtonStatus();
            }

            function getSelectedIndexes() {
                return Array.from(selectedArticleIndexes).sort((a, b) => a - b);
            }

            function getDownloadDatePrefix() {
                const now = new Date();
                return String(now.getDate()).padStart(2, "0") + String(now.getMonth() + 1).padStart(2, "0");
            }

            function getDownloadDirPath() {
                const baseInput = document.getElementById("downloadBasePath");
                const prefixInput = document.getElementById("downloadPrefixPath");
                const base = ((baseInput ? baseInput.value : "").trim() || localStorage.getItem("downloadDirPath") || "").replace(/[\\/]+$/, "");
                const prefix = (prefixInput ? prefixInput.value : "").trim().replace(/[^a-zA-Z0-9-_. ]/g, "_");
                if (!base) return "";
                return prefix ? `${base}\\${prefix}` : base;
            }

            function persistDownloadPaths() {
                const baseInput = document.getElementById("downloadBasePath");
                const prefixInput = document.getElementById("downloadPrefixPath");
                try {
                    localStorage.setItem("downloadDirPath", (baseInput ? baseInput.value : "").trim());
                    if (prefixInput) {
                        const prefixValue = prefixInput.value.trim();
                        localStorage.setItem(
                            "downloadPrefixPath",
                            JSON.stringify({ value: prefixValue, custom: prefixValue !== getDownloadDatePrefix() }),
                        );
                    }
                } catch (error) {}
            }

            function saveDownloadBlob(blob, fileName) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            }

            async function saveVideoToDirPath(blob, fileName, dirPath) {
                const formData = new FormData();
                formData.append("file", blob, fileName);
                formData.append("dir", dirPath);
                formData.append("fileName", fileName);
                const response = await fetch("/save-download-file", { method: "POST", body: formData });
                if (!response.ok) {
                    const message = await response.text().catch(() => "");
                    let errorText = message;
                    try {
                        errorText = JSON.parse(message).error || message;
                    } catch (parseError) {}
                    throw new Error(errorText || "Không thể lưu video vào thư mục đã nhập.");
                }
            }

            async function downloadArticleByIndex(index, dirPath = "") {
                const article = getSavedArticleByIndex(index);
                if (!article) return false;
                // Prepare story image for this article
                activeStoryCardIndex = index;
                storyCoverImagePromise = null;
                const mode = setActiveStoryMode(getActiveStoryMode());
                const text = applyStorySuffix(article.players || buildSportsThumbnailText(article.article || ""));
                document.getElementById("storyTextInput").value = text;
                const savedFontSize = Number(article.storyFontSize);
                const fontSize = Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 90 ? savedFontSize : storyGetAutoFontSize(text, mode);

                const imgBlob = await storyCreateImageBlob(text, "#ffffff", fontSize);

                const formData = new FormData();
                formData.append("files", imgBlob, getImageFileName(index));
                formData.append("randomDuration", "true");

                const response = await fetch("/convert-download", { method: "POST", body: formData });
                if (!response.ok) {
                    const err = await response.text().catch(() => "Conversion failed");
                    throw new Error(err || "Conversion failed");
                }
                const mp4 = await response.blob();
                const fileName = getVideoDownloadFileName(index);
                if (dirPath) {
                    await saveVideoToDirPath(mp4, fileName, dirPath);
                    return true;
                }
                saveDownloadBlob(mp4, fileName);
                return true;
            }

            async function downloadSelectedArticles() {
                const indexes = getSelectedIndexes();
                if (!indexes || indexes.length === 0) {
                    alert("Please select one or more articles to download.");
                    return;
                }
                const btn = document.getElementById("downloadSelectedBtn");
                const originalButtonContent = btn ? btn.innerHTML : "";
                const selectedIndexesSnapshot = indexes.join(",");
                let allDownloadsSucceeded = false;
                selectedDownloadsInProgress = true;
                if (btn) {
                    btn.disabled = true;
                }
                let dirPath = getDownloadDirPath();
                if (!dirPath) {
                    allDownloadsSucceeded = false;
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalButtonContent;
                    }
                    storyUpdateMessage("Chưa nhập thư mục gốc lưu video (ô path bên cạnh).", true);
                    return;
                }
                persistDownloadPaths();
                if (btn) {
                    btn.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Downloading...</span>';
                    btn.setAttribute("aria-busy", "true");
                }
                try {
                    for (let i = 0; i < indexes.length; i++) {
                        const idx = indexes[i];
                        if (btn) {
                            btn.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>Downloading ${i + 1}/${indexes.length}...</span>`;
                        }
                        storyUpdateMessage(`Converting article ${i + 1}/${indexes.length}...`);
                        setStoryButtonsLoading(true);
                        const downloaded = await downloadArticleByIndex(idx, dirPath);
                        if (!downloaded) throw new Error(`Article ${idx + 1} could not be downloaded.`);
                        downloadedArticleIndexes.add(idx);
                    }
                    allDownloadsSucceeded = true;
                    storyUpdateMessage("All selected downloads completed.", false);
                } catch (err) {
                    storyUpdateMessage(err.message || "Batch download failed", true);
                } finally {
                    setStoryButtonsLoading(false);
                    selectedDownloadsInProgress = false;
                    const selectionUnchanged = getSelectedIndexes().join(",") === selectedIndexesSnapshot;
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = allDownloadsSucceeded && selectionUnchanged ? "✅ Download Completed" : originalButtonContent;
                        btn.removeAttribute("aria-busy");
                    }
                }
            }

            function sortCardsInDom() {
                const output = document.getElementById("output");
                if (!output) return;
                const cards = Array.from(output.children).filter((node) => /^card-\d+$/.test(node.id || ""));
                cards.sort((a, b) => Number(a.id.replace("card-", "")) - Number(b.id.replace("card-", "")));
                cards.forEach((card) => output.appendChild(card));
            }

            function appendBuzzErrorCard(currentIndex, url, heading, detail, buttonLabel) {
                const output = document.getElementById("output");
                if (!output) return;

                const card = document.createElement("div");
                card.className = "result-card";
                card.id = `card-${currentIndex}`;
                card.style.borderColor = "#ef4444";
                card.style.marginBottom = "20px";

                const titleP = document.createElement("p");
                titleP.style.color = "#ef4444";
                titleP.style.fontWeight = "bold";
                titleP.textContent = heading;
                card.appendChild(titleP);

                if (detail) {
                    const detailP = document.createElement("p");
                    detailP.style.fontSize = "0.8rem";
                    detailP.style.color = "var(--text-muted)";
                    detailP.style.marginBottom = "15px";
                    detailP.textContent = detail;
                    card.appendChild(detailP);
                }

                const retryButton = document.createElement("button");
                retryButton.textContent = buttonLabel;
                retryButton.className = "btn-primary";
                retryButton.style.padding = "8px 16px";
                retryButton.style.fontSize = "0.8rem";
                retryButton.style.width = "auto";
                retryButton.setAttribute("onclick", `retrySingle('${url}', ${currentIndex})`);
                card.appendChild(retryButton);

                output.appendChild(card);
                sortCardsInDom();
            }

            function sortResultCards() {
                let saved = [];
                try {
                    saved = JSON.parse(localStorage.getItem("saved_articles")) || [];
                } catch (e) {
                    saved = [];
                }
                if (saved.length === 0) {
                    alert("Không có bài để sắp xếp!");
                    return;
                }

                saved.sort((a, b) => a.index - b.index);

                const output = document.getElementById("output");
                if (!output) return;
                output.innerHTML = "";

                saved.forEach((item) => {
                    const articleCard = document.createElement("div");
                    articleCard.className = "result-card";
                    articleCard.id = `card-${item.index}`;
                    articleCard.style.marginBottom = "20px";
                    articleCard.innerHTML = `
                                    <div class="card-controls">
                                        <button id="select-btn-${item.index}" class="icon-btn select" onclick="toggleSelectArticle(${item.index})" title="Select">${selectedArticleIndexes.has(Number(item.index)) ? "✅" : "⬜"}</button>
                                        <button class="icon-btn copy" onclick="copyArticle(${item.index})" title="Copy article">📋</button>
                                        <button class="icon-btn delete" onclick="deleteArticle(${item.index}, '${item.url}')" title="Delete article">🗑</button>
                                    </div>
                                    <div style="margin-bottom: 20px;">
                                        <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Article ${item.index + 1} Title</label>
                                        <input type="text" class="flex-1 border" value="${item.title || ""}" style="margin-bottom:15px; width: 100%;" oninput="updateSavedArticle('${item.url}', 'title', this.value)">

                                        <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                            <div>
                                                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                                    <label style="color:var(--text-muted);">Thumbnail Text</label>
                                                    ${buildThumbnailTextRegenButton(item.index)}
                                                </div>
                                                <textarea class="player-input border" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;" placeholder="Thumbnail text..." oninput="updateThumbnailText('${item.url}', this.value)">${item.players || ""}</textarea>
                                                ${buildThumbnailControls(item)}
                                                ${buildStoryActionMarkup(item.index, item.url, "story")}
                                            </div>
                                        </div>

                                        <label style="display:block; margin-bottom:8px; color:var(--text-muted); cursor:pointer;" ondblclick="showStoryRetryButton(${item.index})">Article ${item.index + 1} Content (HTML)</label>
                                        <textarea class="w-full min-h-52" style="min-height: 100px; font-family: 'Inter', monospace; font-size: 0.9rem;" oninput="updateSavedArticle('${item.url}', 'article', this.value)">${item.article}</textarea>
                                    </div>
                                `;
                    output.appendChild(articleCard);
                });

                updateStoryNavigationButtons();
            }

            function clearLocalStorageArticles() {
                if (confirm("Bạn có chắc chắn muốn xóa toàn bộ bài viết đã lưu trong localStorage không?")) {
                    localStorage.removeItem("saved_articles");
                    alert("Đã xóa xong!");
                }
            }

            function buildSportsThumbnailText(articleText) {
                const cleanText = (articleText || "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                // Prefer word-based trimming so we can reach ~60-70 words
                const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
                let source = words.join(" ");
                if (words.length > 70) {
                    source = words.slice(0, 70).join(" ") + "...";
                }

                const fallbackText = source || "";
                return `⚡ ${fallbackText} — A jaw-dropping twist is about to shake the whole game!`;
            }

            async function generateThumbnailOnly() {
                const urlInput = document.getElementById("youtubeUrl");
                const urls = urlInput.value
                    .split("\n")
                    .map((u) => u.trim())
                    .filter((u) => u !== "");

                if (urls.length === 0) {
                    alert("Please enter at least one YouTube URL");
                    return;
                }

                const loading = document.getElementById("loading");
                const resultSection = document.getElementById("resultSection");
                const output = document.getElementById("output");

                loading.style.display = "flex";
                resultSection.style.display = "block";
                output.innerHTML = "";
                downloadedArticleIndexes.clear();
                selectedArticleIndexes.clear();
                // Clear previous saved articles so new Thumbnail run doesn't append
                try {
                    localStorage.removeItem("saved_articles");
                } catch (e) {
                    console.warn("Failed to clear saved_articles:", e);
                }

                const provider = document.getElementById("ai-provider").value;
                const selectedMode = document.getElementById("generation-mode")?.value || "story";
                const language = document.getElementById("language-select")?.value || "English";
                const total = urls.length;
                let completedCount = 0;

                return new Promise((resolve) => {
                    const processNext = async (index, url) => {
                        try {
                            const res = await fetch("/generate-article", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    youtubeUrl: url,
                                    provider,
                                    generationMode: "thumbnail",
                                    thumbnailMode: selectedMode,
                                    language,
                                }),
                            });

                            const data = await res.json();

                            if (data.error) {
                                output.innerHTML += `
                                                <div class="result-card" id="card-${index}" style="border-color: #ef4444; margin-bottom: 20px;">
                                                    <p style="color: #ef4444; font-weight: bold;">❌ Thumbnail failed [${index + 1}]: ${url}</p>
                                                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">${data.error}</p>
                                                </div>
                                            `;
                            } else {
                                const finalArticle = injectImage("", data.videoId);
                                saveArticleToLocalStorage(index, url, data.title, data.players, data.videoId, finalArticle);
                                const articleCard = document.createElement("div");
                                articleCard.className = "result-card";
                                articleCard.id = `card-${index}`;
                                articleCard.style.marginBottom = "20px";
                                articleCard.innerHTML = `
                                                <div class="card-controls">
                                                    <button id="select-btn-${index}" class="icon-btn select" onclick="toggleSelectArticle(${index})" title="Select">✅</button>
                                                    <button class="icon-btn copy" onclick="copyArticle(${index})" title="Copy article">📋</button>
                                                    <button class="icon-btn delete" onclick="deleteArticle(${index}, '${url}')" title="Delete article">🗑</button>
                                                </div>
                                                <div style="margin-bottom: 20px;">
                                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Article ${index + 1} Title</label>
                                                    <input type="text" class="flex-1 border" value="${(data.title || "").replace(/"/g, "&quot;")}" style="margin-bottom:15px; width: 100%;" />
                                                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                                        <div>
                                                            <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Thumbnail Text</label>
                                                            <textarea class="player-input border" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;" placeholder="Thumbnail text..." oninput="updateThumbnailText(${index}, this.value)">${(data.players || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
                                                            ${buildThumbnailControls({
                                                                index,
                                                                url,
                                                                title: data.title,
                                                                players: data.players,
                                                                videoId: data.videoId,
                                                                thumbnailVariant: "maxresdefault",
                                                                customThumbnailUrl: "",
                                                            })}
                                                            ${buildStoryActionMarkup(index, url, selectedMode)}
                                                        </div>
                                                    </div>
                                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted); cursor:pointer;" ondblclick="showStoryRetryButton(${index})">Article ${index + 1} Content (HTML)</label>
                                                    <textarea class="w-full min-h-52" style="min-height: 100px; font-family: 'Inter', monospace; font-size: 0.9rem;">${finalArticle}</textarea>
                                                </div>
                                            `;
                                output.appendChild(articleCard);
                                selectArticleIndexByDefault(index);
                                updateStoryNavigationButtons();
                            }
                        } catch (err) {
                            output.innerHTML += `
                                            <div class="result-card" id="card-${index}" style="border-color: #ef4444; margin-bottom: 20px;">
                                                <p style="color: #ef4444; font-weight: bold;">❌ Network error [${index + 1}]</p>
                                                <button onclick="retrySingle('${url}', ${index})" class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; width: auto;">🔄 Thử lại ngay</button>
                                            </div>
                                        `;
                        } finally {
                            completedCount++;
                            if (completedCount === total) {
                                loading.style.display = "none";
                                loading.style.pointerEvents = "";
                                resolve();
                            } else {
                                // Give the API a short cooldown before the next thumbnail request.
                                console.log("⏳ Waiting 3s for API cooldown...");
                                setTimeout(() => {
                                    processNext(index + 1, urls[index + 1]);
                                }, 3000);
                            }
                        }
                    };

                    processNext(0, urls[0]);
                });
            }

            let activeBuzzGeneration = null;
            let lastBuzzUrls = "";
            try {
                lastBuzzUrls = localStorage.getItem("lastBuzzUrls") || "";
            } catch (error) {
                lastBuzzUrls = "";
            }

            function updateBuzzButtonVisibility() {
                const buzzBtn = document.getElementById("buzzBtn");
                const urlInput = document.getElementById("youtubeUrl");
                const restoreBtn = document.getElementById("restoreBuzzUrlsBtn");
                if (!buzzBtn || !urlInput) return;
                const hasUrls = urlInput.value
                    .split("\n")
                    .some((line) => line.trim() !== "");
                buzzBtn.style.display = hasUrls && !activeBuzzGeneration ? "inline-flex" : "none";
                if (restoreBtn) {
                    restoreBtn.style.display = !hasUrls && lastBuzzUrls && !activeBuzzGeneration ? "inline-flex" : "none";
                }
            }

            function saveLastBuzzUrls(urls) {
                lastBuzzUrls = urls;
                try {
                    localStorage.setItem("lastBuzzUrls", urls);
                } catch (error) {}
                updateBuzzButtonVisibility();
            }

            function restoreBuzzUrls() {
                const urlInput = document.getElementById("youtubeUrl");
                if (!urlInput || !lastBuzzUrls) return;
                urlInput.value = lastBuzzUrls;
                urlInput.dispatchEvent(new Event("input", { bubbles: true }));
            }

            function finishBuzzGeneration(run) {
                if (run.finished) return;
                run.finished = true;
                if (run.cooldownTimeout) clearTimeout(run.cooldownTimeout);

                document.getElementById("loading").style.display = "none";
                document.getElementById("loading").style.pointerEvents = "";
                document.getElementById("buzzBtn").disabled = false;
                document.getElementById("stopBuzzBtn").style.display = "none";
                sortCardsInDom();
                updateBuzzButtonVisibility();

                if (activeBuzzGeneration === run) activeBuzzGeneration = null;
                run.resolve();
            }

            function stopBuzzGeneration() {
                if (activeAutoFlowRun) activeAutoFlowRun.cancelled = true;
                const run = activeBuzzGeneration;
                if (!run) {
                    setAutoFlowStopButton(false);
                    return;
                }

                run.stopped = true;
                if (run.cooldownTimeout) {
                    clearTimeout(run.cooldownTimeout);
                    run.cooldownTimeout = null;
                }
                run.controller.abort();
                if (!run.inFlight) finishBuzzGeneration(run);
            }

            // ===================== 🤖 Auto Flow: Buzz → Ảnh → Lina → Google Sheet =====================
            const AUTO_FLOW_LINA_WAIT_MS = 180000;
            const AUTO_FLOW_POLL_MS = 5000;
            let activeAutoFlowRun = null;

            function isAutoFlowDownloadEnabled() {
                return Boolean(document.getElementById("autoFlowDownloadCheck")?.checked);
            }

            function probeThumbnailVariant(videoId, variants = ["maxresdefault", "maxres1", "maxres2", "hqdefault"]) {
                return new Promise((resolve) => {
                    const tryLoad = (index) => {
                        if (index >= variants.length) {
                            resolve(null);
                            return;
                        }
                        const variant = variants[index];
                        const img = new Image();
                        const timer = setTimeout(() => {
                            img.onload = null;
                            img.onerror = null;
                            tryLoad(index + 1);
                        }, 5000);
                        img.onload = () => {
                            clearTimeout(timer);
                            if (img.naturalWidth <= 120 && img.naturalHeight <= 90) {
                                tryLoad(index + 1);
                                return;
                            }
                            resolve(variant);
                        };
                        img.onerror = () => {
                            clearTimeout(timer);
                            tryLoad(index + 1);
                        };
                        img.src = getThumbnailVariantUrl(videoId, variant);
                    };
                    tryLoad(0);
                });
            }

            function setAutoFlowButton(state, text) {
                const button = document.getElementById("autoFlowBtn");
                if (!button) return;
                const colors = {
                    ready: "#8b5cf6",
                    running: "#f59e0b",
                    done: "#10b981",
                    error: "#ef4444",
                };
                const color = colors[state] || colors.ready;
                button.style.background = color;
                button.style.borderColor = color;
                button.style.color = "white";
                button.disabled = state === "running";
                button.innerHTML = state === "running"
                    ? `<span class="button-spinner" aria-hidden="true"></span><span>${text}</span>`
                    : text;
            }

            function setAutoFlowStopButton(visible) {
                const button = document.getElementById("stopBuzzBtn");
                if (button) button.style.display = visible ? "inline-flex" : "none";
            }

            async function runFullAutoFlow() {
                if (activeAutoFlowRun || activeBuzzGeneration) return;

                const urlInput = document.getElementById("youtubeUrl");
                const urls = (urlInput?.value || "")
                    .split("\n")
                    .map((u) => u.trim())
                    .filter((u) => u !== "");
                if (urls.length === 0) {
                    alert("Vui lòng dán ít nhất một YouTube URL trước khi chạy Auto.");
                    return;
                }

                const run = { cancelled: false };
                activeAutoFlowRun = run;
                setLinastoryPasteButtonState("default");

                const downloadEnabled = isAutoFlowDownloadEnabled();
                const totalSteps = downloadEnabled ? 5 : 4;
                const stepLabel = (step, text) => `${step}/${totalSteps} ${text}`;

                try {
                    // Bước 1: Buzz - tạo bài viết
                    setAutoFlowButton("running", stepLabel(1, `Buzz ${urls.length} bài...`));
                    setLinastoryCopyStatus("🤖 Auto: đang tạo bài viết (Buzz)...");
                    await generate();
                    if (run.cancelled) throw new Error("AUTO_FLOW_CANCELLED");

                    // Bước 2: Auto Select Img + đẩy bài sang Lina
                    let saved;
                    try {
                        saved = JSON.parse(localStorage.getItem("saved_articles") || "[]");
                    } catch (error) {
                        saved = [];
                    }
                    const validArticles = Array.isArray(saved)
                        ? saved.filter((item) => Number.isFinite(Number(item.index)))
                        : [];
                    if (validArticles.length === 0) {
                        throw new Error("Không có bài viết nào tạo thành công để chạy tiếp quy trình Auto.");
                    }
                    validArticles.forEach((item) => selectArticleIndexByDefault(item.index));

                    const copyModeSelect = document.getElementById("linastoryCopyMode");
                    const previousCopyMode = copyModeSelect?.value || "all";
                    if (copyModeSelect) copyModeSelect.value = "all";

                    setAutoFlowButton("running", stepLabel(2, `Chọn ảnh + đẩy Lina (${validArticles.length} bài)...`));
                    setLinastoryCopyStatus("🤖 Auto: đang chọn ảnh và đẩy bài sang Lina...");
                    await startAutoSelectImages();
                    if (run.cancelled) throw new Error("AUTO_FLOW_CANCELLED");

                    // Bước 3: đợi permalink từ Lina
                    setAutoFlowStopButton(true);
                    const deadline = Date.now() + AUTO_FLOW_LINA_WAIT_MS;
                    let matchedCount = 0;
                    let missingTitles = [];
                    while (Date.now() < deadline) {
                        if (run.cancelled) throw new Error("AUTO_FLOW_CANCELLED");
                        try {
                            await loadMatchedLinastoryArticles();
                        } catch (error) {
                            // Extension chưa phản hồi, thử lại ở vòng poll sau
                        }
                        const matched = matchedLinastoryArticles.filter((article) => article.link);
                        matchedCount = matched.length;
                        missingTitles = matchedLinastoryArticles
                            .filter((article) => !article.link)
                            .map((article) => `#${Number(article.index) + 1} ${article.title || "(không có title)"}`);
                        if (matchedCount >= validArticles.length) break;
                        setAutoFlowButton("running", stepLabel(3, `Đợi permalink Lina (${matchedCount}/${validArticles.length})...`));
                        setLinastoryCopyStatus(`🤖 Auto: đã khớp ${matchedCount}/${validArticles.length} permalink Lina. Đang đợi...`);
                        await new Promise((resolve) => setTimeout(resolve, AUTO_FLOW_POLL_MS));
                    }
                    setAutoFlowStopButton(false);
                    if (run.cancelled) throw new Error("AUTO_FLOW_CANCELLED");

                    if (matchedCount < validArticles.length) {
                        throw new Error(
                            `Hết thời gian đợi ${Math.round(AUTO_FLOW_LINA_WAIT_MS / 1000)}s mà còn ${validArticles.length - matchedCount} bài chưa lấy được permalink từ Lina: ${missingTitles.join(", ")}. Đã hủy dán Google Sheet.`
                        );
                    }

                    // Bước 4: dán Google Sheet
                    setAutoFlowButton("running", stepLabel(4, "Dán Google Sheet..."));
                    setLinastoryCopyStatus("🤖 Auto: đang dán vào Google Sheet...");
                    if (getLinastorySheetMode()) {
                        const pasted = await pasteLinastoryToSheet();
                        if (!pasted) throw new Error("AUTO_FLOW_PASTE_FAILED");
                    } else {
                        await openLinastoryCopyModal();
                        setLinastoryCopyStatus("🤖 Auto: không tick 'Copy vào Google Sheet' nên chỉ mở danh sách bài để copy thủ công.");
                    }

                    if (copyModeSelect) copyModeSelect.value = previousCopyMode;

                    // Bước 5: kiểm tra text + tải video
                    if (downloadEnabled) {
                        const dirPath = getDownloadDirPath();
                        if (!dirPath) {
                            setAutoFlowButton("done", "✅ Đã hoàn thành");
                            setLinastoryCopyStatus("🤖 Auto: thiếu thư mục gốc lưu video (ô path bên cạnh) — bỏ qua bước tải video.", true);
                        } else {
                            setLinastoryCopyStatus("🤖 Auto: kiểm tra thumbnail text trước khi tải video...");
                            for (const item of validArticles) {
                                if (run.cancelled) throw new Error("AUTO_FLOW_CANCELLED");
                                const articleIndex = Number(item.index);
                                const article = getSavedArticleByIndex(articleIndex);
                                if (!article) continue;
                                const text = (article.players || "").trim() || buildSportsThumbnailText(article.article || "");
                                if (storyGetRawAutoFontSize(text) <= 35) continue;

                                setAutoFlowButton("running", stepLabel(5, `Gen lại text bài ${articleIndex + 1} (font > 35)...`));
                                try {
                                    const language = document.getElementById("language-select")?.value || "English";
                                    const provider = document.getElementById("ai-provider")?.value || "groq";
                                    const res = await fetch("/generate-thumbnail-text", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            title: article.title || "",
                                            article: article.article || "",
                                            language,
                                            provider,
                                        }),
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (res.ok && data.players) {
                                        updateThumbnailText(articleIndex, data.players);
                                        const card = document.getElementById(`card-${articleIndex}`);
                                        const textarea = card?.querySelector("textarea.player-input");
                                        if (textarea) textarea.value = data.players;
                                    }
                                } catch (error) {
                                    console.warn(`⚠️ Auto regen text bài ${articleIndex + 1} thất bại: ${error.message}`);
                                }
                                // Dù regen thành công hay sai vẫn tiếp tục để tải video
                            }

                            setAutoFlowButton("running", stepLabel(5, `Tải ${validArticles.length} video...`));
                            setLinastoryCopyStatus("🤖 Auto: đang tải video về thư mục đã nhập...");
                            await downloadSelectedArticles();
                        }
                    }

                    setAutoFlowButton("done", "✅ Đã hoàn thành");
                    console.log(`🤖 Auto flow hoàn tất: ${validArticles.length} bài đã xử lý trọn bộ.`);
                } catch (error) {
                    if (activeAutoFlowRun === run) {
                        const message = error?.message || "";
                        if (message === "AUTO_FLOW_CANCELLED") {
                            setAutoFlowButton("ready", "🤖 Auto");
                            setLinastoryCopyStatus("🤖 Auto: đã dừng theo yêu cầu.", true);
                        } else if (message === "AUTO_FLOW_PASTE_FAILED") {
                            setAutoFlowButton("error", "⚠️ Lỗi dán Sheet - bấm để chạy lại");
                            // pasteLinastoryToSheet đã tự hiển thị lỗi chi tiết
                        } else {
                            setAutoFlowButton("error", "⚠️ Lỗi - bấm để chạy lại");
                            setLinastoryCopyStatus(`🤖 Auto: ${message || "Lỗi không xác định."}`, true);
                        }
                    }
                } finally {
                    setAutoFlowStopButton(false);
                    if (activeAutoFlowRun === run) activeAutoFlowRun = null;
                }
            }

            async function generate() {
                const urlInput = document.getElementById("youtubeUrl");
                const urls = urlInput.value
                    .split("\n")
                    .map((u) => u.trim())
                    .filter((u) => u !== "");

                console.log("🚀 Batch process initiated with", urls.length, "URLs");

                if (urls.length === 0) {
                    alert("Please enter at least one YouTube URL");
                    return;
                }
                if (activeBuzzGeneration) return;

                saveLastBuzzUrls(urls.join("\n"));
                urlInput.value = "";

                const loading = document.getElementById("loading");
                const resultSection = document.getElementById("resultSection");
                const output = document.getElementById("output");

                loading.style.display = "flex";
                loading.style.pointerEvents = "none";
                document.getElementById("buzzBtn").disabled = true;
                document.getElementById("stopBuzzBtn").style.display = "inline-flex";
                updateBuzzButtonVisibility();
                resultSection.style.display = "block";
                output.innerHTML = "";
                downloadedArticleIndexes.clear();
                selectedArticleIndexes.clear();
                // Clear previous saved articles so new Buzz run doesn't append
                try {
                    localStorage.removeItem("saved_articles");
                } catch (e) {
                    console.warn("Failed to clear saved_articles:", e);
                }

                // Concurrency control: 2 parallel requests (multi-key Groq rotation)
                const concurrencyLimit = 2;
                let nextIndex = 0;
                let completedCount = 0;
                const total = urls.length;

                return new Promise((resolve) => {
                    const run = {
                        controller: new AbortController(),
                        cooldownTimeout: null,
                        finished: false,
                        inFlight: false,
                        resolve,
                        stopped: false,
                    };
                    activeBuzzGeneration = run;

                    const processNext = async () => {
                        if (run.stopped || activeBuzzGeneration !== run) {
                            finishBuzzGeneration(run);
                            return;
                        }
                        if (nextIndex >= total) return;

                        const currentIndex = nextIndex++;
                        const url = urls[currentIndex];
                        console.log(`📡 Thread active: Processing [${currentIndex + 1}/${total}]:`, url);

                        try {
                            const provider = document.getElementById("ai-provider").value;
                            const generationMode = document.getElementById("generation-mode")?.value || "story";
                            const language = document.getElementById("language-select")?.value || "English";
                            run.inFlight = true;
                            const res = await fetch("/generate-article", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                signal: run.controller.signal,
                                body: JSON.stringify({
                                    youtubeUrl: url,
                                    provider: provider,
                                    generationMode: generationMode,
                                    language,
                                }),
                            });

                            const data = await res.json();
                            if (run.stopped) return;

                            if (data.error) {
                                appendBuzzErrorCard(
                                    currentIndex,
                                    url,
                                    `❌ Failed [${currentIndex + 1}]: ${url}`,
                                    data.error,
                                    "🔄 Thử lại bài này",
                                );
                            } else {
                                const finalArticle = generationMode === "buzz-thumbnail" ? injectImage("", data.videoId) : injectImage(data.article, data.videoId);
                                saveArticleToLocalStorage(currentIndex, url, data.title, data.players, data.videoId, finalArticle);
                                const articleCard = document.createElement("div");
                                articleCard.className = "result-card";
                                articleCard.id = `card-${currentIndex}`;
                                articleCard.style.marginBottom = "20px";
                                articleCard.innerHTML = `
                                                <div class="card-controls">
                                                    <button id="select-btn-${currentIndex}" class="icon-btn select" onclick="toggleSelectArticle(${currentIndex})" title="Select">✅</button>
                                                    <button class="icon-btn copy" onclick="copyArticle(${currentIndex})" title="Copy article">📋</button>
                                                    <button class="icon-btn delete" onclick="deleteArticle(${currentIndex}, '${url}')" title="Delete article">🗑</button>
                                                </div>
                                                <div style="margin-bottom: 20px;">
                                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Article ${currentIndex + 1} Title</label>
                                                    <input type="text" class="flex-1 border" value="${data.title || ""}" style="margin-bottom:15px; width: 100%;" oninput="updateSavedArticle(${currentIndex}, 'title', this.value)">

                                                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                                        <div>
                                                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                                                <label style="color:var(--text-muted);">Thumbnail Text</label>
                                                                ${buildThumbnailTextRegenButton(currentIndex)}
                                                            </div>
                                                            <textarea class="player-input border" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;" placeholder="Thumbnail text..." oninput="updateThumbnailText(${currentIndex}, this.value)">${data.players || ""}</textarea>
                                                            ${buildThumbnailControls({ index: currentIndex, url, videoId: data.videoId })}
                                                            ${buildStoryActionMarkup(currentIndex, url, "story")}
                                                        </div>
                                                    </div>

                                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted); cursor:pointer;" ondblclick="showStoryRetryButton(${currentIndex})">Article ${currentIndex + 1} Content (HTML)</label>
                                                    <textarea class="w-full min-h-52" style="min-height: 100px; font-family: 'Inter', monospace; font-size: 0.9rem;" oninput="updateSavedArticle(${currentIndex}, 'article', this.value)">${finalArticle}</textarea>
                                                </div>
                                            `;
                                output.appendChild(articleCard);
                                sortCardsInDom();
                                selectArticleIndexByDefault(currentIndex);
                                updateStoryNavigationButtons();
                            }
                        } catch (err) {
                            if (!run.stopped) {
                                appendBuzzErrorCard(
                                    currentIndex,
                                    url,
                                    `❌ Network error [${currentIndex + 1}]`,
                                    "",
                                    "🔄 Thử lại ngay",
                                );
                            }
                        } finally {
                            run.inFlight = false;
                            if (run.stopped) {
                                finishBuzzGeneration(run);
                                return;
                            }

                            completedCount++;
                            if (completedCount === total) {
                                console.log("🏁 Batch process completed.");
                                finishBuzzGeneration(run);
                            } else {
                                // Add a 1-second delay before picking up the next link to avoid rate limits
                                console.log("⏳ Waiting 1s for API cooldown...");
                                run.cooldownTimeout = setTimeout(() => {
                                    run.cooldownTimeout = null;
                                    processNext();
                                }, 1000);
                            }
                        }
                    };

                    // Start initial concurrency batch
                    for (let i = 0; i < Math.min(concurrencyLimit, total); i++) {
                        processNext();
                    }
                });
            }

            async function retrySingle(url, index) {
                const card = document.getElementById(`card-${index}`);
                const originalHTML = card.innerHTML;
                const currentMode = getStoryModeForCard(card);

                // Show local loading
                card.innerHTML = `<div style="text-align:center; padding: 20px;">⏳ Đang thử lại bài ${index + 1}...</div>`;
                card.style.borderColor = "var(--primary)";

                try {
                    const provider = document.getElementById("ai-provider").value;
                    const generationMode = document.getElementById("generation-mode")?.value || "story";
                    const language = document.getElementById("language-select")?.value || "English";
                    const res = await fetch("/generate-article", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            youtubeUrl: url,
                            provider: provider,
                            generationMode: generationMode,
                            language,
                        }),
                    });

                    const data = await res.json();

                    if (data.error) {
                        card.innerHTML = `
                                        <p style="color: #ef4444; font-weight: bold;">❌ Vẫn lỗi [${index + 1}]: ${url}</p>
                                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">${data.error}</p>
                                        <button onclick="retrySingle('${url}', ${index})" class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; width: auto;">🔄 Thử lại lần nữa</button>
                                    `;
                        card.style.borderColor = "#ef4444";
                    } else {
                        const finalArticle = generationMode === "buzz-thumbnail" ? injectImage("", data.videoId) : injectImage(data.article, data.videoId);
                        saveArticleToLocalStorage(index, url, data.title, data.players, data.videoId, finalArticle);
                        card.innerHTML = `
                                        <div class="card-controls">
                                            <button id="select-btn-${index}" class="icon-btn select" onclick="toggleSelectArticle(${index})" title="Select">✅</button>
                                            <button class="icon-btn copy" onclick="copyArticle(${index})" title="Copy article">📋</button>
                                            <button class="icon-btn delete" onclick="deleteArticle(${index}, '${url}')" title="Delete article">🗑</button>
                                        </div>
                                        <div style="margin-bottom: 20px;">
                                            <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Article ${index + 1} Title</label>
                                            <input type="text" class="flex-1 border" value="${data.title || ""}" style="margin-bottom:15px; width: 100%;" oninput="updateSavedArticle(${index}, 'title', this.value)">

                                            <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                                <div>
                                                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                                        <label style="color:var(--text-muted);">Thumbnail Text</label>
                                                        ${buildThumbnailTextRegenButton(index)}
                                                    </div>
                                                    <textarea class="player-input border" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;" placeholder="Thumbnail text..." oninput="updateThumbnailText(${index}, this.value)">${data.players || ""}</textarea>
                                                    ${buildThumbnailControls({ index, url, videoId: data.videoId })}
                                                    ${buildStoryActionMarkup(index, url, getStoryModeForCard(card))}
                                                </div>
                                            </div>

                                            <label style="display:block; margin-bottom:8px; color:var(--text-muted); cursor:pointer;" ondblclick="showStoryRetryButton(${index})">Article ${index + 1} Content (HTML)</label>
                                            <textarea class="w-full min-h-52" style="min-height: 100px; font-family: 'Inter', monospace; font-size: 0.9rem;" oninput="updateSavedArticle(${index}, 'article', this.value)">${finalArticle}</textarea>
                                        </div>
                                    `;
                        selectArticleIndexByDefault(index);
                        card.style.borderColor = "var(--border)";
                        sortCardsInDom();
                    }
                } catch (err) {
                    card.innerHTML = originalHTML; // Restore original error with button
                    alert("Network error during retry. Please check server.");
                }
            }

            function handleRetry() {
                const notice = document.getElementById("retryNotice");
                const timerSpan = document.getElementById("retryTimer");
                notice.style.display = "block";
                let count = 3;
                const interval = setInterval(() => {
                    count--;
                    timerSpan.innerText = count;
                    if (count <= 0) {
                        clearInterval(interval);
                        notice.style.display = "none";
                        generate();
                    }
                }, 1000);
            }

            function injectImage(article, videoId, thumbnailVariant = "maxresdefault") {
                const imageUrl = getThumbnailVariantUrl(videoId, thumbnailVariant || "maxresdefault");
                const imgTag = `<img style="max-width: 100%; margin-top: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" src="${imageUrl}" />`;
                const iframeTag = `<div style="margin-top: 20px; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px;">
                                <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
                            </div>`;
                const match = article.match(/([.?!]|[*]{2})/);
                if (match) {
                    const index = article.indexOf(match[0]) + match[0].length;
                    return article.slice(0, index) + "\n" + imgTag + "\n" + article.slice(index) + "\n" + iframeTag;
                }
                return imgTag + "\n" + article + "\n" + iframeTag;
            }

            const VIDEO_PREFIX_STORAGE_KEY = "videoFileNamePrefix";
            const VIDEO_START_NUMBER_STORAGE_KEY = "videoFileStartNumber";
            const STORY_SUFFIX_ENABLED_STORAGE_KEY = "storySuffixEnabled";
            const STORY_SUFFIX_TEXT_STORAGE_KEY = "storySuffixText";
            let activeStoryCardIndex = 0;
            let storyCoverImagePromise = null;
            let activeStoryBaseText = "";
            let activeStorySuffix = "";

            function loadStorySuffixSettings() {
                const enabled = localStorage.getItem(STORY_SUFFIX_ENABLED_STORAGE_KEY) === "true";
                const text = localStorage.getItem(STORY_SUFFIX_TEXT_STORAGE_KEY) || "";
                const enabledInput = document.getElementById("storySuffixEnabled");
                const textInput = document.getElementById("storySuffixInput");
                if (enabledInput) enabledInput.checked = enabled;
                if (textInput) textInput.value = text;
            }

            function getStorySuffixText() {
                const enabledInput = document.getElementById("storySuffixEnabled");
                const textInput = document.getElementById("storySuffixInput");
                return enabledInput?.checked ? textInput?.value.trim() || "" : "";
            }

            function applyStorySuffixPreset(value) {
                if (!value) return;
                const textInput = document.getElementById("storySuffixInput");
                const enabledInput = document.getElementById("storySuffixEnabled");
                if (textInput) textInput.value = value;
                if (enabledInput) enabledInput.checked = true;
                saveStorySuffixSettings();
            }

            function syncStorySuffixPresetToArticleLanguage() {
                const languageSelect = document.getElementById("language-select");
                const presetSelect = document.getElementById("storySuffixPreset");
                if (!languageSelect || !presetSelect) return;

                const language = languageSelect.value || "English";
                const matchingOption = Array.from(presetSelect.options).find((option) =>
                    option.dataset.language === language
                );
                if (!matchingOption) return;

                presetSelect.value = matchingOption.value;
                applyStorySuffixPreset(matchingOption.value);
            }

            function applyStorySuffix(text) {
                const baseText = String(text || "").trimEnd();
                const suffix = getStorySuffixText();
                return suffix ? `${baseText}\n${suffix}` : baseText;
            }

            function removeStorySuffix(text, suffix = activeStorySuffix) {
                const normalizedText = String(text || "").trimEnd();
                const normalizedSuffix = String(suffix || "").trim();
                if (!normalizedSuffix || !normalizedText.endsWith(normalizedSuffix)) return normalizedText;
                const baseText = normalizedText.slice(0, normalizedText.length - normalizedSuffix.length).trimEnd();
                return baseText.endsWith("\n") ? baseText.slice(0, -1).trimEnd() : baseText;
            }

            function refreshActiveStorySuffix() {
                const storyTextInput = document.getElementById("storyTextInput");
                const storyModal = document.getElementById("storyModal");
                if (!storyTextInput || !storyModal?.classList.contains("open")) return;
                activeStoryBaseText = removeStorySuffix(storyTextInput.value);
                activeStorySuffix = getStorySuffixText();
                storyTextInput.value = applyStorySuffix(activeStoryBaseText);
                syncStoryTextInputToSavedArticle(false);
                renderStoryPreview();
            }

            function saveStorySuffixSettings() {
                const enabledInput = document.getElementById("storySuffixEnabled");
                const textInput = document.getElementById("storySuffixInput");
                localStorage.setItem(STORY_SUFFIX_ENABLED_STORAGE_KEY, String(Boolean(enabledInput?.checked)));
                localStorage.setItem(STORY_SUFFIX_TEXT_STORAGE_KEY, textInput?.value || "");
                refreshActiveStorySuffix();
            }

            function loadVideoFileNamePrefix() {
                const stored = localStorage.getItem(VIDEO_PREFIX_STORAGE_KEY);
                return stored !== null ? stored : "";
            }

            function saveVideoFileNamePrefix(value) {
                localStorage.setItem(VIDEO_PREFIX_STORAGE_KEY, value || "");
            }

            function loadVideoFileStartNumber() {
                const stored = localStorage.getItem(VIDEO_START_NUMBER_STORAGE_KEY);
                return stored !== null ? stored : "1";
            }

            function saveVideoFileStartNumber(value) {
                const normalized = value && value.trim() !== "" ? value.trim() : "1";
                localStorage.setItem(VIDEO_START_NUMBER_STORAGE_KEY, normalized);
            }

            function getVideoFilePrefixValue() {
                const input = document.getElementById("videoPrefixInput");
                if (input) {
                    const value = input.value.trim();
                    return value !== "" ? value : loadVideoFileNamePrefix();
                }
                return loadVideoFileNamePrefix();
            }

            function getVideoStartNumber() {
                const input = document.getElementById("videoStartNumberInput");
                const raw = input ? input.value.trim() : loadVideoFileStartNumber();
                const parsed = parseInt(raw, 10);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            }

            function getVideoBaseName(index) {
                const prefix = getVideoFilePrefixValue();
                const start = getVideoStartNumber();
                const numberPart = start + index;
                if (prefix) {
                    return `${prefix}${numberPart}`;
                }
                return `${numberPart}`;
            }

            function getVideoDownloadFileName(index) {
                const baseName = getVideoBaseName(index);
                return `${baseName}.mp4`;
            }

            function getImageFileName(index) {
                const baseName = getVideoBaseName(index);
                return `${baseName}.png`;
            }

            function lockBodyScroll() {
                document.body.style.overflow = "hidden";
                document.body.style.position = "relative";
            }

            function unlockBodyScroll() {
                document.body.style.overflow = "";
                document.body.style.position = "";
            }

            function getActiveStoryMode() {
                return document.getElementById("storyModeSelect")?.value || "story";
            }

            function setActiveStoryMode(mode) {
                const modeSelect = document.getElementById("storyModeSelect");
                const generationModeSelect = document.getElementById("generation-mode");
                const effectiveMode = mode || generationModeSelect?.value || "story";

                if (modeSelect) {
                    modeSelect.value = effectiveMode;
                }
                if (generationModeSelect) {
                    generationModeSelect.value = effectiveMode;
                }
                return effectiveMode;
            }

            function getCurrentThumbnailUrl() {
                const currentItem = getSavedArticleByIndex(activeStoryCardIndex);
                if (!currentItem) {
                    return "https://i.ytimg.com/vi/4u3a4u5d5w/maxresdefault.jpg";
                }
                if (currentItem.thumbnailVariant === "custom" && currentItem.customThumbnailUrl) {
                    return currentItem.customThumbnailUrl;
                }
                return getThumbnailVariantUrl(currentItem.videoId, currentItem.thumbnailVariant || "maxresdefault");
            }

            function loadStoryCoverImage() {
                if (storyCoverImagePromise) return storyCoverImagePromise;

                if (!isAutoFlowDownloadEnabled()) {
                    // Checkbox tắt: giữ nguyên hành vi cũ — chỉ load 1 URL duy nhất.
                    storyCoverImagePromise = new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.src = getCurrentThumbnailUrl();
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                    });
                    return storyCoverImagePromise;
                }

                const candidateUrls = [getCurrentThumbnailUrl()];
                const currentItem = getSavedArticleByIndex(activeStoryCardIndex);
                const isCustom = currentItem?.thumbnailVariant === "custom";
                if (!isCustom && currentItem) {
                    ["maxres1", "maxres2", "hqdefault"].forEach((variant) => {
                        const url = currentItem.videoId
                            ? getThumbnailVariantUrl(currentItem.videoId, variant)
                            : null;
                        if (url && !candidateUrls.includes(url)) candidateUrls.push(url);
                    });
                }

                const tryLoad = (urls) => new Promise((resolve) => {
                    if (urls.length === 0) {
                        resolve(null);
                        return;
                    }
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        // ytimg trả ảnh placeholder 120x90 khi variant không tồn tại
                        if (img.naturalWidth <= 120 && img.naturalHeight <= 90) {
                            resolve(tryLoad(urls.slice(1)));
                            return;
                        }
                        resolve(img);
                    };
                    img.onerror = () => resolve(tryLoad(urls.slice(1)));
                    img.src = urls[0];
                });

                storyCoverImagePromise = tryLoad(candidateUrls);
                return storyCoverImagePromise;
            }

            function openStoryTool(cardIndex) {
                activeStoryCardIndex = cardIndex;
                storyCoverImagePromise = null;
                const savedArticle = getSavedArticleByIndex(cardIndex);
                const savedFontSize = Number(savedArticle?.storyFontSize);
                storyFontSizeOverride = Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 90;
                const card = document.getElementById(`card-${cardIndex}`);
                const mode = setActiveStoryMode(getStoryModeForCard(card));
                const textArea = card?.querySelector("textarea.player-input");
                const articleTextArea = card?.querySelector("textarea.w-full.min-h-52");
                const storyTextInput = document.getElementById("storyTextInput");
                const modalTitle = document.querySelector("#storyModal .story-modal-header h3");

                if (mode === "sports") {
                    const generatedSportsText = buildSportsThumbnailText(articleTextArea?.value || "");
                    const savedStoryText = savedArticle?.storyText?.trim();
                    activeStoryBaseText = textArea?.value.trim() || savedStoryText || generatedSportsText;
                    if (modalTitle) modalTitle.textContent = "Sports Hook Creator";
                    storyTextInput.placeholder = "Enter the sports hook text or use the generated clickbait.";
                    storyUpdateMessage("Use the sports hook text from the generated article or enter your own high-impact caption.");
                } else {
                    activeStoryBaseText = textArea?.value.trim() || savedArticle?.storyText || "";
                    if (modalTitle) modalTitle.textContent = "Video Story Creator";
                    storyTextInput.placeholder = "Enter the story text here or use thumbnail text from the article.";
                    storyUpdateMessage("Use the story text from the thumbnail or enter your own narrative.");
                }

                activeStorySuffix = getStorySuffixText();
                storyTextInput.value = applyStorySuffix(activeStoryBaseText);

                lockBodyScroll();
                document.getElementById("storyModal").classList.add("open");
                updateStoryThumbnailSelectorVisibility(mode);
                renderThumbnailSelectorForActiveCard();
                renderStoryPreview();
                updateStoryNavigationButtons();
            }

            function updateStoryThumbnailSelectorVisibility(mode) {
                const selector = document.getElementById("storyThumbnailSelector");
                if (!selector) return;
                selector.style.display = mode === "sports" ? "grid" : "none";
            }

            function closeStoryTool() {
                document.getElementById("storyModal").classList.remove("open");
                unlockBodyScroll();
            }

            function storyGetRawAutoFontSize(text, mode = getActiveStoryMode()) {
                if (!text || !text.trim()) return 38;

                const canvas = document.getElementById("storyExportCanvas");
                const ctx = canvas.getContext("2d");
                const lineHeightRatio = mode === "sports" ? CELEB_STORY_THEME.layout.summaryLineHeight : 1.2;
                const width = canvas.width;
                const height = canvas.height;
                const boxSideInset = CELEB_STORY_THEME.layout.summaryBoxSideInset ?? CELEB_STORY_THEME.layout.textSidePadding;
                const maxWidth = mode === "sports" ? width - boxSideInset * 2 - CELEB_STORY_THEME.layout.summaryBoxPaddingX * 2 : width - 120;
                const sportsImageBottomEstimate = CELEB_STORY_THEME.layout.frameTop + CELEB_STORY_THEME.layout.frameFullWidthHeight * CELEB_STORY_THEME.layout.imageZoom + 40;
                const summaryBoxPaddingTop = CELEB_STORY_THEME.layout.summaryBoxPaddingTop ?? CELEB_STORY_THEME.layout.summaryBoxPaddingY;
                const summaryBoxPaddingBottom = CELEB_STORY_THEME.layout.summaryBoxPaddingBottom ?? CELEB_STORY_THEME.layout.summaryBoxPaddingY;
                const summaryBoxOffsetY = CELEB_STORY_THEME.layout.summaryBoxOffsetY || 0;
                const maxHeight = mode === "sports" ? height - sportsImageBottomEstimate - summaryBoxOffsetY - summaryBoxPaddingTop - summaryBoxPaddingBottom - 40 : height - 120;
                let bestSize = 42;

                for (let size = 90; size >= 14; size -= 1) {
                    const fontFamily = CELEB_STORY_THEME.layout.fontFamily;
                    ctx.font = `900 ${size}px ${fontFamily}`;
                    const lines = storyBuildTextLines(text, maxWidth, size * lineHeightRatio, ctx);
                    const totalHeight = lines.length * size * lineHeightRatio;

                    if (totalHeight <= maxHeight) {
                        bestSize = size;
                        break;
                    }
                }

                return bestSize - 2;
            }

            function storyGetAutoFontSize(text, mode = getActiveStoryMode()) {
                return Math.min(33, Math.max(28, storyGetRawAutoFontSize(text, mode)));
            }

            function syncStoryTextInputToSavedArticle(markAsCustomized = true) {
                const storyTextInput = document.getElementById("storyTextInput");
                if (!storyTextInput || !Number.isFinite(activeStoryCardIndex)) return;

                const value = storyTextInput.value;
                activeStoryBaseText = removeStorySuffix(value);
                if (!value && !getSavedArticleByIndex(activeStoryCardIndex)) return;

                updateSavedArticle(activeStoryCardIndex, "players", activeStoryBaseText);
                updateSavedArticle(activeStoryCardIndex, "storyText", activeStoryBaseText);
                if (markAsCustomized) {
                    updateSavedArticle(activeStoryCardIndex, "storyTextCustomized", true);
                }

                const card = document.getElementById(`card-${activeStoryCardIndex}`);
                const playerTextArea = card?.querySelector("textarea.player-input");
                if (playerTextArea && playerTextArea.value !== activeStoryBaseText) {
                    playerTextArea.value = activeStoryBaseText;
                }
            }

            let storyFontSizeOverride = false;

            let storyPreviewRenderSeq = 0;
            async function renderStoryPreview() {
                const seq = ++storyPreviewRenderSeq;
                const preview = document.getElementById("storyPreview");
                const storyTextInput = document.getElementById("storyTextInput");
                const text = storyTextInput.value.trim();
                const mode = getActiveStoryMode();
                const autoFontSize = storyGetAutoFontSize(text, mode);

                const fontSizeInput = document.getElementById("storyFontSize");
                const savedFontSize = Number(getSavedArticleByIndex(activeStoryCardIndex)?.storyFontSize);
                let fontSize = autoFontSize;
                if (fontSizeInput) {
                    if (storyFontSizeOverride && Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 90) {
                        fontSize = savedFontSize;
                        fontSizeInput.value = String(savedFontSize);
                    } else {
                        fontSizeInput.value = String(autoFontSize);
                        fontSize = autoFontSize;
                    }
                }
                const fontSizeOut = document.getElementById("storyFontOut");
                if (fontSizeOut) {
                    fontSizeOut.textContent = String(fontSize);
                }
                preview.innerHTML = "";

                if (!text) {
                    preview.innerHTML = `
                                    <div class="story-preview-frame">
                                        <div class="story-preview-card">
                                            <p style="color:#94a3b8; font-size: 1rem; max-width: 280px; margin: 0;">Story preview appears here once you type or paste text.</p>
                                        </div>
                                    </div>
                                `;
                    return;
                }

                const dataUrl = await storyCreatePreviewDataURL(text, fontSize);
                if (seq !== storyPreviewRenderSeq) return;
                preview.innerHTML = `
                                <img src="${dataUrl}" alt="Story preview" />
                            `;
            }

            function storyWrapTextLines(text, maxWidth, ctx, fontSize) {
                const words = text.split(/\s+/).filter(Boolean);
                const lines = [];
                let currentLine = "";

                words.forEach((word) => {
                    const candidate = currentLine ? `${currentLine} ${word}` : word;
                    if (ctx.measureText(candidate).width > maxWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = candidate;
                    }
                });

                if (currentLine) {
                    lines.push(currentLine);
                }

                return lines;
            }

            function storyDrawRoundedRect(ctx, x, y, width, height, radius) {
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
            }

            const STORY_ALT_COLOR_DEFAULT = "#F245E4";
            const STORY_ALT_COLORS = ["#ffffff", STORY_ALT_COLOR_DEFAULT];

            function storyGetAltColor(index) {
                const custom = window.storyAltColors;
                const palette = Array.isArray(custom) && custom.length > 0 ? custom : STORY_ALT_COLORS;
                return palette[index % palette.length] || STORY_ALT_COLOR_DEFAULT;
            }

            function storySetAltColors(colors) {
                if (!Array.isArray(colors) || colors.length === 0) {
                    window.storyAltColors = [...STORY_ALT_COLORS];
                    return window.storyAltColors;
                }

                const cleaned = colors.map((color) => String(color || "").trim()).filter(Boolean);

                window.storyAltColors = cleaned.length > 0 ? cleaned : [...STORY_ALT_COLORS];
                return window.storyAltColors;
            }

            function storyApplyAccentColor(color) {
                const safeColor = /^#[0-9a-fA-F]{3,6}$/.test(String(color || "")) ? color : STORY_ALT_COLOR_DEFAULT;
                storySetAltColors(["#ffffff", safeColor]);

                const colorSelect = document.getElementById("storyAccentColorSelect");
                if (colorSelect && colorSelect.value !== safeColor) {
                    colorSelect.value = safeColor;
                }

                renderStoryPreview();
            }

            window.storyAltColors = [...STORY_ALT_COLORS];

            function storySplitTextByPunctuation(text) {
                const regex = /[^.!?]+?(?:\band\b\s*|[.!?]+\s*|$)/gi;
                return (text.match(regex) || []).filter((segment) => segment.trim());
            }

            function storyBuildTextLines(text, maxWidth, lineHeight, ctx) {
                const words = [];
                const paragraphs = String(text || "").split(/\r?\n/);
                paragraphs.forEach((paragraph, paragraphIndex) => {
                    const segments = storySplitTextByPunctuation(paragraph).map((segment, index) => ({
                        text: segment,
                        color: index % 2 === 0 ? storyGetAltColor(0) : storyGetAltColor(1),
                    }));

                    segments.forEach((segment) => {
                        const segmentText = segment.text.trim();
                        const splitWords = segmentText.split(/\s+/).filter(Boolean);
                        const hasTrailingSpace = /\s$/.test(segment.text);
                        splitWords.forEach((word, index) => {
                            const hasSpace = index < splitWords.length - 1 || (index === splitWords.length - 1 && hasTrailingSpace);
                            words.push({ text: word + (hasSpace ? " " : ""), color: segment.color });
                        });
                    });

                    if (paragraphIndex < paragraphs.length - 1) {
                        words.push({ text: "\n", color: storyGetAltColor(0) });
                    }
                });

                const lines = [];
                let currentLine = [];
                let currentWidth = 0;

                words.forEach((word) => {
                    if (word.text === "\n") {
                        lines.push(currentLine);
                        currentLine = [];
                        currentWidth = 0;
                        return;
                    }
                    const width = ctx.measureText(word.text).width;
                    if (currentLine.length > 0 && currentWidth + width > maxWidth) {
                        lines.push(currentLine);
                        currentLine = [];
                        currentWidth = 0;
                    }
                    currentLine.push(word);
                    currentWidth += width;
                });

                if (currentLine.length > 0) {
                    lines.push(currentLine);
                }

                return lines;
            }

            function storyMeasureLineWidth(lineTokens, ctx) {
                return lineTokens.reduce((sum, token) => sum + ctx.measureText(token.text).width, 0);
            }

            let storyBackgroundImagePromise = null;
            function loadStoryBackgroundImage() {
                if (storyBackgroundImagePromise) return storyBackgroundImagePromise;
                storyBackgroundImagePromise = new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = "bg.png";
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                });
                return storyBackgroundImagePromise;
            }

            const CELEB_STORY_THEME = {
                name: "Celeb",
                colors: {
                    backgroundColor: "#000000",
                    backgroundMode: "image",
                    backgroundImage: "bg.png",
                    textColor: "#FFFFFF",
                    accentColor: "#E4BB49",
                    summaryBoxColor: "#922136",
                    summaryBoxOpacity: 1,
                    titleColor: "#ffffff",
                    titleBoxColor: "#CD0001",
                },
                layout: {
                    fontFamily: "Arial, sans-serif",
                    titleSize: 28,
                    fontSize: 27,
                    summaryLineHeight: 1.58,
                    summaryLineGap: 3,
                    summaryBoxEnabled: true,
                    summaryBoxPaddingX: 16,
                    summaryBoxPaddingY: 32,
                    summaryBoxPaddingTop: 30,
                    summaryBoxPaddingBottom: 28,
                    summaryBoxRadius: 19,
                    summaryBoxOffsetY: 24,
                    frameTop: 50,
                    frameFullWidth: true,
                    frameFullWidthHeight: 420,
                    frameSideInset: 0,
                    imageZoom: 0.98,
                    imageOffsetX: 0,
                    imageOffsetY: 30,
                    textTop: 486,
                    textSidePadding: 10,
                    summaryBoxSideInset: 35,
                },
            };

            function storyRoundRectPath(ctx, x, y, width, height, radius) {
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
            }

            async function storyDrawSummaryBoxBackdrop(ctx, x, y, width, height, theme) {
                const radius = theme.layout.summaryBoxRadius || 19;

                ctx.beginPath();
                storyRoundRectPath(ctx, x, y, width, height, radius);
                ctx.fillStyle = theme.colors.summaryBoxColor;
                ctx.globalAlpha = theme.colors.summaryBoxOpacity || 1;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            async function storyDrawLowerBackground(ctx, y, width, height) {
                const coverImage = await loadStoryCoverImage();
                if (!coverImage || y >= height) return;

                const regionHeight = height - y;
                const sourceWidth = coverImage.naturalWidth || coverImage.width;
                const sourceHeight = coverImage.naturalHeight || coverImage.height;
                const scale = Math.max(width / sourceWidth, regionHeight / sourceHeight) * 1.15;
                const drawWidth = sourceWidth * scale;
                const drawHeight = sourceHeight * scale;
                const drawX = (width - drawWidth) / 2;
                const drawY = y + (regionHeight - drawHeight) / 2;

                ctx.save();
                ctx.beginPath();
                ctx.rect(0, y, width, regionHeight);
                ctx.clip();
                ctx.filter = "blur(8px) brightness(0.48) saturate(0.75)";
                ctx.drawImage(coverImage, drawX, drawY, drawWidth, drawHeight);
                ctx.filter = "none";

                const overlay = ctx.createLinearGradient(0, y, 0, height);
                overlay.addColorStop(0, "rgba(4, 12, 9, 0.45)");
                overlay.addColorStop(0.5, "rgba(10, 12, 8, 0.52)");
                overlay.addColorStop(1, "rgba(55, 36, 14, 0.68)");
                ctx.fillStyle = overlay;
                ctx.fillRect(0, y, width, regionHeight);
                ctx.restore();
            }

            async function storyDrawImage(line, color, fontSize) {
                const canvas = document.getElementById("storyExportCanvas");
                const ctx = canvas.getContext("2d");
                const width = canvas.width;
                const height = canvas.height;
                ctx.clearRect(0, 0, width, height);

                const theme = CELEB_STORY_THEME;
                const themeFontSize = fontSize || theme.layout.fontSize;

                if (document.fonts?.load) {
                    await document.fonts.load(`900 ${themeFontSize}px ${theme.layout.fontFamily}`);
                }

                const mode = getActiveStoryMode();
                if (mode === "sports") {
                    ctx.fillStyle = theme.colors.backgroundColor;
                    ctx.fillRect(0, 0, width, height);

                    await storyDrawLowerBackground(ctx, 0, width, height);

                    let imageBottom = theme.layout.frameTop + theme.layout.frameFullWidthHeight;
                    const coverImage = await loadStoryCoverImage();
                    if (coverImage) {
                        const sourceWidth = coverImage.naturalWidth || coverImage.width;
                        const sourceHeight = coverImage.naturalHeight || coverImage.height;
                        const frameX = theme.layout.frameFullWidth ? 0 : theme.layout.frameSideInset;
                        const frameY = theme.layout.frameTop;
                        const frameW = theme.layout.frameFullWidth ? width : width - theme.layout.frameSideInset * 2;
                        const frameH = theme.layout.frameFullWidthHeight;
                        const scale = Math.max(frameW / sourceWidth, frameH / sourceHeight) * theme.layout.imageZoom;
                        const drawWidth = sourceWidth * scale;
                        const drawHeight = sourceHeight * scale;
                        const offsetX = frameX + (frameW - drawWidth) / 2 + theme.layout.imageOffsetX;
                        const offsetY = frameY + (frameH - drawHeight) / 2 + theme.layout.imageOffsetY;
                        imageBottom = offsetY + drawHeight;
                        ctx.drawImage(coverImage, offsetX, offsetY, drawWidth, drawHeight);
                    }

                    ctx.font = `900 ${themeFontSize}px ${theme.layout.fontFamily}`;
                    ctx.textAlign = "left";
                    ctx.textBaseline = "top";
                    const boxSideInset = theme.layout.summaryBoxSideInset ?? theme.layout.textSidePadding;
                    const maxWidth = width - boxSideInset * 2 - theme.layout.summaryBoxPaddingX * 2;
                    const lineHeight = themeFontSize * theme.layout.summaryLineHeight;
                    const lines = storyBuildTextLines(line, maxWidth, lineHeight, ctx);
                    const textHeight = lines.length * lineHeight;
                    const summaryBoxPaddingTop = theme.layout.summaryBoxPaddingTop ?? theme.layout.summaryBoxPaddingY;
                    const summaryBoxPaddingBottom = theme.layout.summaryBoxPaddingBottom ?? theme.layout.summaryBoxPaddingY;
                    const boxX = boxSideInset;
                    const boxY = Math.max(theme.layout.textTop, imageBottom + 16) + (theme.layout.summaryBoxOffsetY || 0);
                    const boxW = width - boxSideInset * 2;
                    const boxH = textHeight + summaryBoxPaddingTop + summaryBoxPaddingBottom;

                    if (theme.layout.summaryBoxEnabled) {
                        await storyDrawSummaryBoxBackdrop(ctx, boxX, boxY, boxW, boxH, theme);
                    }

                    let y = boxY + summaryBoxPaddingTop;
                    lines.forEach((lineTokens) => {
                        let x = boxX + theme.layout.summaryBoxPaddingX;
                        lineTokens.forEach((token) => {
                            ctx.fillStyle = token.color === storyGetAltColor(1) ? theme.colors.accentColor : theme.colors.textColor;
                            ctx.fillText(token.text, x, y);
                            x += ctx.measureText(token.text).width;
                        });
                        y += lineHeight;
                    });
                    return;
                }

                ctx.fillStyle = theme.colors.backgroundColor;
                ctx.fillRect(0, 0, width, height);

                const frameX = theme.layout.frameFullWidth ? 0 : theme.layout.frameSideInset;
                const frameY = theme.layout.frameTop;
                const frameW = theme.layout.frameFullWidth ? width : width - theme.layout.frameSideInset * 2;
                const frameH = theme.layout.frameFullWidthHeight;
                const coverImage = await loadStoryCoverImage();
                if (coverImage) {
                    const sourceWidth = coverImage.naturalWidth || coverImage.width;
                    const sourceHeight = coverImage.naturalHeight || coverImage.height;
                    const scale = Math.max(frameW / sourceWidth, frameH / sourceHeight) * theme.layout.imageZoom;
                    const drawWidth = sourceWidth * scale;
                    const drawHeight = sourceHeight * scale;
                    const offsetX = frameX + (frameW - drawWidth) / 2 + theme.layout.imageOffsetX;
                    const offsetY = frameY + (frameH - drawHeight) / 2 + theme.layout.imageOffsetY;
                    ctx.drawImage(coverImage, offsetX, offsetY, drawWidth, drawHeight);
                }

                ctx.font = `900 ${themeFontSize}px ${theme.layout.fontFamily}`;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                const maxWidth = width - theme.layout.textSidePadding * 2 - theme.layout.summaryBoxPaddingX * 2;
                const lineHeight = themeFontSize * theme.layout.summaryLineHeight;
                const lines = storyBuildTextLines(line, maxWidth, lineHeight, ctx);
                const textHeight = lines.length * lineHeight;
                const boxX = theme.layout.textSidePadding;
                const boxY = theme.layout.textTop;
                const boxW = width - theme.layout.textSidePadding * 2;
                const boxH = textHeight + theme.layout.summaryBoxPaddingY * 2;

                if (theme.layout.summaryBoxEnabled) {
                    await storyDrawSummaryBoxBackdrop(ctx, boxX, boxY, boxW, boxH, theme);
                }

                ctx.fillStyle = theme.colors.textColor;
                let y = boxY + theme.layout.summaryBoxPaddingY;
                lines.forEach((lineTokens) => {
                    let x = boxX + theme.layout.summaryBoxPaddingX;
                    lineTokens.forEach((token) => {
                        ctx.fillStyle = token.color === storyGetAltColor(1) ? theme.colors.accentColor : theme.colors.textColor;
                        ctx.fillText(token.text, x, y);
                        x += ctx.measureText(token.text).width;
                    });
                    y += lineHeight;
                });
            }

            function storyCreateImageBlob(line, color, fontSize) {
                return new Promise(async (resolve) => {
                    await storyDrawImage(line, color, fontSize);
                    const canvas = document.getElementById("storyExportCanvas");
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, "image/png");
                });
            }

            async function storyCreatePreviewDataURL(line, fontSize) {
                await storyDrawImage(line, "#ffffff", fontSize);
                const canvas = document.getElementById("storyExportCanvas");
                return canvas.toDataURL("image/png");
            }

            async function storyCreateAllImages() {
                const line = document.getElementById("storyTextInput").value.trim();
                if (!line) {
                    storyUpdateMessage("Please enter text to create an image.", true);
                    return [];
                }
                const fontSize = parseInt(document.getElementById("storyFontSize").value, 10) || 42;
                const blob = await storyCreateImageBlob(line, "#ffffff", fontSize);
                const name = getImageFileName(activeStoryCardIndex || 0);
                const result = [{ blob, name, text: line }];
                storyUpdateBatchPreview(result);
                storyUpdateMessage("Created 1 image. Ready to send to converter.", false);
                return result;
            }

            function storyUpdateBatchPreview(blobs) {
                const batchPreview = document.getElementById("storyBatchPreview");
                batchPreview.innerHTML = "";
                blobs.forEach((item) => {
                    const url = URL.createObjectURL(item.blob);
                    const thumb = document.createElement("div");
                    thumb.style.border = "1px solid #cbd5e1";
                    thumb.style.borderRadius = "8px";
                    thumb.style.overflow = "hidden";
                    thumb.style.background = "#fff";
                    thumb.style.padding = "8px";

                    const img = document.createElement("img");
                    img.src = url;
                    img.style.width = "100%";
                    img.style.height = "auto";
                    img.style.display = "block";
                    img.style.borderRadius = "6px";

                    const label = document.createElement("div");
                    label.textContent = item.name;
                    label.style.fontSize = "12px";
                    label.style.marginTop = "8px";
                    label.style.wordBreak = "break-all";
                    label.style.color = "#334155";

                    thumb.appendChild(img);
                    thumb.appendChild(label);
                    batchPreview.appendChild(thumb);
                });
            }

            function storyUpdateMessage(text, isError = false) {
                const messageEl = document.getElementById("storyMessage");
                messageEl.textContent = text;
                messageEl.style.color = isError ? "#dc2626" : "#334155";
            }

            async function storyConvertAndDownload() {
                const blobs = await storyCreateAllImages();
                if (blobs.length === 0) return false;

                const formData = new FormData();
                blobs.forEach((item) => {
                    formData.append("files", item.blob, item.name);
                });
                formData.append("randomDuration", "true");

                try {
                    const response = await fetch("/convert-download", {
                        method: "POST",
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || "Conversion failed");
                    }

                    const defaultDownloadName = getVideoDownloadFileName(activeStoryCardIndex || 0);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = defaultDownloadName;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);

                    return true;
                } catch (err) {
                    throw err;
                }
            }

            function setStoryButtonsLoading(isLoading) {
                const primary = document.querySelector(".story-modal-actions .btn-primary");
                const secondary = document.getElementById("storyDownloadButton");
                const copyBtn = document.getElementById("storyCopyAllButton");
                const prevBtn = document.getElementById("storyPrevButton");
                const nextBtn = document.getElementById("storyNextButton");
                if (primary) {
                    primary.disabled = !!isLoading;
                    primary.style.opacity = isLoading ? "0.7" : "1";
                    primary.innerText = isLoading ? "⏳ Converting..." : "Create & Send to Converter";
                }
                if (secondary) {
                    secondary.disabled = !!isLoading;
                    secondary.style.opacity = isLoading ? "0.7" : "1";
                    secondary.innerText = isLoading ? "⏳" : "⬇";
                }
                if (copyBtn) {
                    copyBtn.disabled = !!isLoading;
                }
                if (prevBtn) {
                    prevBtn.disabled = !!isLoading;
                    prevBtn.style.opacity = isLoading ? "0.7" : "1";
                }
                if (nextBtn) {
                    nextBtn.disabled = !!isLoading;
                    nextBtn.style.opacity = isLoading ? "0.7" : "1";
                }
            }

            async function storySendToServer() {
                setStoryButtonsLoading(true);
                storyUpdateMessage("Converting to video and preparing download...");
                try {
                    await storyConvertAndDownload();
                    storyUpdateMessage(`Video converted successfully. Download should start shortly.`, false);
                } catch (err) {
                    storyUpdateMessage(err.message || "Conversion failed", true);
                } finally {
                    setStoryButtonsLoading(false);
                }
            }

            async function storyDownload() {
                setStoryButtonsLoading(true);
                storyUpdateMessage("Preparing quick download...");
                try {
                    await storyConvertAndDownload();
                    storyUpdateMessage(`Download initiated.`, false);
                } catch (err) {
                    storyUpdateMessage(err.message || "Download failed", true);
                } finally {
                    setStoryButtonsLoading(false);
                }
            }

            async function storyCopyAll() {
                const saved = getSavedArticleByIndex(activeStoryCardIndex);
                let content = saved?.article || "";
                if (!content) {
                    const card = document.getElementById(`card-${activeStoryCardIndex}`);
                    const ta = card?.querySelector("textarea.w-full.min-h-52");
                    content = ta?.value || "";
                }
                if (!content) {
                    storyUpdateMessage("No article content to copy.", true);
                    return;
                }
                content = content
                    .replace(/<[^>]+>/g, "\n")
                    .replace(/&nbsp;/gi, " ")
                    .replace(/\u00a0/g, " ")
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .join("\n");
                try {
                    await navigator.clipboard.writeText(content);
                    storyUpdateMessage("Copied article content to clipboard.", false);
                } catch (err) {
                    storyUpdateMessage("Copy failed. Try selecting and copying manually.", true);
                }
            }

            async function storyPasteFromClipboard() {
                try {
                    const clipboardContent = await navigator.clipboard.readText();
                    if (!clipboardContent) {
                        storyUpdateMessage("Clipboard is empty.", true);
                        return;
                    }

                    const content = clipboardContent
                        .replace(/\*\*/g, "")
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .join("\n");
                    const storyTextInput = document.getElementById("storyTextInput");
                    storyTextInput.value = content;
                    storyTextInput.dispatchEvent(new Event("input", { bubbles: true }));
                    storyUpdateMessage("Pasted clipboard content into story text.", false);
                } catch (err) {
                    storyUpdateMessage(err.message || "Unable to read clipboard. Check browser permissions.", true);
                }
            }

            const videoPrefixInput = document.getElementById("videoPrefixInput");
            const videoStartNumberInput = document.getElementById("videoStartNumberInput");
            if (videoPrefixInput) {
                videoPrefixInput.value = loadVideoFileNamePrefix();
                videoPrefixInput.addEventListener("input", (event) => {
                    saveVideoFileNamePrefix(event.target.value.trim());
                });
            }
            if (videoStartNumberInput) {
                videoStartNumberInput.value = loadVideoFileStartNumber();
                videoStartNumberInput.addEventListener("input", (event) => {
                    saveVideoFileStartNumber(event.target.value);
                });
            }

            const generationModeSelect = document.getElementById("generation-mode");
            const storyModeSelect = document.getElementById("storyModeSelect");

            const syncStoryModeSelection = (event) => {
                const sourceSelect = event?.target;
                const selectedMode = sourceSelect?.value || generationModeSelect?.value || storyModeSelect?.value || "story";
                const mode = setActiveStoryMode(selectedMode);
                const card = document.getElementById(`card-${activeStoryCardIndex}`);
                const textArea = card?.querySelector("textarea.player-input");
                const articleTextArea = card?.querySelector("textarea.w-full.min-h-52");
                const storyTextInput = document.getElementById("storyTextInput");
                const modalTitle = document.querySelector("#storyModal .story-modal-header h3");

                if (mode === "sports") {
                    activeStoryBaseText = textArea?.value.trim() || buildSportsThumbnailText(articleTextArea?.value || "");
                    storyTextInput.placeholder = "Enter the sports hook text or use the generated clickbait.";
                    if (modalTitle) modalTitle.textContent = "Sports Hook Creator";
                } else {
                    activeStoryBaseText = textArea?.value.trim() || activeStoryBaseText || storyTextInput.value.trim() || "";
                    storyTextInput.placeholder = "Enter the story text here or use thumbnail text from the article.";
                    if (modalTitle) modalTitle.textContent = "Video Story Creator";
                }

                activeStorySuffix = getStorySuffixText();
                storyTextInput.value = applyStorySuffix(activeStoryBaseText);

                updateStoryThumbnailSelectorVisibility(mode);
                renderStoryPreview();
            };

            generationModeSelect?.addEventListener("change", syncStoryModeSelection);
            storyModeSelect?.addEventListener("change", syncStoryModeSelection);
            loadStorySuffixSettings();
            document.getElementById("storySuffixEnabled")?.addEventListener("change", saveStorySuffixSettings);
            document.getElementById("storySuffixInput")?.addEventListener("input", saveStorySuffixSettings);
            const youtubeLanguageDetection = {
                cache: new Map(),
                requestId: 0,
                timer: null,
                result: null,
                error: null,
            };

            function findFirstYoutubeVideoUrl(value) {
                for (const line of String(value || "").split(/\r?\n/)) {
                    const match = line.match(/(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i);
                    if (!match) continue;

                    const candidate = match[0].replace(/[),.;]+$/g, "");
                    try {
                        const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
                        const host = url.hostname.toLowerCase();
                        let videoId = null;
                        if (host === "youtu.be") {
                            videoId = url.pathname.split("/").filter(Boolean)[0];
                        } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
                            videoId =
                                url.searchParams.get("v") ||
                                url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
                        }
                        if (/^[a-zA-Z0-9_-]{11}$/.test(videoId || "")) {
                            return `https://www.youtube.com/watch?v=${videoId}`;
                        }
                    } catch {
                        continue;
                    }
                }
                return null;
            }

            function setYoutubeLanguageStatus(message, state = "info", actionLabel = "") {
                const status = document.getElementById("youtubeLanguageStatus");
                const statusText = document.getElementById("youtubeLanguageStatusText");
                const action = document.getElementById("applyDetectedVideoLanguage");
                statusText.textContent = message;
                status.dataset.state = state;
                status.hidden = !message;
                action.textContent = actionLabel;
                action.hidden = !actionLabel;
            }

            function updateYoutubeLanguageStatus() {
                const result = youtubeLanguageDetection.result;
                if (youtubeLanguageDetection.error) {
                    setYoutubeLanguageStatus(youtubeLanguageDetection.error, "error");
                    return;
                }
                if (!result) return;

                if (!result.detected) {
                    setYoutubeLanguageStatus(
                        "Chưa đủ dữ liệu để nhận diện ngôn ngữ video từ metadata, title hoặc description.",
                    );
                    return;
                }

                const source = result.source === "metadata" ? "metadata YouTube" : "title/description";
                if (!result.supported) {
                    setYoutubeLanguageStatus(
                        `Video đầu tiên có vẻ dùng ${result.languageName} (theo ${source}); hiện chỉ hỗ trợ tạo bài bằng English hoặc German. Lựa chọn hiện tại được giữ nguyên.`,
                        "warning",
                    );
                    return;
                }

                const selectedLanguage = document.getElementById("language-select").value;
                if (selectedLanguage === result.language) {
                    setYoutubeLanguageStatus(
                        `Đã nhận diện video đầu tiên là ${result.language} (theo ${source}); ngôn ngữ bài viết khớp.`,
                        "success",
                    );
                    return;
                }

                const languageSelect = document.getElementById("language-select");
                if (languageSelect) {
                    languageSelect.value = result.language;
                    languageSelect.dispatchEvent(new Event("change", { bubbles: true }));
                }
                setYoutubeLanguageStatus(
                    `Đã tự chọn ${result.language} theo ngôn ngữ video đầu tiên (theo ${source}).`,
                    "success",
                );
            }

            function scheduleYoutubeLanguageDetection() {
                clearTimeout(youtubeLanguageDetection.timer);
                const requestId = ++youtubeLanguageDetection.requestId;
                youtubeLanguageDetection.result = null;
                youtubeLanguageDetection.error = null;

                const input = document.getElementById("youtubeUrl");
                const firstVideoUrl = findFirstYoutubeVideoUrl(input.value);
                if (!firstVideoUrl) {
                    const hasInput = Boolean(input.value.trim());
                    setYoutubeLanguageStatus(
                        hasInput ? "Chưa tìm thấy URL YouTube hợp lệ để kiểm tra ngôn ngữ." : "",
                    );
                    return;
                }

                const videoId = new URL(firstVideoUrl).searchParams.get("v");
                const cached = youtubeLanguageDetection.cache.get(videoId);
                if (cached) {
                    youtubeLanguageDetection.result = cached;
                    updateYoutubeLanguageStatus();
                    return;
                }

                setYoutubeLanguageStatus("Đang kiểm tra ngôn ngữ video YouTube đầu tiên...");
                youtubeLanguageDetection.timer = setTimeout(async () => {
                    try {
                        const response = await fetch("/detect-video-language", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ youtubeUrl: firstVideoUrl }),
                        });
                        const responseText = await response.text();
                        let data;
                        try {
                            data = responseText ? JSON.parse(responseText) : {};
                        } catch (parseError) {
                            throw new Error(
                                `Máy chủ không trả về JSON hợp lệ (HTTP ${response.status}). Hãy restart server bằng npm start và kiểm tra backend/server.js.`,
                            );
                        }
                        if (!response.ok) {
                            throw new Error(data.error || "Không thể kiểm tra ngôn ngữ video.");
                        }
                        if (requestId !== youtubeLanguageDetection.requestId) return;

                        youtubeLanguageDetection.cache.set(videoId, data);
                        youtubeLanguageDetection.result = data;
                        updateYoutubeLanguageStatus();
                    } catch (error) {
                        if (requestId !== youtubeLanguageDetection.requestId) return;
                        youtubeLanguageDetection.error =
                            error.message || "Không thể kiểm tra ngôn ngữ video.";
                        updateYoutubeLanguageStatus();
                    }
                }, 450);
            }

            document.getElementById("youtubeUrl")?.addEventListener("input", scheduleYoutubeLanguageDetection);
            document.getElementById("youtubeUrl")?.addEventListener("input", updateBuzzButtonVisibility);
            document.getElementById("youtubeUrl")?.addEventListener("change", updateBuzzButtonVisibility);
            updateBuzzButtonVisibility();
            document.getElementById("language-select")?.addEventListener("change", updateYoutubeLanguageStatus);
            document.getElementById("language-select")?.addEventListener("change", syncStorySuffixPresetToArticleLanguage);
            document.getElementById("language-select")?.addEventListener("change", syncLinastoryCopyTemplateToArticleLanguage);

            renderLinastoryPresetCards();
            syncLinastoryCopyTemplateToArticleLanguage();

            const downloadBasePathInput = document.getElementById("downloadBasePath");
            if (downloadBasePathInput) {
                downloadBasePathInput.value = localStorage.getItem("downloadDirPath") || "";
                downloadBasePathInput.addEventListener("change", () => {
                    try {
                        localStorage.setItem("downloadDirPath", downloadBasePathInput.value.trim());
                    } catch (error) {}
                });
            }
            const downloadPrefixPathInput = document.getElementById("downloadPrefixPath");
            if (downloadPrefixPathInput) {
                let storedPrefix = null;
                try {
                    storedPrefix = JSON.parse(localStorage.getItem("downloadPrefixPath"));
                } catch (error) {}
                downloadPrefixPathInput.value = storedPrefix?.custom && storedPrefix?.value ? storedPrefix.value : getDownloadDatePrefix();
                downloadPrefixPathInput.addEventListener("change", () => {
                    const prefixValue = downloadPrefixPathInput.value.trim();
                    try {
                        localStorage.setItem(
                            "downloadPrefixPath",
                            JSON.stringify({ value: prefixValue, custom: prefixValue !== getDownloadDatePrefix() }),
                        );
                    } catch (error) {}
                });
            }
            syncStoryModeSelection();

            const youtubeUrlLabel = document.getElementById("youtubeUrlLabel");
            let sampleArticleIndex = 0;
            const sampleArticles = [
                {
                    title: "Sample Article: 5 bước tăng traffic nhanh",
                    players: "Tăng traffic, Nội dung hấp dẫn, SEO YouTube",
                    body: "<p>Đây là nội dung bài viết mẫu để bạn kiểm tra giao diện và chỉnh sửa. Sử dụng cấu trúc này để tạo ra các bài viết chất lượng từ video.</p>",
                },
                {
                    title: "Sample Article: Bí quyết tối ưu hóa video",
                    players: "Tối ưu thumbnail, Tăng lượt xem, Thu hút người xem",
                    body: "<p>Đây là một bài viết mẫu khác, với các đoạn văn bản demo để giúp bạn thấy rõ định dạng và mẫu bài viết.</p>",
                },
                {
                    title: "Sample Article: Kỹ thuật viết nội dung AI",
                    players: "AI, nội dung, tự động hóa, tối ưu hóa",
                    body: "<p>Bài viết mẫu này giúp bạn kiểm tra chức năng xem trước và chỉnh sửa nội dung HTML trong card.</p>",
                },
            ];

            function openSampleStory(sampleText) {
                activeStoryCardIndex = 0;
                const storyTextInput = document.getElementById("storyTextInput");
                storyTextInput.value = sampleText;
                document.getElementById("storyModal").classList.add("open");
                renderStoryPreview();
                storyUpdateMessage("Use the story text from the thumbnail or enter your own narrative.");
            }

            function appendSampleArticleCard() {
                const output = document.getElementById("output");
                const resultSection = document.getElementById("resultSection");
                if (!output || !resultSection) return;

                resultSection.style.display = "block";
                const sample = sampleArticles[sampleArticleIndex % sampleArticles.length];
                const articleCard = document.createElement("div");
                articleCard.className = "result-card";
                articleCard.style.marginBottom = "20px";
                articleCard.innerHTML = `
                                <div class="card-controls">
                                    <button id="select-sample-${sampleArticleIndex}" class="icon-btn select" onclick="toggleSelectArticle(${sampleArticleIndex})" title="Select">⬜</button>
                                    <button class="icon-btn copy" onclick="copySampleArticle(${sampleArticleIndex})" title="Copy sample">📋</button>
                                </div>
                                <div style="margin-bottom: 20px;">
                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Sample Article Title</label>
                                    <input type="text" class="flex-1 border" value="${sample.title}" style="margin-bottom:15px; width: 100%;">
                                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                        <div>
                                            <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Sample Thumbnail Text</label>
                                            <textarea class="player-input border sample-player-text" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.85rem;">${sample.players}</textarea>
                                            <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.95rem;">Sample thumbnail information.</p>
                                            <button type="button" class="btn-secondary sample-story-btn" style="margin-top:12px; padding: 10px 16px; font-size: 0.92rem;">🎬 Create Story</button>
                                        </div>
                                    </div>
                                    <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Sample Article Content (HTML)</label>
                                    <textarea class="w-full min-h-52" style="min-height: 200px; font-family: 'Inter', monospace; font-size: 0.9rem;">${sample.body}</textarea>
                                </div>
                            `;
                output.appendChild(articleCard);

                const storyButton = articleCard.querySelector(".sample-story-btn");
                const playerText = articleCard.querySelector(".sample-player-text")?.value || sample.players;
                if (storyButton) {
                    storyButton.addEventListener("click", () => openSampleStory(playerText));
                }

                sampleArticleIndex += 1;
            }

            if (youtubeUrlLabel) {
                youtubeUrlLabel.style.cursor = "pointer";
                youtubeUrlLabel.title = "Click to add a sample article card";
                youtubeUrlLabel.addEventListener("click", appendSampleArticleCard);
            }

            const storyAccentColorSelect = document.getElementById("storyAccentColorSelect");
            storyAccentColorSelect?.addEventListener("change", (event) => {
                storyApplyAccentColor(event.target.value || STORY_ALT_COLOR_DEFAULT);
            });

            document.getElementById("storyFontSize")?.addEventListener("input", (event) => {
                storyFontSizeOverride = true;
                const value = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(value)) {
                    updateSavedArticle(activeStoryCardIndex, "storyFontSize", value);
                    const fontSizeOut = document.getElementById("storyFontOut");
                    if (fontSizeOut) {
                        fontSizeOut.textContent = String(value);
                    }
                }
                renderStoryPreview();
            });
            document.getElementById("storyTextInput").addEventListener("input", () => {
                storyFontSizeOverride = false;
                activeStoryBaseText = removeStorySuffix(document.getElementById("storyTextInput").value);
                syncStoryTextInputToSavedArticle();
                renderStoryPreview();
            });

            document.getElementById("linastoryCopyMode")?.addEventListener("change", () => {
                updateLinastoryCopyButtonStatus();
                scheduleLinastoryAutoMatch(300);
                setLinastoryPasteButtonState("default");
            });
            document.getElementById("linastorySheetModeCheck")?.addEventListener("change", updateLinastoryCopyButtonStatus);
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) scheduleLinastoryAutoMatch(300);
            });
            window.addEventListener("storage", (event) => {
                if (event.key === "saved_articles") scheduleLinastoryAutoMatch(300);
            });

            setTimeout(() => refreshLinastoryMatchStatus(), 500);
            setInterval(() => {
                if (!document.hidden) refreshLinastoryMatchStatus();
            }, 5000);

            function toggleView() {
                const editor = document.getElementById("editorContainer");
                const preview = document.getElementById("previewContainer");
                const btn = document.getElementById("textModeBtn");
                const resTitle = document.getElementById("resultTitle");

                const titleInputs = document.querySelectorAll("input.flex-1.border");
                const contentAreas = document.querySelectorAll("textarea.w-full.min-h-52");

                if (editor.style.display !== "none") {
                    editor.style.display = "none";
                    preview.style.display = "block";

                    let fullPreview = "";
                    for (let i = 0; i < titleInputs.length; i++) {
                        const title = titleInputs[i].value;
                        const content = contentAreas[i].value;
                        fullPreview += `<h2>${title}</h2>` + content;
                        if (i < titleInputs.length - 1) {
                            fullPreview += "<hr>";
                        }
                    }

                    preview.innerHTML = fullPreview || "<p style='text-align:center; color:gray;'>No content to preview</p>";
                    btn.classList.add("view-toggle-active");
                    resTitle.innerText = "✨ Visual Preview Mode";
                } else {
                    editor.style.display = "block";
                    preview.style.display = "none";
                    btn.classList.remove("view-toggle-active");
                    resTitle.innerText = "✅ HTML Editor Mode";
                }
            }
