import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import openai as openai_service


class _FakeResponse:
    headers = {"content-type": "text/html; charset=utf-8"}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self, _size: int) -> bytes:
        return (
            b'<html><head><meta property="og:image" '
            b'content="https://cdn.example-coke-assets.com/product.png">'
            b"</head></html>"
        )


def test_extract_meta_image_url_from_og_image():
    html = '<meta property="og:image" content="https://example.com/product.jpg">'

    assert openai_service._extract_meta_image_url(html) == "https://example.com/product.jpg"


def test_verified_product_image_url_requires_https_source_domain():
    source_domains = ["www.coca-cola.com", "us.coca-cola.com"]

    assert (
        openai_service._verified_product_image_url(
            "https://www.coca-cola.com/product.png",
            source_domains,
        )
        == "https://www.coca-cola.com/product.png"
    )
    assert (
        openai_service._verified_product_image_url(
            "https://example.com/product.png",
            source_domains,
        )
        is None
    )
    assert (
        openai_service._verified_product_image_url(
            "http://www.coca-cola.com/product.png",
            source_domains,
        )
        is None
    )


@pytest.mark.anyio
async def test_find_product_image_from_source_metadata(monkeypatch: pytest.MonkeyPatch):
    def fake_urlopen(_request, timeout: int):
        assert timeout == 5
        return _FakeResponse()

    monkeypatch.setattr(openai_service, "urlopen", fake_urlopen)

    image_url = await openai_service._find_product_image_from_sources(
        ["https://www.coca-cola.com/us/en/about-us"],
        ["www.coca-cola.com"],
    )

    assert image_url == "https://cdn.example-coke-assets.com/product.png"
