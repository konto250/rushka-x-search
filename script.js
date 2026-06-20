const BASE_QUERY = "(#ルーシュカ OR ルーシュカ)";

const elements = {
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

function sanitizeUsername(raw) {
    return raw.replace(/^@+/, "").trim();
}

function buildQuery() {
    const parts = [BASE_QUERY];

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

    return parts.join(" ");
}

function updateExcludeUsersState() {
    const enabled = elements.enableExcludeUsers.checked;
    elements.excludeUsers.disabled = !enabled;
    elements.excludeUsersWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
    elements.excludeUsersWrap.classList.toggle("disabled", !enabled);
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
    elements.mediaOnly,
    elements.excludeQuote,
    elements.excludeRetweet,
    elements.excludeReplies,
    elements.enableExcludeUsers
].forEach((checkbox) => checkbox.addEventListener("change", updateOutput));

elements.enableExcludeUsers.addEventListener("change", updateExcludeUsersState);

elements.excludeUsers.addEventListener("input", updateOutput);
elements.copyButton.addEventListener("click", copyQuery);

updateExcludeUsersState();
updateOutput();