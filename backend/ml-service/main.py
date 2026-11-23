
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="SIVALE - Machine Learning",
    description="API de previsão de qualidade da uva",
    version="1.0.0"
)

# Localização do modelo treinado
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "qualidade_uva_pipeline.joblib"

# Carregar modelo ao iniciar a API
modelo = joblib.load(MODEL_PATH)


@app.get("/")
def home():
    return {
        "status": "online",
        "message": "API de Machine Learning do SIVALE funcionando!"
    }



class GrapeQualityInput(BaseModel):
    variety: str

    acidity_ph: float = Field(ge=0, le=14)
    sugar_content_brix: float = Field(ge=0, le=100)
    berry_size_mm: float = Field(gt=0)

    cluster_weight_g: float | None = Field(default=None, gt=0)
    sun_exposure_hours: float | None = Field(
        default=None, ge=0, le=24
    )
    soil_moisture_percent: float | None = Field(
        default=None, ge=0, le=100
    )
    rainfall_mm: float | None = Field(default=None, ge=0)



def classificar_qualidade(pontuacao):
    if pontuacao <= 1.5:
        return "Low"
    elif pontuacao <= 2.5:
        return "Medium"
    elif pontuacao <= 3.5:
        return "High"
    return "Premium"


@app.post("/predict/grape-quality")
def predict_grape_quality(dados: GrapeQualityInput):

    # Converter dados recebidos em DataFrame
    amostra = pd.DataFrame([dados.model_dump()])

    # Realizar previsão
    pontuacao = float(modelo.predict(amostra)[0])

    # Definir categoria
    categoria = classificar_qualidade(pontuacao)

    return {
        "quality_score": round(pontuacao, 2),
        "quality_category": categoria
    }
