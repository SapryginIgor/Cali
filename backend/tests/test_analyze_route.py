import base64
import os
import sys
from typing import Optional
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.exceptions import AppError
from app.main import app
from app.models.api import IngredientItem, NutritionResult


PNG_1X1_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgJ7n6fQAAAAASUVORK5CYII="
)


def build_result() -> NutritionResult:
    return NutritionResult(
        carbs=30,
        protein=22,
        fats=11,
        calories=305,
        analysis="Balanced meal.",
        logName="Chicken Rice Plate",
        ingredients=[
            IngredientItem(
                id="ing-1",
                name="Chicken",
                quantity="150 g",
                carbs=0,
                fats=5,
                proteins=31,
            )
        ],
        mealNotes="Lunch",
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_json_base64_request_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_analyze_food_image(
        image_base64: str,
        description: Optional[str] = None
    ) -> NutritionResult:
        assert isinstance(image_base64, str)
        assert description == "Test meal"
        return build_result()

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", fake_analyze_food_image)

    response = client.post(
        "/api/analyze-food",
        json={
            "image": f"data:image/png;base64,{PNG_1X1_BASE64}",
            "description": "Test meal",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["logName"] == "Chicken Rice Plate"
    assert isinstance(data["ingredients"], list) and len(data["ingredients"]) == 1
    assert data["ingredients"][0]["proteins"] == 31


def test_multipart_request_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_analyze_food_image(
        image_base64: str,
        description: Optional[str] = None
    ) -> NutritionResult:
        assert image_base64.startswith("data:image/png;base64,")
        assert description == "Multipart meal"
        return build_result()

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", fake_analyze_food_image)

    image_bytes = base64.b64decode(PNG_1X1_BASE64)
    response = client.post(
        "/api/analyze-food",
        data={"description": "Multipart meal"},
        files={"image": ("meal.png", image_bytes, "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["analysis"] == "Balanced meal."


def test_validation_error_missing_image(client: TestClient):
    response = client.post("/api/analyze-food", json={"description": "No image"})
    assert response.status_code == 400
    payload = response.json()
    assert "error" in payload
    assert "Validation failed" in payload["message"]


def test_upstream_error_handling(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_analyze_food_image(
        _image_base64: str,
        _description: Optional[str] = None
    ) -> NutritionResult:
        raise AppError(503, "Service temporarily unavailable")

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", fake_analyze_food_image)

    response = client.post(
        "/api/analyze-food",
        json={"image": f"data:image/png;base64,{PNG_1X1_BASE64}"},
    )
    assert response.status_code == 503
    payload = response.json()
    assert payload["message"] == "Service temporarily unavailable"
