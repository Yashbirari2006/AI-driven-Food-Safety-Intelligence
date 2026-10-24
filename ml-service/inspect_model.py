from pathlib import Path
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "data" / "reports"

model_path = REPORTS / "synthetic_random_forest.joblib"
pipeline = joblib.load(model_path)

preprocessor = pipeline.named_steps["preprocessing"]
classifier = pipeline.named_steps["model"]

feature_names = preprocessor.get_feature_names_out()
importances = classifier.feature_importances_

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": importances,
}).sort_values("importance", ascending=False)

output_path = REPORTS / "feature_importance.csv"
importance_df.to_csv(output_path, index=False)

print("\nTOP 15 MODEL FEATURES")
print("=" * 65)
print(importance_df.head(15).to_string(index=False))

print("\nRANDOM FOREST CONFUSION MATRIX")
print("=" * 65)
matrix_path = REPORTS / "random_forest_confusion_matrix.csv"
print(pd.read_csv(matrix_path, index_col=0).to_string())

print("\nSaved feature importance to:", output_path)
print(
    "\nReminder: feature importance describes this model's behaviour "
    "on synthetic, rule-generated labels; it is not proof of real-world "
    "causation or food-safety predictive validity."
)
