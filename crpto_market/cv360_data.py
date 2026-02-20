import argparse
import sys
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = ["timestamp", "symbol", "open", "high", "low", "close", "volume"]
DEFAULT_EXCLUDED_SYMBOLS = ["SUI", "ARB", "APT", "OP", "ICP"]


@dataclass(frozen=True)
class DataQualityReport:
    symbol: str
    start: pd.Timestamp
    end: pd.Timestamp
    rows_raw: int
    rows_after_zero_drop: int
    missing_hours: int
    imputed_rows: int


def _validate_columns(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def load_ohlcv_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    _validate_columns(df)

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=False, errors="coerce")
    if df["timestamp"].isna().any():
        bad = int(df["timestamp"].isna().sum())
        raise ValueError(f"Found {bad} rows with unparseable timestamp")

    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    if df[["open", "high", "low", "close", "volume"]].isna().any().any():
        bad = int(df[["open", "high", "low", "close", "volume"]].isna().any(axis=1).sum())
        raise ValueError(f"Found {bad} rows with non-numeric OHLCV")

    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()

    df = df.sort_values(["symbol", "timestamp"], kind="mergesort")
    return df


def drop_all_zero_rows(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    feats = ["open", "high", "low", "close", "volume"]
    is_all_zero = (df[feats] == 0).all(axis=1)
    return df.loc[~is_all_zero].copy(), is_all_zero


def filter_symbols(df: pd.DataFrame, excluded: Iterable[str]) -> pd.DataFrame:
    excluded_set = {str(s).strip().upper() for s in excluded}
    return df.loc[~df["symbol"].isin(excluded_set)].copy()


def enforce_hourly_continuity_per_symbol(
    df: pd.DataFrame, *, rows_raw_by_symbol: Optional[dict] = None
) -> Tuple[pd.DataFrame, List[DataQualityReport]]:
    out_frames: List[pd.DataFrame] = []
    reports: List[DataQualityReport] = []

    for symbol, g in df.groupby("symbol", sort=False):
        g = g.sort_values("timestamp", kind="mergesort")
        g = g.drop_duplicates(subset=["timestamp"], keep="last")

        start = g["timestamp"].min()
        end = g["timestamp"].max()
        full_index = pd.date_range(start=start, end=end, freq="h")

        g2 = g.set_index("timestamp").reindex(full_index)
        g2.index.name = "timestamp"

        missing_hours = int(g2["symbol"].isna().sum())

        g2["symbol"] = symbol
        g2["imputed"] = g2["close"].isna()

        g2["close"] = g2["close"].ffill()
        g2["open"] = g2["open"].fillna(g2["close"])
        g2["high"] = g2["high"].fillna(g2["close"])
        g2["low"] = g2["low"].fillna(g2["close"])
        g2["volume"] = g2["volume"].fillna(0.0)

        still_missing = g2["close"].isna()
        if still_missing.any():
            g2 = g2.loc[~still_missing]

        imputed_rows = int(g2["imputed"].sum())

        out_frames.append(g2.reset_index())

        rows_raw = int(len(g)) if not rows_raw_by_symbol else int(rows_raw_by_symbol.get(symbol, len(g)))
        reports.append(
            DataQualityReport(
                symbol=symbol,
                start=pd.Timestamp(start),
                end=pd.Timestamp(end),
                rows_raw=rows_raw,
                rows_after_zero_drop=int(len(g)),
                missing_hours=missing_hours,
                imputed_rows=imputed_rows,
            )
        )

    out = pd.concat(out_frames, ignore_index=True)
    out = out.sort_values(["symbol", "timestamp"], kind="mergesort")
    return out, reports


def build_quality_report_df(reports: List[DataQualityReport]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "symbol": r.symbol,
            "start": r.start,
            "end": r.end,
            "rows_raw": r.rows_raw,
            "missing_hours": r.missing_hours,
            "imputed_rows": r.imputed_rows,
        }
        for r in reports
    ]).sort_values(["rows_raw", "symbol"])


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="topcrypto_hourly.csv")
    p.add_argument("--output", default="cv360_clean_ohlcv.csv")
    p.add_argument("--report", default="cv360_data_quality_report.csv")
    p.add_argument("--exclude", default=",".join(DEFAULT_EXCLUDED_SYMBOLS))

    args = p.parse_args(argv)

    df = load_ohlcv_csv(args.input)
    df = filter_symbols(df, [s for s in args.exclude.split(",") if s.strip()])

    rows_raw_by_symbol = df.groupby("symbol").size().to_dict()
    df, is_all_zero = drop_all_zero_rows(df)
    if int(is_all_zero.sum()) > 0:
        pass

    clean, reports = enforce_hourly_continuity_per_symbol(df, rows_raw_by_symbol=rows_raw_by_symbol)

    clean.to_csv(args.output, index=False)
    rep_df = build_quality_report_df(reports)
    rep_df.to_csv(args.report, index=False)

    print(f"Wrote cleaned OHLCV: {args.output} (rows={len(clean)})")
    print(f"Wrote quality report: {args.report} (symbols={rep_df['symbol'].nunique()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
