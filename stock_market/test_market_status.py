"""Market status comprehensive test."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath('.')))
from market_status import get_market_status, is_market_open, is_trading_day, next_trading_day, _nyse_holidays
from datetime import datetime
from zoneinfo import ZoneInfo

et = ZoneInfo('America/New_York')
now = datetime.now(et)
print(f"Current ET time: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"Weekday: {now.strftime('%A')}")
print()

ms = get_market_status()
print(f"Status: {ms['status']}")
print(f"Label: {ms['label']}")
print(f"Is open: {is_market_open()}")
print(f"Is trading day: {is_trading_day()}")
print(f"Next open: {ms.get('next_open', 'N/A')}")
print(f"Early close: {ms.get('is_early_close', False)}")

print()
print("=== Holiday Checks ===")
holidays = _nyse_holidays(2025)
for h in sorted(holidays):
    print(f"  {h} ({h.strftime('%A')})")

print()
print("=== Edge Cases ===")
# Simulate known dates
test_cases = [
    ("2025-01-01", "New Year's Day"),
    ("2025-07-04", "Independence Day"),
    ("2025-12-25", "Christmas Day"),
    ("2025-01-20", "MLK Day"),
    ("2025-11-27", "Thanksgiving"),
]
for date_str, name in test_cases:
    y, m, d = map(int, date_str.split("-"))
    dt = datetime(y, m, d, 12, 0, tzinfo=et)
    td = is_trading_day(dt)
    print(f"  {date_str} ({name}): trading_day={td}")
