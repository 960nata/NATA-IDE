"""registry.py — kumpulin semua tool dari folder tools/."""

from tools import docs

# Modul tool yang aktif. Nanti tinggal tambah: scraper, coding, image, alarm.
_MODULES = [docs]

ALL_TOOLS = {}
for module in _MODULES:
    for spec in module.TOOLS:
        ALL_TOOLS[spec["name"]] = spec


def tool_list_for_prompt():
    """Teks daftar tool buat dimasukin ke system prompt."""
    lines = []
    for name, spec in ALL_TOOLS.items():
        lines.append(f"- {name}: {spec['description']}\n  args: {spec['params']}")
    return "\n".join(lines)
