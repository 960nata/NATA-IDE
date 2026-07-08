"""brain.py — koneksi ke otak AI lokal (Ollama / Qwen2.5-Coder)."""

import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen2.5-coder:3b"   # gemma4:e2b sudah di-uninstall (2026-07-03) — qwen 3b lebih hemat RAM


def chat(messages, model=DEFAULT_MODEL, temperature=0.2):
    """Kirim daftar pesan ke model lokal, balikin teks jawabannya."""
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "keep_alive": "15m",
                "options": {
                    "temperature": temperature,
                    "num_ctx": 2048,  # Cap context to 2048 to save memory on MacBook Air
                    "top_k": 40,
                    "top_p": 0.9,
                },
            },
            timeout=300,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Ga bisa konek ke Ollama. Pastiin Ollama jalan dulu "
            "(buka app Ollama atau ketik `ollama serve` di terminal)."
        )
