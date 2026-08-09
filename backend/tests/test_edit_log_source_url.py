import json
import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.models.api import IngredientItem
from app.models.requests import EditLogRequest
from app.services import openai as openai_service
from app.services.prompts import build_edit_log_prompt


def _ingredient() -> IngredientItem:
    return IngredientItem(
        id="ing-1",
        name="Yogurt",
        quantity="1",
        unit="cup",
        carbs=10,
        fats=3,
        proteins=12,
        calories=115,
    )


def test_edit_log_request_accepts_trimmed_http_source_url():
    request = EditLogRequest(
        ingredients=[_ingredient()],
        correction="Use the nutrition values from this product page",
        sourceUrl=" https://example.com/product/yogurt ",
    )

    assert request.sourceUrl == "https://example.com/product/yogurt"


def test_edit_log_request_rejects_non_http_source_url():
    with pytest.raises(ValueError, match="sourceUrl"):
        EditLogRequest(
            ingredients=[_ingredient()],
            correction="Use this source",
            sourceUrl="file:///tmp/product.html",
        )


def test_edit_log_prompt_marks_source_url_as_primary_source():
    prompt = build_edit_log_prompt(
        ingredients_json=json.dumps([_ingredient().model_dump(exclude_none=True)]),
        correction="Update macros",
        source_url="https://example.com/recipe",
    )

    assert "Primary source URL: https://example.com/recipe" in prompt
    assert "main source of truth" in prompt


@pytest.mark.anyio
async def test_edit_log_source_url_forces_web_search_without_image(monkeypatch: pytest.MonkeyPatch):
    calls = []
    response_json = json.dumps(
        {
            "carbs": 10,
            "protein": 12,
            "fats": 3,
            "calories": 115,
            "analysis": "Used source page.",
            "logName": "Source Yogurt",
            "ingredients": [_ingredient().model_dump(exclude_none=True)],
            "confidence": 0.9,
            "foodCategory": "packaged_product",
        }
    )

    async def fake_create_json_response(_client, **kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(openai_service, "get_openai_client", lambda: object())
    monkeypatch.setattr(openai_service, "_create_json_response", fake_create_json_response)
    monkeypatch.setattr(openai_service, "_has_web_search_calls", lambda _response: True)
    monkeypatch.setattr(openai_service, "_extract_source_urls", lambda _response: ["https://example.com/product/yogurt"])
    monkeypatch.setattr(openai_service, "_extract_response_text", lambda _response: response_json)

    result = await openai_service.edit_log(
        [_ingredient()],
        "Use the product page values",
        source_url="https://example.com/product/yogurt",
    )

    assert result.logName == "Source Yogurt"
    assert len(calls) == 1
    assert calls[0]["tools"] == [{"type": "web_search"}]
    assert calls[0]["image_data"] is None
    assert "Primary source URL: https://example.com/product/yogurt" in calls[0]["prompt_text"]
