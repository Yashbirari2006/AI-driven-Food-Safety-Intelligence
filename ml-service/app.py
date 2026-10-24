from contextlib import asynccontextmanager
from pathlib import Path
import logging

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "data" / "reports" / "synthetic_random_forest.joblib"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

model_pipeline = None

EXPECTED_FEATURES = [
    "district",
    "area_type",
    "establishment_type",
    "hygiene_score",
    "temperature_control_deviation",
    "unsafe_water_indicator",
    "pest_signs",
    "cross_contamination_indicator",
    "expired_food_indicator",
    "complaints_30d",
    "illness_reports_7d",
    "days_since_last_inspection",
    "license_status",
]


class PredictionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district: str = Field(min_length=1, max_length=100)
    area_type: str = Field(min_length=1, max_length=50)
    establishment_type: str = Field(min_length=1, max_length=100)

    hygiene_score: int = Field(ge=1, le=5)
    temperature_control_deviation: int = Field(ge=0, le=1)
    unsafe_water_indicator: int = Field(ge=0, le=1)
    pest_signs: int = Field(ge=0, le=1)
    cross_contamination_indicator: int = Field(ge=0, le=1)
    expired_food_indicator: int = Field(ge=0, le=1)

    complaints_30d: int = Field(ge=0, le=10000)
    illness_reports_7d: int = Field(ge=0, le=10000)
    days_since_last_inspection: int = Field(ge=0, le=10000)

    license_status: str = Field(min_length=1, max_length=50)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_pipeline

    if not MODEL_PATH.is_file():
        raise RuntimeError(f"Trained model not found: {MODEL_PATH}")

    model_pipeline = joblib.load(MODEL_PATH)

    if not hasattr(model_pipeline, "predict"):
        raise RuntimeError("Loaded artifact does not support prediction.")

    logger.info("Synthetic experimental model loaded.")
    yield
    model_pipeline = None


app = FastAPI(
    title="Food Safety ML Prediction API",
    description=(
        "Experimental risk classification using a synthetic-data-trained "
        "model. Predictions are advisory and are not validated for "
        "real-world food-safety decisions."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model_pipeline is not None,
        "model_type": "RandomForestClassifier",
        "data_status": "synthetic_training_data",
        "real_world_validated": False,
    }


@app.get("/model-info")
def model_info():
    return {
        "model_type": "RandomForestClassifier",
        "input_features": EXPECTED_FEATURES,
        "output_classes": ["Low", "Medium", "High"],
        "training_data": "Synthetic, rule-generated labels",
        "real_world_validated": False,
        "advisory_only": True,
    }


@app.post("/predict")
def predict(payload: PredictionInput):
    if model_pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Prediction model is not loaded.",
        )

    try:
        record = pd.DataFrame([payload.model_dump()])

        # Keep inference columns in exactly the training order.
        record = record[EXPECTED_FEATURES]

        prediction = str(model_pipeline.predict(record)[0])

        probabilities = model_pipeline.predict_proba(record)[0]
        classes = model_pipeline.named_steps["model"].classes_

        confidence = {
            str(label): round(float(probability), 4)
            for label, probability in zip(classes, probabilities)
        }

        return {
            "predicted_risk": prediction,
            "class_probabilities": confidence,
            "model_type": "RandomForestClassifier",
            "data_status": "synthetic_training_data",
            "real_world_validated": False,
            "advisory_only": True,
            "message": (
                "Experimental prediction only. Human review is required; "
                "this result is not an official food-safety classification."
            ),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Prediction failed.")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Check service logs.",
        )
