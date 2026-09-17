"""US Stock Market Status — timezone-aware NYSE calendar (stdlib only)."""

from datetime import datetime, timedelta, date, time as dtime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
MARKET_OPEN = dtime(9, 30)
MARKET_CLOSE = dtime(16, 0)
PRE_MARKET_START = dtime(4, 0)
AFTER_HOURS_END = dtime(20, 0)
EARLY_CLOSE = dtime(13, 0)


def _easter_sunday(year: int) -> date:
    a = year % 19
    b, c = year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    last = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _observed(year: int, month: int, day: int) -> date:
    d = date(year, month, day)
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def _nyse_holidays(year: int) -> set[date]:
    gf = _easter_sunday(year) - timedelta(days=2)
    return {
        _observed(year, 1, 1),
        _nth_weekday(year, 1, 0, 3),
        _nth_weekday(year, 2, 0, 3),
        gf,
        _last_weekday(year, 5, 0),
        _observed(year, 6, 19),
        _observed(year, 7, 4),
        _nth_weekday(year, 9, 0, 1),
        _nth_weekday(year, 11, 3, 4),
        _observed(year, 12, 25),
    }


def _early_close_dates(year: int) -> set[date]:
    holidays = _nyse_holidays(year)
    july4 = date(year, 7, 4)
    day_before = july4 - timedelta(days=3 if july4.weekday() == 0 else 1)
    christmas_eve = date(year, 12, 24)
    bf = _nth_weekday(year, 11, 3, 4) + timedelta(days=1)
    return {d for d in [day_before, christmas_eve, bf] if d.weekday() < 5 and d not in holidays}


_HOLIDAY_CACHE: dict[int, set[date]] = {}
_EARLY_CACHE: dict[int, set[date]] = {}


def _holidays(y: int) -> set[date]:
    if y not in _HOLIDAY_CACHE:
        _HOLIDAY_CACHE[y] = _nyse_holidays(y)
    return _HOLIDAY_CACHE[y]


def _early(y: int) -> set[date]:
    if y not in _EARLY_CACHE:
        _EARLY_CACHE[y] = _early_close_dates(y)
    return _EARLY_CACHE[y]


def is_trading_day(dt: date | None = None) -> bool:
    if dt is None:
        dt = datetime.now(ET).date()
    elif isinstance(dt, datetime):
        dt = dt.date()
    return dt.weekday() < 5 and dt not in _holidays(dt.year)


def next_trading_day(dt: date | None = None) -> datetime:
    if dt is None:
        dt = datetime.now(ET).date()
    elif isinstance(dt, datetime):
        dt = dt.date()
    nxt = dt + timedelta(days=1)
    while not is_trading_day(nxt):
        nxt += timedelta(days=1)
    return datetime.combine(nxt, MARKET_OPEN, tzinfo=ET)


def is_market_open() -> bool:
    return get_market_status()["status"] == "open"


def get_market_status() -> dict:
    now = datetime.now(ET)
    today = now.date()
    ct = now.time()
    hol = today in _holidays(now.year)
    early = today in _early(now.year)
    ch = 13 if early else 16
    close_dt = datetime.combine(today, dtime(ch, 0), tzinfo=ET)

    if hol or today.weekday() >= 5:
        return {
            "status": "holiday" if hol else "closed",
            "label": "Market Holiday" if hol else "Market Closed",
            "next_open": next_trading_day(today).isoformat(),
            "next_close": None, "is_early_close": False, "regular_close_hour": 16,
        }

    if ct < MARKET_OPEN:
        st = "closed" if ct < PRE_MARKET_START else "pre_market"
        lb = "Market Closed" if ct < PRE_MARKET_START else "Pre-Market"
        return {
            "status": st, "label": lb,
            "next_open": datetime.combine(today, MARKET_OPEN, tzinfo=ET).isoformat(),
            "next_close": close_dt.isoformat(),
            "is_early_close": early, "regular_close_hour": ch,
        }

    if ct <= dtime(ch, 0):
        return {
            "status": "open", "label": "Market Open",
            "next_open": None, "next_close": close_dt.isoformat(),
            "is_early_close": early, "regular_close_hour": ch,
        }

    if ct <= AFTER_HOURS_END:
        return {
            "status": "after_hours", "label": "After Hours",
            "next_open": next_trading_day(today).isoformat(), "next_close": None,
            "is_early_close": early, "regular_close_hour": ch,
        }

    return {
        "status": "closed", "label": "Market Closed",
        "next_open": next_trading_day(today).isoformat(), "next_close": None,
        "is_early_close": early, "regular_close_hour": ch,
    }
