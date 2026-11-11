// 引用符と括弧の中を保ったまま、最上位の空白だけで区切る。
function splitSearchQuery(query) {
    const tokens = [];
    let token = "";
    let depth = 0;
    let quoted = false;
    let escaped = false;

    for (const character of query) {
        if (escaped) {
            token += character;
            escaped = false;
            continue;
        }
        if (character === "\\") {
            token += character;
            escaped = true;
            continue;
        }
        if (character === '"') quoted = !quoted;
        if (!quoted) {
            if (character === "(") depth++;
            if (character === ")") depth--;
            if (depth < 0) throw new Error("括弧の対応を確認してください。");
            if (/\s/.test(character) && depth === 0) {
                if (token) tokens.push(token);
                token = "";
                continue;
            }
        }
        token += character;
    }
    if (quoted) throw new Error("ダブルクォーテーションを閉じてください。");
    if (depth !== 0) throw new Error("括弧の対応を確認してください。");
    if (token) tokens.push(token);
    return tokens;
}

function parseSearchQuery(query) {
    const tokens = splitSearchQuery(query.trim());
    if (!tokens.length) throw new Error("復元する検索式を入力してください。");
    const settings = { searchTerms: "", dateMode: "fixed", sinceDate: "", untilDate: "" };

    // 最上位の論理演算をまたいで条件を移すと、適用範囲が変わるため式全体を残す。
    if (tokens.some((token) => /^(OR|AND|NOT)$/.test(token))) {
        settings.searchTerms = tokens.join(" ");
        return settings;
    }

    const flags = new Map([
        ["filter:media", "mediaOnly"],
        ["filter:follows", "followsOnly"],
        ["-filter:quote", "excludeQuote"],
        ["-filter:retweet", "excludeRetweet"],
        ["-filter:replies", "excludeReplies"]
    ]);
    const remaining = [];
    const excludedUsers = [];
    const excludedKeywords = [];
    const userFilter = /^from:@?([a-zA-Z0-9_]+)$/;
    const userGroup = /^\(\s*from:@?[a-zA-Z0-9_]+(?:\s+OR\s+from:@?[a-zA-Z0-9_]+)+\s*\)$/;
    const includeTokens = tokens.filter((token) => userFilter.test(token) || userGroup.test(token));
    const countPrefix = (prefix) => tokens.filter((token) => token.startsWith(prefix)).length;
    const validDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };

    for (const token of tokens) {
        if (flags.has(token)) {
            settings[flags.get(token)] = true;
            continue;
        }
        if (/^min_faves:\d+$/.test(token) && countPrefix("min_faves:") === 1) {
            const value = token.slice("min_faves:".length);
            if (Number.isSafeInteger(Number(value))) {
                settings.minimumLikes = value;
                continue;
            }
        }
        // 複数の独立した from: を OR のユーザー欄へまとめない。
        if (includeTokens.length === 1 && token === includeTokens[0]) {
            settings.enableIncludeUsers = true;
            settings.includeUsers = userFilter.test(token)
                ? userFilter.exec(token)[1]
                : token.slice(1, -1).trim().split(/\s+OR\s+/).map((part) => userFilter.exec(part)[1]).join(" ");
            continue;
        }
        const excludedUser = /^-from:@?([a-zA-Z0-9_]+)$/.exec(token);
        if (excludedUser) {
            excludedUsers.push(excludedUser[1]);
            continue;
        }
        // フレーズ除外や未知の演算子は、既存の除外語欄では表せないため残す。
        if (/^-[^\s\-:"()\\]+$/.test(token)) {
            excludedKeywords.push(token.slice(1));
            continue;
        }
        const date = /^(since|until):(.+)$/.exec(token);
        if (date && countPrefix(`${date[1]}:`) === 1 && validDate(date[2])) {
            settings[date[1] === "since" ? "sinceDate" : "untilDate"] = date[2];
            continue;
        }
        remaining.push(token);
    }

    if (settings.sinceDate && settings.untilDate && settings.sinceDate >= settings.untilDate) {
        throw new Error("until: は since: より後の日付を指定してください（until: 当日は検索対象に含まれません）。");
    }
    settings.searchTerms = remaining.join(" ");
    settings.enableDateRange = Boolean(settings.sinceDate || settings.untilDate);
    settings.enableExcludeUsers = excludedUsers.length > 0;
    settings.excludeUsers = excludedUsers.join(" ");
    settings.enableExcludeKeywords = excludedKeywords.length > 0;
    settings.excludeKeywords = excludedKeywords.join("\n");
    return settings;
}

function hasTopLevelOr(query) {
    try {
        return splitSearchQuery(query).includes("OR");
    } catch {
        // 入力途中の式でも、従来どおり検索式のプレビューを続ける。
        return /\bOR\b/.test(query);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseSearchQuery, hasTopLevelOr };
}
