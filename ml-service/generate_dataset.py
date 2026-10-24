import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

SEED = 42
N_RECORDS = 15000

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "generated"
OUT.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(SEED)

districts = [
    "Dhule", "Jalgaon", "Nashik", "Pune", "Mumbai",
    "Mumbai Suburban", "Thane", "Palghar", "Raigad",
    "Ratnagiri", "Sindhudurg", "Kolhapur", "Sangli",
    "Satara", "Solapur", "Ahmednagar", "Nandurbar",
    "Chhatrapati Sambhajinagar", "Jalna", "Beed",
    "Dharashiv", "Latur", "Nanded", "Parbhani",
    "Hingoli", "Amravati", "Akola", "Buldhana",
    "Washim", "Yavatmal", "Nagpur", "Wardha",
    "Bhandara", "Gondia", "Chandrapur", "Gadchiroli"
]

# Oversample Dhule for project-specific scenarios.
# This is a synthetic sampling choice, not a claim about real incidence.
weights = np.array([3.0 if d == "Dhule" else 1.0 for d in districts])
weights = weights / weights.sum()

n = N_RECORDS

df = pd.DataFrame({
    "record_id": [f"SYN{i:05d}" for i in range(1, n + 1)],
    "district": rng.choice(districts, n, p=weights),
    "area_type": rng.choice(
        ["Urban", "Semi-urban", "Rural"], n, p=[0.35, 0.30, 0.35]
    ),
    "establishment_type": rng.choice(
        ["Restaurant", "Street vendor", "Retail shop",
         "Food manufacturer", "Caterer", "Dairy"],
        n, p=[0.25, 0.24, 0.20, 0.10, 0.11, 0.10]
    ),
    "hygiene_score": rng.integers(1, 6, n),
    "temperature_control_deviation": rng.binomial(1, 0.24, n),
    "unsafe_water_indicator": rng.binomial(1, 0.10, n),
    "pest_signs": rng.binomial(1, 0.12, n),
    "cross_contamination_indicator": rng.binomial(1, 0.16, n),
    "expired_food_indicator": rng.binomial(1, 0.08, n),
    "complaints_30d": rng.poisson(0.8, n).clip(0, 8),
    "illness_reports_7d": rng.poisson(0.15, n).clip(0, 5),
    "days_since_last_inspection": rng.integers(0, 731, n),
    "license_status": rng.choice(
        ["Valid", "Expired", "Unverified"],
        n, p=[0.75, 0.10, 0.15]
    )
})

# Transparent synthetic label rules.
# These rules are illustrative assumptions, NOT official FSSAI criteria.
score = (
    (5 - df["hygiene_score"]) * 1.5
    + df["temperature_control_deviation"] * 3
    + df["unsafe_water_indicator"] * 3
    + df["pest_signs"] * 3
    + df["cross_contamination_indicator"] * 3
    + df["expired_food_indicator"] * 4
    + df["complaints_30d"].clip(upper=6) * 0.5
    + df["illness_reports_7d"].clip(upper=3) * 2
    + (df["days_since_last_inspection"] > 365) * 2
    + (df["days_since_last_inspection"] > 180) * 1
    + df["license_status"].map(
        {"Valid": 0, "Expired": 2, "Unverified": 1}
    )
)

df["risk_level"] = np.select(
    [score >= 12, score >= 5],
    ["High", "Medium"],
    default="Low"
)

# Do NOT export the internal score: it directly determines the label
# and would leak the target into model inputs.
train, test = train_test_split(
    df,
    test_size=0.20,
    random_state=SEED,
    stratify=df["risk_level"]
)

df.to_csv(OUT / "synthetic_all_records.csv", index=False)
train.to_csv(OUT / "train.csv", index=False)
test.to_csv(OUT / "test.csv", index=False)

dictionary = [
    ("record_id", "Synthetic row identifier", "Identifier; exclude from model features"),
    ("district", "Synthetic Maharashtra district assignment", "Categorical"),
    ("area_type", "Urban, semi-urban, or rural setting", "Categorical"),
    ("establishment_type", "Illustrative food-business category", "Categorical"),
    ("hygiene_score", "Synthetic hygiene score from 1 (poor) to 5 (good)", "Ordinal"),
    ("temperature_control_deviation", "Simulated temperature-control issue; 1=yes", "Binary"),
    ("unsafe_water_indicator", "Simulated unsafe-water indicator; 1=yes", "Binary"),
    ("pest_signs", "Simulated pest indicator; 1=yes", "Binary"),
    ("cross_contamination_indicator", "Simulated cross-contamination indicator; 1=yes", "Binary"),
    ("expired_food_indicator", "Simulated expired-food indicator; 1=yes", "Binary"),
    ("complaints_30d", "Synthetic complaint count over 30 days", "Count"),
    ("illness_reports_7d", "Synthetic illness-report count over 7 days", "Count"),
    ("days_since_last_inspection", "Synthetic number of days since inspection", "Integer"),
    ("license_status", "Simulated licence status", "Categorical"),
    ("risk_level", "Rule-generated synthetic target: Low, Medium, or High", "Target; not real-world ground truth")
]

pd.DataFrame(
    dictionary, columns=["column", "description", "type_or_usage"]
).to_csv(OUT / "data_dictionary.csv", index=False)

metadata = {
    "dataset_type": "Fully synthetic; not official inspection data",
    "records": N_RECORDS,
    "random_seed": SEED,
    "evaluation_split": "80% train / 20% test; stratified random split",
    "target": "risk_level",
    "label_method": "Illustrative documented rule-based score",
    "official_fssai_thresholds": False,
    "real_world_predictive_validity_established": False,
    "dhule_sampling": "Oversampled intentionally for project scenarios",
    "caution": (
        "Test performance measures agreement with synthetic rules, "
        "not real-world food-safety prediction accuracy."
    )
}

(OUT / "metadata.json").write_text(
    json.dumps(metadata, indent=2), encoding="utf-8"
)

print("Synthetic dataset generation complete.")
print(f"Output directory: {OUT}")
print(f"Total records: {len(df)}")
print("\nOverall label counts:")
print(df["risk_level"].value_counts().to_string())
print("\nTrain records:", len(train))
print("Test records:", len(test))
print("\nDhule records:", int((df["district"] == "Dhule").sum()))
print("\nGenerated files:")
for path in sorted(OUT.iterdir()):
    print(f"  {path.name}: {path.stat().st_size:,} bytes")
