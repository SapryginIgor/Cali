import json
from collections import Counter
from pathlib import Path


DATASET_PATH = (
    Path(__file__).resolve().parents[1]
    / "evals"
    / "source_backed_visible_food_dataset.json"
)

VALID_CATEGORIES = {
    "simple_food",
    "complex_meal",
    "beverage",
    "packaged_product",
    "nutrition_label",
}
BLOCKED_FILE_EXTENSIONS = (".pdf", ".svg", ".ogv", ".webm", ".djvu")


def _load_dataset() -> dict:
    return json.loads(DATASET_PATH.read_text())


def test_visible_food_dataset_has_source_backed_examples():
    dataset = _load_dataset()
    examples = dataset["examples"]

    assert dataset["name"] == "source_backed_visible_food_eval"
    assert len(examples) >= 50
    assert len({example["id"] for example in examples}) == len(examples)

    categories = Counter(example["category"] for example in examples)
    assert set(categories).issubset(VALID_CATEGORIES)
    assert categories["complex_meal"] >= 20
    assert categories["simple_food"] >= 8
    assert categories["beverage"] >= 4
    assert categories["packaged_product"] >= 3
    assert categories["nutrition_label"] >= 1

    for example in examples:
        assert example["source"] == "wikimedia_commons"
        assert example["source_url"].startswith("https://commons.wikimedia.org/wiki/File:")
        assert example["image_url"].startswith("https://upload.wikimedia.org/")
        assert example["license"]
        assert example["source_title"].startswith("File:")
        assert not example["source_title"].lower().endswith(BLOCKED_FILE_EXTENSIONS)
        assert example["expected_visible_ingredients"]


def test_visible_food_dataset_forbidden_terms_are_not_expected_labels():
    for example in _load_dataset()["examples"]:
        expected_names = {
            ingredient["name"].casefold()
            for ingredient in example["expected_visible_ingredients"]
        }
        forbidden_names = {name.casefold() for name in example["forbidden_ingredients"]}

        assert expected_names.isdisjoint(forbidden_names), example["id"]


def test_visible_food_dataset_expectations_are_minimum_visible_anchors():
    dataset = _load_dataset()

    assert "conservative" in dataset["description"].lower()
    for example in dataset["examples"]:
        for ingredient in example["expected_visible_ingredients"]:
            assert ingredient["required"] is True
            assert "source" in ingredient["source_backing"].lower()
