from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "generated"
df = pd.read_csv(DATA / "synthetic_all_records.csv")

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

reconstructed = np.select(
    [score >= 12, score >= 5],
    ["High", "Medium"],
    default="Low"
)

df["reconstructed_label"] = reconstructed
mismatches = int(
    (df["risk_level"] != df["reconstructed_label"]).sum()
)

print("=" * 55)
print("LABEL RULE RECONSTRUCTION AUDIT")
print("=" * 55)
print("Total records:", len(df))
print("Label mismatches:", mismatches)
print("Reconstruction agreement: {:.2f}%".format(
    100 * (len(df) - mismatches) / len(df)
))

print("\n[1] Label counts by hygiene score")
print(pd.crosstab(
    df["hygiene_score"], df["risk_level"]
).to_string())

print("\n[2] Label counts by illness reports")
print(pd.crosstab(
    df["illness_reports_7d"], df["risk_level"]
).to_string())

print("\n[3] Label counts by licence status")
print(pd.crosstab(
    df["license_status"], df["risk_level"]
).to_string())

print("\n[4] District sampling")
print(df["district"].value_counts().head(10).to_string())

print("\nINTERPRETATION")
print("Exact reconstruction confirms consistency with the rule.")
print("It does not validate labels against real inspections or outcomes.")
print("Do not use reconstructed score as a model input.")
