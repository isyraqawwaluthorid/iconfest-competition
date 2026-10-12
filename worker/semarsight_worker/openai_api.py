"""Bagian panggilan OpenAI Responses API yang dipakai bersama modul air dan insight."""

from __future__ import annotations

RESPONSES_URL = "https://api.openai.com/v1/responses"


def json_schema_format(schema: dict) -> dict:
    """Isi `text.format` untuk structured outputs, dari berkas schema di `ai/schemas/`."""
    return {"type": "json_schema", "name": schema["name"], "strict": True, "schema": schema["schema"]}


def output_text(body: dict) -> str:
    parts = [
        part.get("text", "")
        for item in body.get("output", [])
        if item.get("type") == "message"
        for part in item.get("content") or []
        if part.get("type") == "output_text"
    ]
    if not parts:
        raise ValueError("respons AI tidak berisi teks")
    return "".join(parts)
