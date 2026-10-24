from pathlib import Path
import json

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "generated"
REPORTS = ROOT / "data" / "reports"
REPORTS.mkdir(parents=True, exist_ok=True)

train = pd.read_csv(DATA / "train.csv")
test = pd.read_csv(DATA / "test.csv")

TARGET = "risk_level"
EXCLUDED = ["record_id", TARGET]

X_train = train.drop(columns=EXCLUDED)
y_train = train[TARGET]
X_test = test.drop(columns=EXCLUDED)
y_test = test[TARGET]

categorical = X_train.select_dtypes(
    include=["object", "category"]
).columns.tolist()
numeric = X_train.select_dtypes(
    include=["number", "bool"]
).columns.tolist()

preprocessor = ColumnTransformer([
    ("categorical", OneHotEncoder(handle_unknown="ignore"), categorical),
    ("numeric", "passthrough", numeric),
])

models = {
    "majority_baseline": DummyClassifier(strategy="most_frequent"),
    "random_forest": RandomForestClassifier(
        n_estimators=250,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    ),
}

labels = ["Low", "Medium", "High"]
results = {}

for name, model in models.items():
    if name == "majority_baseline":
        fitted = model
    else:
        fitted = Pipeline([
            ("preprocessing", preprocessor),
            ("model", model),
        ])

    fitted.fit(X_train, y_train)
    predictions = fitted.predict(X_test)

    report = classification_report(
        y_test,
        predictions,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )

    results[name] = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_test, predictions)
        ),
        "macro_f1": float(
            f1_score(y_test, predictions, average="macro")
        ),
        "classification_report": report,
    }

    matrix = confusion_matrix(
        y_test, predictions, labels=labels
    )
    pd.DataFrame(
        matrix,
        index=[f"actual_{label}" for label in labels],
        columns=[f"predicted_{label}" for label in labels],
    ).to_csv(REPORTS / f"{name}_confusion_matrix.csv")

    print("\n" + "=" * 60)
    print(name.upper())
    print("=" * 60)
    print("Accuracy:", round(results[name]["accuracy"], 4))
    print("Balanced accuracy:", round(
        results[name]["balanced_accuracy"], 4
    ))
    print("Macro-F1:", round(results[name]["macro_f1"], 4))
    print("\nPer-class report:")
    print(classification_report(
        y_test,
        predictions,
        labels=labels,
        zero_division=0,
    ))

    if name == "random_forest":
        # Save the fitted model for reproducible local experiments.
        import joblib
        joblib.dump(fitted, REPORTS / "synthetic_random_forest.joblib")

(REPORTS / "baseline_metrics.json").write_text(
    json.dumps(results, indent=2), encoding="utf-8"
)

notes = """
Dataset: fully synthetic, rule-generated labels.
Evaluation: held-out random test split from the same synthetic generator.
These metrics measure agreement with synthetic labels only.
They do not establish real-world food-safety predictive validity.
The saved model is an experimental artifact, not a deployment-ready system.
"""
(REPORTS / "evaluation_notes.txt").write_text(
    notes.strip() + "\n", encoding="utf-8"
)

print("\nResults saved to:", REPORTS)
print("Reminder: synthetic test performance is not real-world validation.")
