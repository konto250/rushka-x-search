const SETTINGS_COOKIE_KEY = "rushka_x_search_settings";
const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const elements = {
    searchTerms: document.getElementById("searchTerms"),
    enableDateRange: document.getElementById("enableDateRange"),
    dateRangeWrap: document.getElementById("dateRangeWrap"),
    sinceDate: document.getElementById("sinceDate"),
    untilDate: document.getElementById("untilDate"),
    openSinceCalendar: document.getElementById("openSinceCalendar"),
    openUntilCalendar: document.getElementById("openUntilCalendar"),
    mediaOnly: document.getElementById("mediaOnly"),
    followsOnly: document.getElementById("followsOnly"),
    excludeQuote: document.getElementById("excludeQuote"),
    excludeRetweet: document.getElementById("excludeRetweet"),
    excludeReplies: document.getElementById("excludeReplies"),
    enableExcludeUsers: document.getElementById("enableExcludeUsers"),
    excludeUsersWrap: document.getElementById("excludeUsersWrap"),
    excludeUsers: document.getElementById("excludeUsers"),
    queryOutput: document.getElementById("queryOutput"),
    validationStatus: document.getElementById("validationStatus"),
    copyButton: document.getElementById("copyButton"),
    copyStatus: document.getElementById("copyStatus"),
    openXLink: document.getElementById("openXLink"),
    bookmarkletLink: document.getElementById("bookmarkletLink"),
    bookmarkletOutput: document.getElementById("bookmarkletOutput"),
    copyBookmarkletButton: document.getElementById("copyBookmarkletButton"),
    bookmarkletStatus: document.getElementById("bookmarkletStatus")
};

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
        sinceDate: elements.sinceDate.value,
        untilDate: elements.untilDate.value,
        mediaOnly: elements.mediaOnly.checked,
        followsOnly: elements.followsOnly.checked,
        excludeQuote: elements.excludeQuote.checked,
        excludeRetweet: elements.excludeRetweet.checked,
        excludeReplies: elements.excludeReplies.checked,
        enableExcludeUsers: elements.enableExcludeUsers.checked,
        excludeUsers: elements.excludeUsers.value
    };
}

function saveSettingsToCookie() {
    const settings = collectSettings();
    setCookie(SETTINGS_COOKIE_KEY, JSON.stringify(settings), SETTINGS_COOKIE_MAX_AGE);
}

function restoreSettingsFromCookie() {
    const raw = getCookie(SETTINGS_COOKIE_KEY);
    if (!raw) return;

    try {
        const settings = JSON.parse(raw);
        elements.searchTerms.value = typeof settings.searchTerms === "string" ? settings.searchTerms : "";
        elements.enableDateRange.checked = Boolean(settings.enableDateRange && ("sinceDate" in settings || "untilDate" in settings));
        elements.sinceDate.value = typeof settings.sinceDate === "string" ? settings.sinceDate : "";
        elements.untilDate.value = typeof settings.untilDate === "string" ? settings.untilDate : "";
        elements.mediaOnly.checked = Boolean(settings.mediaOnly);
        elements.followsOnly.checked = Boolean(settings.followsOnly);
        elements.excludeQuote.checked = Boolean(settings.excludeQuote);
        elements.excludeRetweet.checked = Boolean(settings.excludeRetweet);
        elements.excludeReplies.checked = Boolean(settings.excludeReplies);
        elements.enableExcludeUsers.checked = Boolean(settings.enableExcludeUsers);
        elements.excludeUsers.value = typeof settings.excludeUsers === "string" ? settings.excludeUsers : "";
    } catch {
        // Cookie may be manually edited or from an old format; ignore and continue.
    }
}

function sanitizeUsername(raw) {
    return raw.replace(/^@+/, "").trim();
}

function buildQuery() {
    const parts = [];
    const searchTerms = elements.searchTerms.value.trim();
    if (searchTerms) parts.push(searchTerms);

    if (elements.mediaOnly.checked) parts.push("filter:media");
    if (elements.followsOnly.checked) parts.push("filter:follows");
    if (elements.excludeQuote.checked) parts.push("-filter:quote");
    if (elements.excludeRetweet.checked) parts.push("-filter:retweet");
    if (elements.excludeReplies.checked) parts.push("-filter:replies");

    if (elements.enableExcludeUsers.checked) {
        const usernames = elements.excludeUsers.value
            .split(/\s+/)
            .map(sanitizeUsername)
            .filter(Boolean);

        usernames.forEach((user) => {
            parts.push(`-from:@${user}`);
        });
    }

    if (elements.enableDateRange.checked) {
        if (elements.sinceDate.value) parts.push(`since:${elements.sinceDate.value}`);
        if (elements.untilDate.value) parts.push(`until:${elements.untilDate.value}`);
    }

    return parts.join(" ");
}

function updateExcludeUsersState() {
    const enabled = elements.enableExcludeUsers.checked;
    elements.excludeUsers.disabled = !enabled;
    elements.excludeUsersWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.excludeUsersWrap.classList.toggle("disabled", !enabled);
}

function updateDateRangeState() {
    const enabled = elements.enableDateRange.checked;
    elements.sinceDate.disabled = !enabled;
    elements.untilDate.disabled = !enabled;
    elements.openSinceCalendar.disabled = !enabled;
    elements.openUntilCalendar.disabled = !enabled;
    elements.dateRangeWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.dateRangeWrap.classList.toggle("disabled", !enabled);
}

function updateOutput() {
    const query = buildQuery();
    elements.queryOutput.value = query;
    const since = elements.sinceDate.value;
    const until = elements.untilDate.value;
    const invalidRange = elements.enableDateRange.checked && since && until && since >= until;
    elements.validationStatus.textContent = invalidRange ? "終了日は開始日より後の日付を指定してください。" : "";
    elements.copyButton.disabled = !query || invalidRange;
    elements.copyBookmarkletButton.disabled = !query || invalidRange;
    elements.openXLink.classList.toggle("disabled", !query || invalidRange);
    elements.openXLink.setAttribute("aria-disabled", !query || invalidRange ? "true" : "false");
    elements.bookmarkletLink.classList.toggle("disabled", !query || invalidRange);
    elements.bookmarkletLink.setAttribute("aria-disabled", !query || invalidRange ? "true" : "false");

    const xUrl = new URL("https://x.com/search");
    xUrl.searchParams.set("q", query);
    xUrl.searchParams.set("f", "live");
    if (query && !invalidRange) {
        elements.openXLink.href = xUrl.toString();
        const bookmarklet = `javascript:(()=>{window.open(${JSON.stringify(xUrl.toString())},"_blank","noopener")})()`;
        elements.bookmarkletLink.href = bookmarklet;
        elements.bookmarkletOutput.value = bookmarklet;
    } else {
        elements.openXLink.removeAttribute("href");
        elements.bookmarkletLink.removeAttribute("href");
        elements.bookmarkletOutput.value = "";
    }
}

async function copyQuery() {
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

function openCalendar(input) {
    if (typeof input.showPicker === "function") {
        try {
            input.showPicker();
            return;
        } catch {
            // Unsupported contexts can still use the date field directly.
        }
    }
    input.focus();
}

async function copyBookmarklet() {
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
    elements.sinceDate,
    elements.untilDate,
    elements.mediaOnly,
    elements.followsOnly,
    elements.excludeQuote,
    elements.excludeRetweet,
    elements.excludeReplies,
    elements.enableExcludeUsers
].forEach((checkbox) => checkbox.addEventListener("change", updateOutput));

elements.enableDateRange.addEventListener("change", updateDateRangeState);
elements.openSinceCalendar.addEventListener("click", () => openCalendar(elements.sinceDate));
elements.openUntilCalendar.addEventListener("click", () => openCalendar(elements.untilDate));
elements.enableExcludeUsers.addEventListener("change", updateExcludeUsersState);

elements.searchTerms.addEventListener("input", updateOutput);
elements.excludeUsers.addEventListener("input", updateOutput);
elements.copyButton.addEventListener("click", copyQuery);
elements.copyBookmarkletButton.addEventListener("click", copyBookmarklet);
elements.openXLink.addEventListener("click", saveSettingsToCookie);
elements.bookmarkletLink.addEventListener("click", saveSettingsToCookie);

restoreSettingsFromCookie();
updateDateRangeState();
updateExcludeUsersState();
updateOutput();
