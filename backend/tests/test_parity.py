"""
test_parity.py — Parity test for preprocessing.

Runs ONLY if backend/tests/fixtures/parity_raw.csv and parity_expected.csv exist.
Otherwise: pytest.skip with a clear message.

Pushes raw rows through backend preprocessing and compares with the expected
226-column output.
"""

import json
import os
import pytest
import pandas as pd
import numpy as np

from app.ml.loader import store


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
RAW_PATH = os.path.join(FIXTURES_DIR, "parity_raw.csv")
EXPECTED_PATH = os.path.join(FIXTURES_DIR, "parity_expected.csv")
COMPARE_COLS_PATH = os.path.join(FIXTURES_DIR, "parity_compare_columns.json")


@pytest.fixture
def parity_data():
    """Load parity test data, skip if files don't exist."""
    if not os.path.exists(RAW_PATH):
        pytest.skip(
            f"Parity test skipped: {RAW_PATH} not found. "
            "Add parity_raw.csv and parity_expected.csv to backend/tests/fixtures/ "
            "to enable this test."
        )
    if not os.path.exists(EXPECTED_PATH):
        pytest.skip(
            f"Parity test skipped: {EXPECTED_PATH} not found. "
            "Add parity_raw.csv and parity_expected.csv to backend/tests/fixtures/ "
            "to enable this test."
        )
    if not os.path.exists(COMPARE_COLS_PATH):
        pytest.skip(
            f"Parity test skipped: {COMPARE_COLS_PATH} not found. "
            "Add parity_compare_columns.json to backend/tests/fixtures/ "
            "to enable this test."
        )

    raw = pd.read_csv(RAW_PATH)
    expected = pd.read_csv(EXPECTED_PATH)
    with open(COMPARE_COLS_PATH, "r", encoding="utf-8") as f:
        compare_cols = json.load(f)

    return raw, expected, compare_cols


def test_parity(parity_data):
    """Push raw rows through backend preprocessing and compare with expected output."""
    if not store.loaded:
        pytest.skip("Model artifacts not loaded — cannot run parity test")

    from app.ml.preprocess import preprocess

    raw_df, expected_df, compare_cols = parity_data
    features = store.metadata["features_used"]

    # Check expected has the right columns
    assert list(expected_df.columns) == features, (
        f"Expected CSV columns don't match features_used. "
        f"Got {len(expected_df.columns)} columns, expected {len(features)}."
    )

    errors = []
    differing_columns = set()

    for i in range(len(raw_df)):
        row = raw_df.iloc[i].to_dict()
        # Convert NaN to None for optional fields
        for k, v in row.items():
            if pd.isna(v):
                row[k] = None

        try:
            result = preprocess(row)
            result_row = result.iloc[0]
            expected_row = expected_df.iloc[i]

            # Compare only columns specified in parity_compare_columns.json
            for col in compare_cols:
                actual = result_row[col]
                expected = expected_row[col]

                if pd.isna(actual) and pd.isna(expected):
                    continue
                if not np.isclose(actual, expected, rtol=1e-6, atol=1e-6):
                    differing_columns.add(col)
                    errors.append(
                        f"Row {i}, column '{col}': "
                        f"got {actual}, expected {expected}"
                    )
        except Exception as e:
            errors.append(f"Row {i}: preprocessing raised {type(e).__name__}: {e}")

    if differing_columns:
        print(f"\nDiffering columns ({len(differing_columns)}): {sorted(differing_columns)}")

    assert not errors, (
        f"Parity test found {len(errors)} mismatches across columns {sorted(differing_columns)}:\n" +
        "\n".join(errors[:20])  # show first 20
    )

