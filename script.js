const SETTINGS_COOKIE_KEY = "rushka_x_search_settings";
const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const HISTORY_STORAGE_KEY = "x_search_history";
const HISTORY_LIMIT = 5;

const elements = {
    searchTerms: document.getElementById("searchTerms"),
    enableDateRange: document.getElementById("enableDateRange"),
    dateRangeWrap: document.getElementById("dateRangeWrap"),
    dateMode: document.getElementById("dateMode"),
    fixedDateWrap: document.getElementById("fixedDateWrap"),
    relativeDateWrap: document.getElementById("relativeDateWrap"),
    relativeDays: document.getElementById("relativeDays"),
    relativeDateSummary: document.getElementById("relativeDateSummary"),
    sinceDate: document.getElementById("sinceDate"),
    untilDate: document.getElementById("untilDate"),
    previousMonth: document.getElementById("previousMonth"),
    nextMonth: document.getElementById("nextMonth"),
    calendarMonthLabel: document.getElementById("calendarMonthLabel"),
    calendarGrid: document.getElementById("calendarGrid"),
    selectedDateRange: document.getElementById("selectedDateRange"),
    clearDateRange: document.getElementById("clearDateRange"),
    mediaOnly: document.getElementById("mediaOnly"),
    followsOnly: document.getElementById("followsOnly"),
    excludeQuote: document.getElementById("excludeQuote"),
    excludeRetweet: document.getElementById("excludeRetweet"),
    excludeReplies: document.getElementById("excludeReplies"),
    enableIncludeUsers: document.getElementById("enableIncludeUsers"),
    includeUsersWrap: document.getElementById("includeUsersWrap"),
    includeUsers: document.getElementById("includeUsers"),
    enableExcludeUsers: document.getElementById("enableExcludeUsers"),
    excludeUsersWrap: document.getElementById("excludeUsersWrap"),
    excludeUsers: document.getElementById("excludeUsers"),
    enableExcludeKeywords: document.getElementById("enableExcludeKeywords"),
    excludeKeywordsWrap: document.getElementById("excludeKeywordsWrap"),
    excludeKeywords: document.getElementById("excludeKeywords"),
    queryOutput: document.getElementById("queryOutput"),
    validationStatus: document.getElementById("validationStatus"),
    copyButton: document.getElementById("copyButton"),
    copyStatus: document.getElementById("copyStatus"),
    openXLink: document.getElementById("openXLink"),
    historyList: document.getElementById("historyList"),
    historyStatus: document.getElementById("historyStatus"),
    bookmarkletLink: document.getElementById("bookmarkletLink"),
    bookmarkletOutput: document.getElementById("bookmarkletOutput"),
    copyBookmarkletButton: document.getElementById("copyBookmarkletButton"),
    bookmarkletStatus: document.getElementById("bookmarkletStatus")
};

let calendarMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
let pendingRangeStart = null;
let dragStart = null;
let dragEnd = null;
let dragPointerId = null;

function setCookie(name, value, maxAgeSeconds) {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
}

function getCookie(name) {
    const cookieName = `${name}=`;
    const cookies = document.cookie ? document.cookie.split("; ") : [];

    for (const cookie of cookies) {
        if (cookie.startsWith(cookieName)) {
            return decodeURIComponent(cookie.slice(cookieName.length));
        }
    }

    return null;
}

function collectSettings() {
    return {
        searchTerms: elements.searchTerms.value,
        enableDateRange: elements.enableDateRange.checked,
        dateMode: elements.dateMode.value,
        relativeDays: elements.relativeDays.value,
        sinceDate: elements.sinceDate.value,
        untilDate: elements.untilDate.value,
        mediaOnly: elements.mediaOnly.checked,
        followsOnly: elements.followsOnly.checked,
        excludeQuote: elements.excludeQuote.checked,
        excludeRetweet: elements.excludeRetweet.checked,
        excludeReplies: elements.excludeReplies.checked,
        enableIncludeUsers: elements.enableIncludeUsers.checked,
        includeUsers: elements.includeUsers.value,
        enableExcludeUsers: elements.enableExcludeUsers.checked,
        excludeUsers: elements.excludeUsers.value,
        enableExcludeKeywords: elements.enableExcludeKeywords.checked,
        excludeKeywords: elements.excludeKeywords.value
    };
}

function saveSettingsToCookie() {
    const settings = collectSettings();
    setCookie(SETTINGS_COOKIE_KEY, JSON.stringify(settings), SETTINGS_COOKIE_MAX_AGE);
}

function applySettings(settings) {
    if (!settings || typeof settings !== "object") return;
    elements.searchTerms.value = typeof settings.searchTerms === "string" ? settings.searchTerms : "";
    elements.enableDateRange.checked = Boolean(settings.enableDateRange && (settings.dateMode === "relative" || "sinceDate" in settings || "untilDate" in settings));
    elements.dateMode.value = settings.dateMode === "relative" ? "relative" : "fixed";
    elements.relativeDays.value = typeof settings.relativeDays === "string" ? settings.relativeDays : "7";
    elements.sinceDate.value = typeof settings.sinceDate === "string" ? settings.sinceDate : "";
    elements.untilDate.value = typeof settings.untilDate === "string" ? settings.untilDate : "";
    const shownDate = elements.sinceDate.value || (elements.untilDate.value ? addDays(elements.untilDate.value, -1) : "");
    if (shownDate) calendarMonth = monthFromDate(shownDate);
    pendingRangeStart = null;
    elements.mediaOnly.checked = Boolean(settings.mediaOnly);
    elements.followsOnly.checked = Boolean(settings.followsOnly);
    elements.excludeQuote.checked = Boolean(settings.excludeQuote);
    elements.excludeRetweet.checked = Boolean(settings.excludeRetweet);
    elements.excludeReplies.checked = Boolean(settings.excludeReplies);
    elements.enableIncludeUsers.checked = Boolean(settings.enableIncludeUsers);
    elements.includeUsers.value = typeof settings.includeUsers === "string" ? settings.includeUsers : "";
    elements.enableExcludeUsers.checked = Boolean(settings.enableExcludeUsers);
    elements.excludeUsers.value = typeof settings.excludeUsers === "string" ? settings.excludeUsers : "";
    elements.enableExcludeKeywords.checked = Boolean(settings.enableExcludeKeywords);
    elements.excludeKeywords.value = typeof settings.excludeKeywords === "string" ? settings.excludeKeywords : "";
}

function restoreSettingsFromCookie() {
    const raw = getCookie(SETTINGS_COOKIE_KEY);
    if (!raw) return;

    try {
        applySettings(JSON.parse(raw));
    } catch {
        // Cookie may be manually edited or from an old format; ignore and continue.
    }
}

function sanitizeUsername(raw) {
    return raw.replace(/^@+/, "").trim();
}

function parseUsernames(value) {
    return value.split(/\s+/).map(sanitizeUsername).filter(Boolean);
}

function excludedKeywordFilter(raw) {
    const keyword = raw.trim().replace(/^-(?=\S)/, "");
    if (!keyword) return "";
    if (/^"[^"]+"$/.test(keyword)) return `-${keyword}`;
    return /\s/.test(keyword) ? `-"${keyword}"` : `-${keyword}`;
}

function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addDays(value, count) {
    const date = parseDate(value);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
}

function formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRelativeDateRange(now = new Date()) {
    const days = Number(elements.relativeDays.value);
    if (!Number.isSafeInteger(days) || days < 1 || elements.relativeDays.value.trim() === "") return null;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    start.setDate(start.getDate() - days + 1);
    end.setDate(end.getDate() + 1);
    if (Number.isNaN(start.getTime()) || start.getFullYear() < 1) return null;
    return { since: formatLocalDate(start), until: formatLocalDate(end) };
}

function monthFromDate(value) {
    const date = parseDate(value);
    return date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : calendarMonth;
}

function renderCalendar() {
    const year = calendarMonth.getUTCFullYear();
    const month = calendarMonth.getUTCMonth();
    elements.calendarMonthLabel.textContent = `${year}年${month + 1}月`;
    elements.calendarGrid.replaceChildren();
    const firstWeekday = (calendarMonth.getUTCDay() + 6) % 7;
    const firstDay = new Date(Date.UTC(year, month, 1 - firstWeekday));
    for (let index = 0; index < 42; index++) {
        const date = new Date(firstDay);
        date.setUTCDate(firstDay.getUTCDate() + index);
        const value = date.toISOString().slice(0, 10);
        const day = document.createElement("button");
        day.type = "button";
        day.className = "calendar-day";
        day.dataset.date = value;
        day.textContent = String(date.getUTCDate());
        day.setAttribute("aria-label", `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`);
        day.classList.toggle("outside-month", date.getUTCMonth() !== month);
        day.disabled = !elements.enableDateRange.checked || elements.dateMode.value !== "fixed";
        elements.calendarGrid.append(day);
    }

    updateCalendarSelection();
}

function updateCalendarSelection() {
    const start = dragStart || pendingRangeStart || elements.sinceDate.value;
    const end = dragStart ? dragEnd : pendingRangeStart || addDays(elements.untilDate.value, -1);
    const low = start && end ? (start < end ? start : end) : start;
    const high = start && end ? (start > end ? start : end) : end;
    for (const day of elements.calendarGrid.children) {
        const value = day.dataset.date;
        const selected = Boolean(low && high && value >= low && value <= high);
        day.setAttribute("aria-pressed", selected ? "true" : "false");
        day.classList.toggle("in-range", selected);
        day.classList.toggle("range-edge", value === low || value === high);
    }
    const selectedStart = elements.sinceDate.value;
    const selectedEnd = addDays(elements.untilDate.value, -1);
    elements.selectedDateRange.textContent = pendingRangeStart
        ? `${pendingRangeStart} を開始日に選択中。終了日を選んでください。`
        : selectedStart && selectedEnd
            ? `選択期間: ${selectedStart} ～ ${selectedEnd}`
            : selectedStart || selectedEnd
                ? `選択期間: ${selectedStart || "開始日なし"} ～ ${selectedEnd || "終了日なし"}`
                : "期間を選択してください。";
}

function commitDateRange(start, end) {
    elements.sinceDate.value = start < end ? start : end;
    elements.untilDate.value = addDays(start > end ? start : end, 1);
    pendingRangeStart = null;
    dragStart = null;
    dragEnd = null;
    updateOutput();
    updateCalendarSelection();
}

function selectCalendarDate(value) {
    if (pendingRangeStart) {
        commitDateRange(pendingRangeStart, value);
    } else {
        commitDateRange(value, value);
        pendingRangeStart = value;
        updateCalendarSelection();
    }
}

function dateAtPointer(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const day = target?.closest?.("[data-date]");
    return day && elements.calendarGrid.contains(day) ? day.dataset.date : null;
}

function handleCalendarPointerMove(event) {
    if (dragPointerId !== event.pointerId) return;
    const value = dateAtPointer(event);
    if (value && value !== dragEnd) {
        dragEnd = value;
        updateCalendarSelection();
    }
}

function stopCalendarDrag() {
    dragPointerId = null;
    window.removeEventListener("pointermove", handleCalendarPointerMove);
    window.removeEventListener("pointerup", handleCalendarPointerUp);
    window.removeEventListener("pointercancel", handleCalendarPointerCancel);
}

function handleCalendarPointerUp(event) {
    if (dragPointerId !== event.pointerId) return;
    handleCalendarPointerMove(event);
    stopCalendarDrag();
    if (dragEnd !== dragStart) {
        commitDateRange(dragStart, dragEnd);
    } else {
        selectCalendarDate(dragStart);
    }
}

function handleCalendarPointerCancel(event) {
    if (dragPointerId !== event.pointerId) return;
    stopCalendarDrag();
    dragStart = null;
    dragEnd = null;
    updateCalendarSelection();
}

function handleCalendarPointerDown(event) {
    if (!elements.enableDateRange.checked || elements.dateMode.value !== "fixed" || dragPointerId !== null) return;
    const day = event.target.closest?.("[data-date]");
    if (!day || !elements.calendarGrid.contains(day)) return;
    event.preventDefault();
    dragPointerId = event.pointerId;
    dragStart = day.dataset.date;
    dragEnd = dragStart;
    updateCalendarSelection();
    window.addEventListener("pointermove", handleCalendarPointerMove);
    window.addEventListener("pointerup", handleCalendarPointerUp);
    window.addEventListener("pointercancel", handleCalendarPointerCancel);
}

function buildQuery(includeDate = true, now = new Date()) {
    const parts = [];
    const searchTerms = elements.searchTerms.value.trim();
    if (searchTerms) {
        const hasScopedFilters = elements.enableIncludeUsers.checked || (elements.enableExcludeKeywords.checked && elements.excludeKeywords.value.trim()) || elements.enableDateRange.checked;
        const needsGrouping = hasScopedFilters && /\bOR\b/.test(searchTerms);
        parts.push(needsGrouping ? `(${searchTerms})` : searchTerms);
    }

    if (elements.mediaOnly.checked) parts.push("filter:media");
    if (elements.followsOnly.checked) parts.push("filter:follows");
    if (elements.excludeQuote.checked) parts.push("-filter:quote");
    if (elements.excludeRetweet.checked) parts.push("-filter:retweet");
    if (elements.excludeReplies.checked) parts.push("-filter:replies");

    if (elements.enableIncludeUsers.checked) {
        const usernames = parseUsernames(elements.includeUsers.value);
        const filters = usernames.map((user) => `from:@${user}`);
        if (filters.length === 1) parts.push(filters[0]);
        if (filters.length > 1) parts.push(`(${filters.join(" OR ")})`);
    }

    if (elements.enableExcludeUsers.checked) {
        const usernames = parseUsernames(elements.excludeUsers.value);

        usernames.forEach((user) => {
            parts.push(`-from:@${user}`);
        });
    }

    if (elements.enableExcludeKeywords.checked) {
        elements.excludeKeywords.value
            .split(/\r?\n/)
            .map(excludedKeywordFilter)
            .filter(Boolean)
            .forEach((filter) => parts.push(filter));
    }

    if (includeDate && elements.enableDateRange.checked) {
        const dates = elements.dateMode.value === "relative" ? getRelativeDateRange(now) : { since: elements.sinceDate.value, until: elements.untilDate.value };
        if (dates?.since) parts.push(`since:${dates.since}`);
        if (dates?.until) parts.push(`until:${dates.until}`);
    }

    return parts.join(" ");
}

function updateExcludeUsersState() {
    const enabled = elements.enableExcludeUsers.checked;
    elements.excludeUsers.disabled = !enabled;
    elements.excludeUsersWrap.hidden = !enabled;
    elements.excludeUsersWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.excludeUsersWrap.classList.toggle("disabled", !enabled);
}

function updateDateRangeState() {
    const enabled = elements.enableDateRange.checked;
    const fixed = elements.dateMode.value === "fixed";
    if ((!enabled || !fixed) && dragPointerId !== null) {
        stopCalendarDrag();
        dragStart = null;
        dragEnd = null;
    }
    if (!enabled || !fixed) pendingRangeStart = null;
    elements.dateMode.disabled = !enabled;
    elements.fixedDateWrap.hidden = !fixed;
    elements.relativeDateWrap.hidden = fixed;
    elements.relativeDays.disabled = !enabled || fixed;
    elements.previousMonth.disabled = !enabled || !fixed;
    elements.nextMonth.disabled = !enabled || !fixed;
    elements.clearDateRange.disabled = !enabled || !fixed;
    elements.dateRangeWrap.hidden = !enabled;
    elements.dateRangeWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.dateRangeWrap.classList.toggle("disabled", !enabled);
    renderCalendar();
}

function updateExcludeKeywordsState() {
    const enabled = elements.enableExcludeKeywords.checked;
    elements.excludeKeywords.disabled = !enabled;
    elements.excludeKeywordsWrap.hidden = !enabled;
    elements.excludeKeywordsWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.excludeKeywordsWrap.classList.toggle("disabled", !enabled);
}

function buildBookmarklet(xUrl) {
    if (!elements.enableDateRange.checked || elements.dateMode.value !== "relative") {
        return `javascript:(()=>{window.open(${JSON.stringify(xUrl)},"_blank","noopener")})()`;
    }

    const baseQuery = JSON.stringify(buildQuery(false));
    const daysBeforeToday = Number(elements.relativeDays.value) - 1;
    return `javascript:(()=>{const t=new Date();t.setHours(0,0,0,0);const s=new Date(t);s.setDate(s.getDate()-${daysBeforeToday});const u=new Date(t);u.setDate(u.getDate()+1);const f=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");const q=[${baseQuery},"since:"+f(s),"until:"+f(u)].filter(Boolean).join(" ");const x=new URL("https://x.com/search");x.searchParams.set("q",q);x.searchParams.set("f","live");window.open(x.toString(),"_blank","noopener")})()`;
}

function updateOutput() {
    const now = new Date();
    const relative = elements.enableDateRange.checked && elements.dateMode.value === "relative";
    const relativeDates = relative ? getRelativeDateRange(now) : null;
    elements.relativeDateSummary.textContent = relativeDates
        ? `現在の検索期間: ${relativeDates.since} ～ ${addDays(relativeDates.until, -1)}`
        : "";
    const query = buildQuery(true, now);
    elements.queryOutput.value = query;
    const since = elements.sinceDate.value;
    const until = elements.untilDate.value;
    const invalidRange = elements.enableDateRange.checked && !relative && since && until && since >= until;
    const invalidRelativeDays = relative && !relativeDates;
    const missingIncludeUsers = elements.enableIncludeUsers.checked && parseUsernames(elements.includeUsers.value).length === 0;
    const invalid = !query || invalidRange || missingIncludeUsers || invalidRelativeDays;
    elements.validationStatus.textContent = [
        missingIncludeUsers ? "対象ユーザーを入力してください。" : "",
        invalidRange ? "終了日は開始日より後の日付を指定してください。" : "",
        invalidRelativeDays ? "過去の日数は有効な正の整数で指定してください。" : ""
    ].filter(Boolean).join(" ");
    elements.copyButton.disabled = invalid;
    elements.copyBookmarkletButton.disabled = invalid;
    elements.openXLink.classList.toggle("disabled", invalid);
    elements.openXLink.setAttribute("aria-disabled", invalid ? "true" : "false");
    elements.bookmarkletLink.classList.toggle("disabled", invalid);
    elements.bookmarkletLink.setAttribute("aria-disabled", invalid ? "true" : "false");

    const xUrl = new URL("https://x.com/search");
    xUrl.searchParams.set("q", query);
    xUrl.searchParams.set("f", "live");
    if (!invalid) {
        elements.openXLink.href = xUrl.toString();
        const bookmarklet = buildBookmarklet(xUrl.toString());
        elements.bookmarkletLink.href = bookmarklet;
        elements.bookmarkletOutput.value = bookmarklet;
    } else {
        elements.openXLink.removeAttribute("href");
        elements.bookmarkletLink.removeAttribute("href");
        elements.bookmarkletOutput.value = "";
    }
}

async function copyQuery() {
    updateOutput();
    if (elements.copyButton.disabled) return;
    saveSettingsToCookie();
    const query = elements.queryOutput.value;

    try {
        await navigator.clipboard.writeText(query);
        elements.copyStatus.textContent = "コピーしました。";
    } catch {
        elements.queryOutput.focus();
        elements.queryOutput.select();
        const ok = document.execCommand("copy");
        elements.copyStatus.textContent = ok ? "コピーしました。" : "コピーに失敗しました。手動でコピーしてください。";
    }

    window.setTimeout(() => {
        elements.copyStatus.textContent = "";
    }, 1800);
}

function readHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
        if (!Array.isArray(saved)) return [];
        return saved.filter((entry) => {
            if (!entry || typeof entry.query !== "string" || typeof entry.url !== "string" || !entry.settings || typeof entry.settings !== "object") return false;
            try {
                const url = new URL(entry.url);
                return url.origin === "https://x.com" && url.pathname === "/search" && url.searchParams.get("q") === entry.query && url.searchParams.get("f") === "live";
            } catch {
                return false;
            }
        }).slice(0, HISTORY_LIMIT);
    } catch {
        return [];
    }
}

function renderHistory() {
    elements.historyList.replaceChildren();
    const history = readHistory();
    if (history.length === 0) {
        const empty = document.createElement("li");
        empty.className = "history-empty";
        empty.textContent = "保存された検索条件はありません。";
        elements.historyList.append(empty);
        return;
    }

    history.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "history-item";
        const query = document.createElement("code");
        query.className = "history-query";
        query.textContent = entry.query;
        const actions = document.createElement("div");
        actions.className = "history-actions";
        const link = document.createElement("a");
        link.href = entry.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Xで開く";
        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.textContent = "条件を再展開";
        restoreButton.addEventListener("click", () => {
            applySettings(entry.settings);
            updateDateRangeState();
            updateIncludeUsersState();
            updateExcludeUsersState();
            updateExcludeKeywordsState();
            updateOutput();
            saveSettingsToCookie();
            elements.searchTerms.focus();
        });
        actions.append(link, restoreButton);
        item.append(query, actions);
        elements.historyList.append(item);
    });
}

function saveSearchHistory() {
    if (elements.copyButton.disabled) return;
    const entry = {
        settings: collectSettings(),
        query: elements.queryOutput.value,
        url: elements.openXLink.href
    };
    const history = [entry, ...readHistory().filter((saved) => saved.query !== entry.query)].slice(0, HISTORY_LIMIT);
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        elements.historyStatus.textContent = "検索条件を履歴に保存しました。";
        renderHistory();
    } catch {
        elements.historyStatus.textContent = "履歴を保存できませんでした。";
    }
}

function handleOpenXClick(event) {
    updateOutput();
    if (elements.copyButton.disabled) {
        event.preventDefault();
        return;
    }
    saveSettingsToCookie();
    saveSearchHistory();
}

function updateIncludeUsersState() {
    const enabled = elements.enableIncludeUsers.checked;
    elements.includeUsers.disabled = !enabled;
    elements.includeUsersWrap.hidden = !enabled;
    elements.includeUsersWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.includeUsersWrap.classList.toggle("disabled", !enabled);
}

async function copyBookmarklet() {
    updateOutput();
    if (elements.copyBookmarkletButton.disabled) return;
    saveSettingsToCookie();
    const code = elements.bookmarkletOutput.value;
    try {
        await navigator.clipboard.writeText(code);
        elements.bookmarkletStatus.textContent = "コピーしました。";
    } catch {
        elements.bookmarkletOutput.focus();
        elements.bookmarkletOutput.select();
        const ok = document.execCommand("copy");
        elements.bookmarkletStatus.textContent = ok ? "コピーしました。" : "コピーに失敗しました。手動でコピーしてください。";
    }
    window.setTimeout(() => {
        elements.bookmarkletStatus.textContent = "";
    }, 1800);
}

[
    elements.enableDateRange,
    elements.mediaOnly,
    elements.followsOnly,
    elements.excludeQuote,
    elements.excludeRetweet,
    elements.excludeReplies,
    elements.enableIncludeUsers,
    elements.enableExcludeUsers,
    elements.enableExcludeKeywords
].forEach((checkbox) => checkbox.addEventListener("change", updateOutput));

elements.enableDateRange.addEventListener("change", updateDateRangeState);
elements.dateMode.addEventListener("change", () => {
    updateDateRangeState();
    updateOutput();
});
elements.relativeDays.addEventListener("input", updateOutput);
elements.previousMonth.addEventListener("click", () => {
    calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() - 1);
    renderCalendar();
});
elements.nextMonth.addEventListener("click", () => {
    calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() + 1);
    renderCalendar();
});
elements.clearDateRange.addEventListener("click", () => {
    elements.sinceDate.value = "";
    elements.untilDate.value = "";
    pendingRangeStart = null;
    updateOutput();
    renderCalendar();
});
elements.calendarGrid.addEventListener("pointerdown", handleCalendarPointerDown);
elements.calendarGrid.addEventListener("click", (event) => {
    if (event.detail !== 0 || !elements.enableDateRange.checked || elements.dateMode.value !== "fixed") return;
    const day = event.target.closest?.("[data-date]");
    if (day && elements.calendarGrid.contains(day)) selectCalendarDate(day.dataset.date);
});
elements.enableExcludeUsers.addEventListener("change", updateExcludeUsersState);
elements.enableExcludeKeywords.addEventListener("change", updateExcludeKeywordsState);
elements.enableIncludeUsers.addEventListener("change", updateIncludeUsersState);

elements.searchTerms.addEventListener("input", updateOutput);
elements.excludeUsers.addEventListener("input", updateOutput);
elements.includeUsers.addEventListener("input", updateOutput);
elements.excludeKeywords.addEventListener("input", updateOutput);
elements.copyButton.addEventListener("click", copyQuery);
elements.copyBookmarkletButton.addEventListener("click", copyBookmarklet);
elements.openXLink.addEventListener("click", handleOpenXClick);
elements.bookmarkletLink.addEventListener("click", saveSettingsToCookie);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateOutput();
});

restoreSettingsFromCookie();
updateDateRangeState();
updateExcludeUsersState();
updateExcludeKeywordsState();
updateIncludeUsersState();
updateOutput();
renderHistory();
