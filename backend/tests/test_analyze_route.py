import base64
import os
import sys
import time
from typing import Optional
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.exceptions import AppError
from app.main import app
from app.middleware.auth import require_active_subscription
from app.models.api import ChatMessage, IngredientItem, NutritionResult, NutritionistChatResult
from app.services.openai import nutritionist_chat


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
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    app.dependency_overrides[require_active_subscription] = lambda: "test-user-id"
    monkeypatch.setattr("app.routes.analyze.is_s3_configured", lambda: False)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


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


def test_validation_error_missing_input(client: TestClient):
    response = client.post("/api/analyze-food", json={})
    assert response.status_code == 400
    payload = response.json()
    assert "error" in payload
    assert "Either an image or a description is required" in payload["message"]


def test_nutritionist_chat_request_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_nutritionist_chat(messages, today_totals=None, recent_meals=None, goals=None):
        assert messages[-1].content == "Help me improve my protein"
        assert today_totals.protein == 42
        assert recent_meals[0].description == "Chicken rice"
        assert goals.goal == "Build muscle"
        assert goals.allergies == "-"
        return NutritionistChatResult(message="Add a protein anchor to your next meal.")

    monkeypatch.setattr("app.routes.analyze.nutritionist_chat", fake_nutritionist_chat)

    response = client.post(
        "/api/nutritionist-chat",
        json={
            "messages": [
                {"role": "assistant", "content": "What is your goal?"},
                {"role": "user", "content": "Help me improve my protein"},
            ],
            "todayTotals": {
                "carbs": 110,
                "protein": 42,
                "fats": 35,
                "calories": 920,
            },
            "goals": {
                "goal": "Build muscle",
                "targetCalories": "-",
                "targetProtein": "140g/day",
                "dietaryPreference": "-",
                "allergies": "-",
                "activity": "Lifting 3x/week",
                "notes": "-",
            },
            "recentMeals": [
                {
                    "timestamp": 1720000000000,
                    "description": "Chicken rice",
                    "nutrition": {
                        "carbs": 55,
                        "protein": 32,
                        "fats": 12,
                        "calories": 460,
                    },
                    "ingredients": ["Chicken", "Rice"],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Add a protein anchor to your next meal."


def test_nutritionist_chat_prompt_gathers_personalization_context(monkeypatch: pytest.MonkeyPatch):
    captured: dict = {}

    class FakeResponses:
        async def create(self, **kwargs):
            captured.update(kwargs)

            class FakeResponse:
                output_text = "What is your current weight and training schedule?"

            return FakeResponse()

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr("app.services.openai.get_openai_client", lambda: FakeClient())

    import asyncio

    asyncio.run(
        nutritionist_chat(
            messages=[
                ChatMessage(
                    role="user",
                    content="I want to lower body fat and gain muscle",
                )
            ],
        )
    )

    instructions = captured["instructions"].lower()
    assert "current weight" in instructions
    assert "height" in instructions
    assert "training/activity" in instructions
    assert "at most two focused follow-up questions" in instructions
    assert "do not present precise calorie or macro targets" in instructions


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


def _wait_for_log_status(client: TestClient, log_id: str, expected_status: str, timeout_s: float = 1.0):
    deadline = time.time() + timeout_s
    last_payload = None
    while time.time() < deadline:
        response = client.get(f"/api/logs/{log_id}")
        assert response.status_code == 200
        payload = response.json()
        last_payload = payload
        if payload["status"] == expected_status:
            return payload
        time.sleep(0.02)
    raise AssertionError(f"Log {log_id} did not reach status={expected_status}. Last payload: {last_payload}")


def test_async_log_create_and_complete(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_analyze_food_image(
        image_base64: str,
        description: Optional[str] = None
    ) -> NutritionResult:
        assert isinstance(image_base64, str)
        assert description == "Async meal"
        return build_result()

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", fake_analyze_food_image)

    create_response = client.post(
        "/api/logs",
        json={
            "image": f"data:image/png;base64,{PNG_1X1_BASE64}",
            "description": "Async meal",
            "idempotencyKey": "key-1",
        },
    )
    assert create_response.status_code == 200
    create_payload = create_response.json()
    assert create_payload["status"] == "pending"
    assert create_payload["id"]

    completed_payload = _wait_for_log_status(client, create_payload["id"], "completed")
    assert completed_payload["result"]["logName"] == "Chicken Rice Plate"
    assert completed_payload["error"] is None


def test_async_log_idempotency_returns_same_log(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_analyze_food_image(
        _image_base64: str,
        _description: Optional[str] = None
    ) -> NutritionResult:
        return build_result()

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", fake_analyze_food_image)

    first = client.post(
        "/api/logs",
        json={
            "image": f"data:image/png;base64,{PNG_1X1_BASE64}",
            "description": "Meal",
            "idempotencyKey": "dedupe-1",
        },
    )
    second = client.post(
        "/api/logs",
        json={
            "image": f"data:image/png;base64,{PNG_1X1_BASE64}",
            "description": "Meal",
            "idempotencyKey": "dedupe-1",
        },
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


def test_async_log_failure_transition(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def failing_analyze_food_image(
        _image_base64: str,
        _description: Optional[str] = None
    ) -> NutritionResult:
        raise AppError(503, "Service temporarily unavailable")

    monkeypatch.setattr("app.routes.analyze.analyze_food_image", failing_analyze_food_image)

    create_response = client.post(
        "/api/logs",
        json={
            "image": f"data:image/png;base64,{PNG_1X1_BASE64}",
            "description": "Meal",
            "idempotencyKey": "failure-1",
        },
    )
    assert create_response.status_code == 200
    create_payload = create_response.json()
    failed_payload = _wait_for_log_status(client, create_payload["id"], "failed")
    assert failed_payload["error"]
