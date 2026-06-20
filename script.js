const BASE_QUERY = "(#ルーシュカ OR ルーシュカ)";
const SETTINGS_COOKIE_KEY = "rushka_x_search_settings";
const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const elements = {
    enableDateRange: document.getElementById("enableDateRange"),
    dateRangeWrap: document.getElementById("dateRangeWrap"),
    dateRange: document.getElementById("dateRange"),
    mediaOnly: document.getElementById("mediaOnly"),
    excludeQuote: document.getElementById("excludeQuote"),
    excludeRetweet: document.getElementById("excludeRetweet"),
    excludeReplies: document.getElementById("excludeReplies"),
    enableExcludeUsers: document.getElementById("enableExcludeUsers"),
    excludeUsersWrap: document.getElementById("excludeUsersWrap"),
    excludeUsers: document.getElementById("excludeUsers"),
    queryOutput: document.getElementById("queryOutput"),
    copyButton: document.getElementById("copyButton"),
    copyStatus: document.getElementById("copyStatus"),
    openXLink: document.getElementById("openXLink")
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
        enableDateRange: elements.enableDateRange.checked,
        dateRange: elements.dateRange.value,
        mediaOnly: elements.mediaOnly.checked,
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
        elements.enableDateRange.checked = settings.enableDateRange !== false;
        elements.dateRange.value = typeof settings.dateRange === "string" ? settings.dateRange : elements.dateRange.value;
        elements.mediaOnly.checked = Boolean(settings.mediaOnly);
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

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getSinceDateValue(rangeKey) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeDate = new Date(today);

    switch (rangeKey) {
        case "1d":
            rangeDate.setDate(rangeDate.getDate() - 1);
            break;
        case "3d":
            rangeDate.setDate(rangeDate.getDate() - 3);
            break;
        case "7d":
            rangeDate.setDate(rangeDate.getDate() - 7);
            break;
        case "14d":
            rangeDate.setDate(rangeDate.getDate() - 14);
            break;
        case "1m":
            rangeDate.setMonth(rangeDate.getMonth() - 1);
            break;
        case "2m":
            rangeDate.setMonth(rangeDate.getMonth() - 2);
            break;
        default:
            return "";
    }

    return formatDate(rangeDate);
}

function buildQuery() {
    const parts = [BASE_QUERY];
    const sinceDate = elements.enableDateRange.checked ? getSinceDateValue(elements.dateRange.value) : "";

    if (elements.mediaOnly.checked) parts.push("filter:media");
    if (elements.excludeQuote.checked) parts.push("-filter:quote");
    if (elements.excludeRetweet.checked) parts.push("-filter:retweet");
    if (elements.excludeReplies.checked) parts.push("-filter:replies");

    if (elements.enableExcludeUsers.checked) {
        const usernames = elements.excludeUsers.value
            .split(/\s+/)
            .map(sanitizeUsername)
            .filter(Boolean);

        usernames.forEach((user) => {
            parts.push(`-from:${user}`);
        });
    }

    if (sinceDate) parts.push(`since:${sinceDate}`);

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
    elements.dateRange.disabled = !enabled;
    elements.dateRangeWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.dateRangeWrap.classList.toggle("disabled", !enabled);
}

function updateOutput() {
    const query = buildQuery();
    elements.queryOutput.value = query;

    const xUrl = new URL("https://x.com/search");
    xUrl.searchParams.set("q", query);
    xUrl.searchParams.set("f", "live");
    elements.openXLink.href = xUrl.toString();
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

[
    elements.enableDateRange,
    elements.dateRange,
    elements.mediaOnly,
    elements.excludeQuote,
    elements.excludeRetweet,
    elements.excludeReplies,
    elements.enableExcludeUsers
].forEach((checkbox) => checkbox.addEventListener("change", updateOutput));

elements.enableDateRange.addEventListener("change", updateDateRangeState);
elements.enableExcludeUsers.addEventListener("change", updateExcludeUsersState);

elements.excludeUsers.addEventListener("input", updateOutput);
elements.copyButton.addEventListener("click", copyQuery);
elements.openXLink.addEventListener("click", saveSettingsToCookie);

restoreSettingsFromCookie();
updateDateRangeState();
updateExcludeUsersState();
updateOutput();