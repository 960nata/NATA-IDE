"""agent.py — otak pengambil keputusan: mikir, pilih tool, eksekusi, ulang."""

import json
import re

from core import brain, registry

MAX_STEPS = 5  # batas berapa kali manggil tool dalam 1 giliran


def _system_prompt():
    return (
        "Kamu asisten AI pribadi yang bisa pakai tools. Jawab dengan bahasa Indonesia santai.\n\n"
        "Kalau kamu butuh pakai tool, balas HANYA dengan satu objek JSON (tanpa teks lain):\n"
        '{"tool": "<nama_tool>", "args": { ... }}\n\n'
        "Tools yang tersedia:\n"
        f"{registry.tool_list_for_prompt()}\n\n"
        "Kalau kamu sudah punya jawaban final buat user, balas teks biasa TANPA JSON sama sekali."
    )


def _extract_tool_call(text):
    """Cari objek JSON {\"tool\": ...} di dalam jawaban model."""
    # buang fence ```json ... ```
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    candidates = [cleaned]
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if m:
        candidates.append(m.group(0))
    for c in candidates:
        try:
            obj = json.loads(c)
            if isinstance(obj, dict) and "tool" in obj:
                return obj
        except json.JSONDecodeError:
            continue
    return None


def run(user_input, history):
    """Proses satu giliran chat. history = list pesan {role, content}."""
    history.append({"role": "user", "content": user_input})
    messages = [{"role": "system", "content": _system_prompt()}] + history

    for _ in range(MAX_STEPS):
        reply = brain.chat(messages)
        call = _extract_tool_call(reply)

        if not call:
            history.append({"role": "assistant", "content": reply})
            return reply

        name = call.get("tool")
        args = call.get("args", {}) or {}
        spec = registry.ALL_TOOLS.get(name)

        if not spec:
            result = f"Tool '{name}' nggak ada."
        else:
            print(f"   🔧 pakai tool: {name} ...")
            try:
                result = spec["run"](**args)
            except Exception as e:
                result = f"Error pas jalanin {name}: {e}"

        messages.append({"role": "assistant", "content": reply})
        messages.append(
            {
                "role": "user",
                "content": f"[HASIL TOOL {name}]: {result}\n"
                "Kasih jawaban final ke user (teks biasa, tanpa JSON).",
            }
        )

    history.append({"role": "assistant", "content": reply})
    return reply
