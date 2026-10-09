"""
Fixture-based tests for the news engine fixes (RC1–RC7 + v7 additions).

No network access anywhere: relevance scoring, dedup, cooldown
classification, negative cache, status/paging semantics, resolver identity,
router ordering, snapshot roundtrip.
"""
import os
import shutil
from datetime import datetime, timedelta, timezone

import pytest

from news_engine.company_resolver import resolve_company, get_search_queries, is_known_company
from news_engine.engine import (
    _score_relevance,
    _deduplicate_articles,
    _is_broken_snapshot,
    _effective_fresh_ttl,
    _snapshot_to_dict,
    _dict_to_snapshot,
    NEGATIVE_CACHE_SECONDS,
)
from news_engine.models import (
    NewsArticle,
    ArticleSentiment,
    SentimentSnapshot,
    SentimentStatus,
    SentimentLabel,
)
from news_engine.provider_router import (
    provider_router,
    PROVIDER_WATERFALL_PRIORITY,
    FREE_PROVIDERS,
    TARGET_NEWS_COUNT,
)
import news_engine.provider_budget as provider_budget


# ─── helpers ────────────────────────────────────────────────────────────────

def make_article(title, url="https://example.com/a1", publisher="Yahoo Finance",
                 description="", ticker="DELL", provider="yahoo_rss"):
    return NewsArticle(
        ticker=ticker, title=title, description=description, url=url,
        publisher=publisher, provider=provider,
        published_at="2026-10-08T12:00:00Z",
    )


def make_article_sentiment(i, publisher="Yahoo Finance", title=None):
    return ArticleSentiment(
        article_id=f"a{i}",
        title=title or f"Company news story number {i} about results",
        url=f"https://example.com/{i}",
        publisher=publisher,
        published_at="2026-10-08T12:00:00Z",
        relevance_score=0.8,
        finbert_label="neutral",
        finbert_positive=0.33,
        finbert_neutral=0.34,
        finbert_negative=0.33,
        confidence=0.7,
        source_type="aggregator",
    )


# ─── relevance scoring (RC3/RC4) ───────────────────────────────────────────

class TestRelevanceScoring:
    def test_title_mention_scores_above_threshold(self):
        company = resolve_company("DELL")
        a = make_article("Dell Technologies on track for strong AI server quarter")
        assert _score_relevance(a, company) >= 0.4

    def test_sector_junk_is_rejected(self):
        company = resolve_company("DELL")
        a = make_article(
            "Is AI giving airlines a lift?",
            description="Something about daily AI adoption across carriers and retail.",
        )
        assert _score_relevance(a, company) == 0.0

    def test_single_char_ticker_false_positive_rejected(self):
        company = resolve_company("T")
        a = make_article("The cat sat on the mat", description="That is the thing.",
                         ticker="T")
        assert _score_relevance(a, company) == 0.0

    def test_single_char_ticker_real_mention_scores(self):
        company = resolve_company("T")
        a = make_article("AT&T reports subscriber growth beat", ticker="T")
        assert _score_relevance(a, company) >= 0.4

    def test_no_double_count_with_entity_match(self):
        # Name text + entity match must not stack past the ceiling
        company = resolve_company("DELL")
        a = make_article(
            "Server rally lifts hardware makers as margins improve",
            description="Super Micro drops as profit taking unwinds the rally.",
        )
        a.matched_entities = ["Dell Technologies Inc."]
        a.entity_count = 2
        a.entity_match_score = 0.8
        score = _score_relevance(a, company)
        assert 0.15 < score < 0.75  # entity-only path, no text double count

    def test_irrelevant_article_scores_zero_for_citigroup(self):
        company = resolve_company("C")
        a = make_article("How to capture big returns in tech", ticker="C")
        assert _score_relevance(a, company) == 0.0


# ─── dedup (word-Jaccard fix) ──────────────────────────────────────────────

class TestDedup:
    def test_distinct_same_publisher_stories_survive(self):
        articles = [
            make_article("IBM enters DARPA testing phase for quantum computing",
                         url="https://yahoo.com/1"),
            make_article("IBM's valuation is getting interesting as AI rebounds",
                         url="https://yahoo.com/2"),
        ]
        reps = _deduplicate_articles(articles)
        assert len(reps) == 2  # char-Jaccard bug merged these before

    def test_near_identical_syndicated_titles_merge(self):
        articles = [
            make_article("Accenture and Dell Technologies expand collaboration",
                         url="https://a.com/1", publisher="Site A"),
            make_article("Accenture and Dell Technologies expand collaboration today",
                         url="https://b.com/2", publisher="Site B"),
        ]
        reps = _deduplicate_articles(articles)
        assert len(reps) == 1

    def test_exact_duplicate_merges(self):
        articles = [
            make_article("Dell unveils AI-ready PCs", url="https://x.com/1"),
            make_article("Dell unveils AI-ready PCs", url="https://x.com/1"),
        ]
        assert len(_deduplicate_articles(articles)) == 1

    def test_ten_real_stories_not_collapsed(self):
        articles = [
            make_article(
                t, url=f"https://yahoo.com/{i}"
            )
            for i, t in enumerate([
                "Zacks Investment Ideas feature highlights Microsoft Dell HP",
                "One overlooked AI stock that could surprise investors",
                "Super Micro drops 3 percent as profit taking unwinds",
                "Accenture and Dell Technologies expand collaboration",
                "Dell Technologies unveils AI-ready Windows PCs for creators",
                "Who is Susan Dell billionaire tech CEO wife goes viral",
                "Dell stock slips as server margins narrow",
                "Analysts raise Dell price target after strong quarter",
                "Dell launches new storage platform for enterprise",
            ])
        ]
        reps = _deduplicate_articles(articles)
        assert len(reps) >= 8


# ─── budget cooldown classification (RC1) ──────────────────────────────────

@pytest.fixture()
def temp_budget_db(monkeypatch, tmp_path):
    """Point the budget module at a throwaway DB with schema."""
    dst = tmp_path / "provider_budget.db"
    monkeypatch.setattr(provider_budget, "_DB_PATH", str(dst))
    provider_budget._init_budget_db()
    return str(dst)


def _read_cooldown(db_path, provider, date=None):
    import sqlite3
    date = date or provider_budget.budget_manager._today()
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT cooldown_until FROM provider_usage WHERE provider=? AND date=?",
        (provider, date),
    ).fetchone()
    conn.close()
    return row[0] if row else None


class TestCooldownClassification:
    def test_rate_limit_gets_short_cooldown_not_24h(self, temp_budget_db):
        provider_budget.budget_manager.record_failure(
            "gdelt",
            'HTTP 429 Please limit requests to one every 5 seconds or contact kalev',
        )
        cd = _read_cooldown(temp_budget_db, "gdelt")
        assert cd is not None
        cd_dt = datetime.fromisoformat(cd)
        now = datetime.now(timezone.utc)
        assert now <= cd_dt <= now + timedelta(minutes=5)
        # not a midnight-style daily cooldown
        assert not (cd_dt.hour == 0 and cd_dt.minute == 5)

    def test_daily_quota_cools_until_next_utc_midnight(self, temp_budget_db):
        provider_budget.budget_manager.record_failure(
            "currents",
            'HTTP 429 {"msg":"Daily quota exceeded. Upgrade your plan..."}',
        )
        cd = _read_cooldown(temp_budget_db, "currents")
        assert cd is not None
        cd_dt = datetime.fromisoformat(cd)
        now = datetime.now(timezone.utc)
        assert cd_dt.hour == 0 and cd_dt.minute == 5
        assert cd_dt.date() >= (now + timedelta(hours=1)).date()
        assert cd_dt <= now + timedelta(days=1)

    def test_plain_error_sets_no_cooldown(self, temp_budget_db):
        provider_budget.budget_manager.record_failure("rss", "connection reset by peer")
        assert _read_cooldown(temp_budget_db, "rss") in (None, "")

    def test_marketaux_empty_success_does_not_burn_ticker_cooldown(self, temp_budget_db):
        provider_budget.budget_manager.record_call(
            "marketaux", success=True, ticker="DELL",
            articles_returned=0, articles_selected=0,
        )
        import sqlite3
        conn = sqlite3.connect(temp_budget_db)
        row = conn.execute(
            "SELECT last_fetch_at FROM provider_ticker_cooldown WHERE provider='marketaux' AND ticker='DELL'"
        ).fetchone()
        conn.close()
        assert row is None


# ─── negative cache / broken snapshots (RC7) ──────────────────────────────

class TestNegativeCache:
    def _snap(self, n_articles, status):
        s = SentimentSnapshot(ticker="DELL")
        s.articles = [make_article_sentiment(i) for i in range(n_articles)]
        s.relevant_article_count = n_articles
        s.status = status
        return s

    def test_broken_snapshot_detected(self):
        assert _is_broken_snapshot(self._snap(1, SentimentStatus.INSUFFICIENT)) is True
        assert _is_broken_snapshot(self._snap(0, SentimentStatus.INSUFFICIENT)) is True
        assert _is_broken_snapshot(self._snap(9, SentimentStatus.SUFFICIENT)) is False

    def test_broken_snapshot_uses_short_negative_ttl(self):
        broken = self._snap(1, SentimentStatus.INSUFFICIENT)
        ttl = _effective_fresh_ttl("DELL", broken)
        assert ttl == NEGATIVE_CACHE_SECONDS

    def test_healthy_snapshot_uses_long_ttl(self):
        healthy = self._snap(9, SentimentStatus.SUFFICIENT)
        healthy.coverage_status = "FULL"
        ttl = _effective_fresh_ttl("DELL", healthy)
        assert ttl > NEGATIVE_CACHE_SECONDS


# ─── legacy dict paging + v7 fields ────────────────────────────────────────

class TestLegacyDict:
    def _snap(self, n):
        s = SentimentSnapshot(ticker="IBM", company_name="International Business Machines Corp.")
        s.status = SentimentStatus.SUFFICIENT
        s.label = SentimentLabel.NEUTRAL if hasattr(SentimentLabel, "NEUTRAL") else s.label
        s.score = 0.12
        s.articles = [make_article_sentiment(i) for i in range(n)]
        s.relevant_article_count = n
        s.source_count = 3
        s.coverage_status = "FULL"
        s.confidence = 0.62
        s.confidence_label = "medium"
        s.limited_evidence = n <= 1
        s.source_attributions = ["Yahoo Finance", "Marketaux"]
        return s

    def test_news_initially_capped_at_10(self):
        d = self._snap(20).to_legacy_dict()
        assert d["initial_count"] == 10
        assert len(d["news"]) == 10
        assert d["has_more_articles"] is True
        assert len(d["articles"]) == 20

    def test_no_has_more_when_few(self):
        d = self._snap(5).to_legacy_dict()
        assert d["has_more_articles"] is False
        assert len(d["news"]) == 5
        assert d["initial_count"] == 5

    def test_v7_fields_present(self):
        d = self._snap(9).to_legacy_dict()
        for key in ("confidence", "confidence_label", "limited_evidence",
                    "coverage_status", "source_attributions", "articles",
                    "initial_count", "has_more_articles", "company_name"):
            assert key in d, key
        assert d["source_attributions"] == ["Yahoo Finance", "Marketaux"]
        assert d["coverage_status"] == "FULL"

    def test_article_entries_carry_confidence(self):
        d = self._snap(3).to_legacy_dict()
        assert all("confidence" in a and "source_type" in a for a in d["news"])

    def test_snapshot_roundtrip_preserves_new_fields(self):
        s = self._snap(12)
        rt = _dict_to_snapshot(_snapshot_to_dict(s))
        assert rt.confidence == s.confidence
        assert rt.confidence_label == s.confidence_label
        assert rt.limited_evidence == s.limited_evidence
        assert rt.coverage_status == s.coverage_status
        assert rt.source_attributions == s.source_attributions
        assert len(rt.articles) == 12


# ─── identity resolver (RC3) ───────────────────────────────────────────────

class TestResolver:
    @pytest.mark.parametrize("ticker", ["DELL", "IBM", "AAPL", "C", "T", "MS", "PYPL", "ABNB", "TSM", "VZ"])
    def test_allowlist_symbols_known(self, ticker):
        assert is_known_company(ticker)

    def test_dell_queries_good(self):
        qs = get_search_queries(resolve_company("DELL"))
        assert any("dell" in q.lower() for q in qs)
        assert all(len(q.strip()) >= 2 for q in qs)
        assert len(qs) == len(set(qs)), "queries must be deduped"

    def test_amd_alias_is_full_name(self):
        c = resolve_company("AMD")
        assert c.canonical_name.lower().startswith("advanced micro devices")
        qs = get_search_queries(c)
        assert any("advanced micro devices" in q.lower() for q in qs)

    def test_unknown_ticker_not_in_db(self):
        assert not is_known_company("ZZZZX")


# ─── router ordering / stop rules ──────────────────────────────────────────

class TestRouter:
    def test_free_ranks_before_scarce(self):
        assert PROVIDER_WATERFALL_PRIORITY["rss"] < PROVIDER_WATERFALL_PRIORITY["marketaux"]
        assert PROVIDER_WATERFALL_PRIORITY["yahoo_rss"] < PROVIDER_WATERFALL_PRIORITY["marketaux"]
        assert PROVIDER_WATERFALL_PRIORITY["gdelt"] < PROVIDER_WATERFALL_PRIORITY["marketaux"]
        assert PROVIDER_WATERFALL_PRIORITY["currents"] < PROVIDER_WATERFALL_PRIORITY["marketaux"]

    def test_free_providers_never_trigger_stop(self):
        for name in ("rss", "yahoo_rss", "gdelt"):
            assert provider_router.should_stop_fetching(
                unique_relevant_count=99, target_count=TARGET_NEWS_COUNT,
                providers_called=3, current_provider=name,
            ) is False

    def test_scarce_provider_stops_at_target(self):
        assert provider_router.should_stop_fetching(
            unique_relevant_count=TARGET_NEWS_COUNT, target_count=TARGET_NEWS_COUNT,
            providers_called=3, current_provider="marketaux",
        ) is True
        assert provider_router.should_stop_fetching(
            unique_relevant_count=1, target_count=TARGET_NEWS_COUNT,
            providers_called=3, current_provider="marketaux",
        ) is False

    def test_free_set_membership(self):
        assert {"rss", "yahoo_rss", "gdelt"} <= FREE_PROVIDERS
        assert "marketaux" not in FREE_PROVIDERS
