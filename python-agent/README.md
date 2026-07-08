# 🤖 Asisten AI Pribadi (lokal, pakai Gemma 4)

Asisten AI ala Claude tapi jalan **offline** di MacBook lewat Ollama + Gemma 4.
Otaknya Gemma, kemampuannya nambah lewat **tools** (fungsi Python).

## Status fitur
- [x] **Tahap 0** — Otak + agent + chat di terminal
- [x] **Tahap 1** — Bikin dokumen: Word, PDF, PowerPoint
- [ ] Tahap 2 — Scraping internet
- [ ] Tahap 3 — Coding & testing
- [ ] Tahap 4 — Gambar
- [ ] Tahap 5 — Alarm

## Cara jalanin
```bash
# 1. Pastiin Ollama nyala (buka app Ollama, atau:)
ollama serve

# 2. Install dependensi (sekali aja)
pip install -r requirements.txt

# 3. Jalanin
python main.py
```

Contoh ngobrol:
- "Buatin dokumen Word judulnya Proposal Usaha, isinya 3 paragraf tentang jualan kopi."
- "Bikin presentasi PowerPoint 3 slide tentang manfaat olahraga."

File hasil masuk ke folder `workspace/`.

## Struktur
```
main.py          # chat loop
core/brain.py    # koneksi ke Ollama
core/agent.py    # loop mikir → pilih tool → eksekusi
core/registry.py # daftar tool
tools/docs.py    # tool Word/PDF/PowerPoint
workspace/       # output file
```
