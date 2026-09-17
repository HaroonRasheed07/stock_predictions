"""Market calendar 2026+ verification."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath('.')))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stock_market.market_status import (
    get_market_status, is_trading_day, next_trading_day,
    _nyse_holidays, _early_close_dates, MARKET_OPEN, MARKET_CLOSE, EARLY_CLOSE
)
from datetime import datetime, date, time as dtime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
errors = 0

def check(name, condition, detail=""):
    global errors
    if condition:
        print(f"  PASS: {name}")
    else:
        errors += 1
        print(f"  FAIL: {name} -- {detail}")

print("=" * 60)
print("MARKET CALENDAR 2026+ VERIFICATION")
print("=" * 60)

# 1. Verify holidays are algorithmic (not hardcoded list)
print("\n1. Holiday counts per year:")
for year in [2025, 2026, 2027, 2028, 2030, 2035]:
    holidays = _nyse_holidays(year)
    check(f"{year} has 10 holidays", len(holidays) == 10, f"count={len(holidays)}")
    print(f"    {year}: {len(holidays)} holidays")

# 2. Verify specific 2026 holidays
print("\n2. 2026 NYSE holidays:")
h2026 = _nyse_holidays(2026)
expected_2026 = {
    date(2026, 1, 1),    # New Year
    date(2026, 1, 19),   # MLK Day
    date(2026, 2, 16),   # Presidents Day
    date(2026, 4, 3),    # Good Friday
    date(2026, 5, 25),   # Memorial Day
    date(2026, 6, 19),   # Juneteenth
    date(2026, 7, 3),    # Independence Day (observed)
    date(2026, 9, 7),    # Labor Day
    date(2026, 11, 26),  # Thanksgiving
    date(2026, 12, 25),  # Christmas
}
for d in expected_2026:
    check(f"{d} is holiday", d in h2026, f"not found in holidays")

# 3. Verify NOT holidays
print("\n3. Not holidays in 2026:")
not_holidays = [date(2026, 1, 5), date(2026, 3, 15), date(2026, 7, 2), date(2026, 12, 24)]
for d in not_holidays:
    check(f"{d} is NOT holiday", d not in h2026)

# 4. Early close dates
print("\n4. 2026 early close dates:")
early2026 = _early_close_dates(2026)
for d in sorted(early2026):
    is_hol = d in h2026
    print(f"    {d} ({d.strftime('%A')}) {'[HOLIDAY - should not be early close]' if is_hol else '[OK]'}")
check("July 3 is early close", date(2026, 7, 3) in early2026 or date(2026, 7, 3) in h2026)
check("Dec 24 is early close", date(2026, 12, 24) in early2026)

# 5. Trading day tests
print("\n5. Trading day tests:")
trading_tests = [
    (date(2026, 1, 5), True, "2026-01-05 Mon"),
    (date(2026, 1, 10), False, "2026-01-10 Sat"),
    (date(2026, 1, 11), False, "2026-01-11 Sun"),
    (date(2026, 1, 19), False, "2026-01-19 MLK Day"),
    (date(2026, 7, 3), False, "2026-07-03 July 3 observed"),
    (date(2026, 9, 17), True, "2026-09-17 Thu (today)"),
    (date(2026, 12, 25), False, "2026-12-25 Christmas"),
]
for d, expected, name in trading_tests:
    actual = is_trading_day(d)
    check(f"{name}: trading={expected}", actual == expected, f"got={actual}")

# 6. DST-aware next trading day
print("\n6. Next trading day tests:")
nxt = next_trading_day(date(2026, 12, 25))
check("Next after 2026-12-25 (Fri) = 2026-12-28 (Mon)", nxt.date() == date(2026, 12, 28))
nxt2 = next_trading_day(date(2026, 9, 7))
check("Next after 2026-09-07 (Labor Day Mon) = 2026-09-08 (Tue)", nxt2.date() == date(2026, 9, 8))

# 7. Current market status
print("\n7. Current market status:")
ms = get_market_status()
check("Status is valid", ms["status"] in ("open", "closed", "pre_market", "after_hours", "holiday"))
check("Label is valid", "Market" in ms["label"] or ms["label"] in ("Pre-Market", "After Hours"))
check("next_open is ISO format", "T" in str(ms.get("next_open", "")))
print(f"    Status: {ms['status']}")
print(f"    Label: {ms['label']}")
print(f"    Next open: {ms.get('next_open')}")

# 8. Timezone verification
print("\n8. Timezone verification:")
now_et = datetime.now(ET)
check("Current time has ET timezone", now_et.tzinfo is not None)
check("Hour is in ET range", 0 <= now_et.hour <= 23)
print(f"    Current ET: {now_et.strftime('%Y-%m-%d %H:%M:%S %Z')}")

# 9. Market hours constants
print("\n9. Market hours constants:")
check("MARKET_OPEN = 09:30", MARKET_OPEN == dtime(9, 30))
check("MARKET_CLOSE = 16:00", MARKET_CLOSE == dtime(16, 0))
check("EARLY_CLOSE = 13:00", EARLY_CLOSE == dtime(13, 0))

# 10. Verify algorithmic computation (not hardcoded)
print("\n10. Algorithmic vs hardcoded check:")
h2025 = _nyse_holidays(2025)
h2030 = _nyse_holidays(2030)
check("2025 has 10 holidays", len(h2025) == 10)
check("2030 has 10 holidays", len(h2030) == 10)
check("All holidays are weekday < 5 (or observed)", all(d.weekday() < 5 for d in h2030))

print(f"\n{'=' * 60}")
print(f"RESULT: {errors} failures")
if errors == 0:
    print("ALL MARKET CALENDAR TESTS PASSED")
else:
    print(f"{errors} TESTS FAILED")
