const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSearchQuery, hasTopLevelOr } = require("../query-parser.js");

test("すべての対応条件をフォームの値へ復元する", () => {
    const settings = parseSearchQuery('猫 filter:media min_faves:100 filter:follows -filter:quote -filter:retweet -filter:replies (from:@alice OR from:bob) -from:@carol -from:dave -犬 -広告 since:2026-11-01 until:2026-11-11');
    assert.deepEqual(settings, {
        searchTerms: "猫", dateMode: "fixed", sinceDate: "2026-11-01", untilDate: "2026-11-11",
        mediaOnly: true, minimumLikes: "100", followsOnly: true,
        excludeQuote: true, excludeRetweet: true, excludeReplies: true,
        enableIncludeUsers: true, includeUsers: "alice bob",
        enableDateRange: true, enableExcludeUsers: true, excludeUsers: "carol dave",
        enableExcludeKeywords: true, excludeKeywords: "犬\n広告"
    });
});

test("引用符・入れ子・未知の演算子・フレーズ除外を変更しない", () => {
    const terms = '"filter:media from:alice" (猫 OR (犬 filter:media)) -"黒い 猫" lang:ja -filter:links';
    const settings = parseSearchQuery(`${terms} filter:follows`);
    assert.equal(settings.searchTerms, terms);
    assert.equal(settings.mediaOnly, undefined);
    assert.equal(settings.followsOnly, true);
    assert.equal(settings.enableExcludeKeywords, false);
});

test("最上位の論理演算がある場合は式全体を保持する", () => {
    for (const operator of ["OR", "AND", "NOT"]) {
        const query = `猫 ${operator} 犬 filter:media from:alice`;
        assert.equal(parseSearchQuery(query).searchTerms, query);
        assert.equal(parseSearchQuery(query).mediaOnly, undefined);
    }
});

test("複数の独立した対象ユーザーを OR に変換しない", () => {
    for (const query of ["from:alice from:bob", "(from:alice OR from:bob) from:carol"]) {
        const settings = parseSearchQuery(query);
        assert.equal(settings.searchTerms, query);
        assert.equal(settings.enableIncludeUsers, undefined);
    }
    assert.equal(parseSearchQuery("from:@alice").includeUsers, "alice");
    assert.equal(parseSearchQuery("( from:alice OR from:@bob )").includeUsers, "alice bob");
});

test("重複した数値・日付条件と対応外の値を消さない", () => {
    for (const query of [
        "min_faves:10 min_faves:20", "since:2026-11-01 since:2026-11-02",
        "until:2026-11-03 until:2026-11-04", "min_faves:-1 min_faves:abc",
        "min_faves:9007199254740992", "since:2026-02-30", "until:2026-11-11_12:00:00_UTC"
    ]) assert.equal(parseSearchQuery(query).searchTerms, query);
    assert.equal(parseSearchQuery("min_faves:0").minimumLikes, "0");
});

test("片側だけの日付とうるう日を保持する", () => {
    assert.equal(parseSearchQuery("since:2024-02-29").sinceDate, "2024-02-29");
    const settings = parseSearchQuery("until:2026-11-11");
    assert.equal(settings.untilDate, "2026-11-11");
    assert.equal(settings.sinceDate, "");
    assert.equal(settings.enableDateRange, true);
});

test("空欄・不完全な式・逆転した日付を拒否する", () => {
    for (const query of ["", " \n ", '"猫', "(猫", "猫)", "猫 )(犬", "since:2026-11-11 until:2026-11-11", "since:2026-11-12 until:2026-11-11"]) {
        assert.throws(() => parseSearchQuery(query));
    }
});

test("改行区切りと引用符のエスケープを扱う", () => {
    const settings = parseSearchQuery('"猫 \\"犬\\""\nfilter:media\t-from:alice');
    assert.equal(settings.searchTerms, '"猫 \\"犬\\""');
    assert.equal(settings.mediaOnly, true);
    assert.equal(settings.excludeUsers, "alice");
});

test("括弧や引用符内の OR に余分な括弧を重ねない", () => {
    assert.equal(hasTopLevelOr("猫 OR 犬"), true);
    assert.equal(hasTopLevelOr("(猫 OR 犬)"), false);
    assert.equal(hasTopLevelOr('"猫 OR 犬"'), false);
    assert.equal(hasTopLevelOr("(猫 OR 犬"), true);
});
