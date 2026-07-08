# ⌁ Nata IDE

**Asisten AI lokal serbaguna untuk macOS — coding, gambar, dokumen, web scraping, sampai alarm & agenda. 100% jalan di laptop kamu, tanpa cloud, tanpa biaya API.**

Ditenagai [Ollama](https://ollama.com) dengan model lokal (default: `qwen3:4b-instruct`). AI-nya nyala pas app dibuka, di-unload dari RAM pas app ditutup — hemat baterai & memori, aman buat MacBook 8 GB.

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-lokal-000000?logo=ollama&logoColor=white)
![Platform](https://img.shields.io/badge/macOS-Apple%20Silicon-999999?logo=apple&logoColor=white)

---

## ✨ 6 Mode, 1 App

Tiap mode punya workspace, chat, dan tampilan sendiri — **hasil di kiri, chat AI di kanan**:

| Mode | Fungsi |
|---|---|
| 👨‍💻 **Programmer IDE** | Editor Monaco multi-tab + terminal + AI agent yang nulis, ngedit, & jalanin kode. Git panel, diagnostics (ESLint/tsc), diff ala Cursor, browser preview, tab-autocomplete AI |
| 🖼️ **Studio Gambar** | Resize, konversi format, OCR (baca teks dari gambar), sampai generate gambar AI (Stable Diffusion). Galeri hasil live di panel kiri |
| 🌐 **Web Scraper** | Ambil isi halaman web + rangkum otomatis pakai AI. Hasil bisa disimpan jadi `.md` |
| 📄 **Generator Dokumen** | Word, PDF, & PowerPoint dari satu perintah chat — isi dokumennya dikarang AI |
| 🔔 **Alarm & Agenda** | Sekretaris pribadi: alarm jam pasti (`15:00`), berulang harian, **persist antar-restart**, plus to-do list yang dikelola bareng AI |
| 💻 **Terminal AI** | Tanya apa aja, AI jalanin perintah shell & jelasin hasilnya. Konsol output live di panel kiri |

## 🧠 Fitur AI

- **Agent loop otonom** — AI baca workspace → rencana kerja (checklist) → eksekusi tool → cek hasil → perbaiki sendiri sampai beres
- **Anti-halu / anti-bohong** — klaim "server jalan" diverifikasi dengan probe port beneran; klaim palsu diganti laporan jujur otomatis
- **Memory pengguna global** — ketik `ingat: aku suka jawaban singkat` di chat mana pun → AI inget di semua mode (`~/.nata/user-memory.md`), plus auto-belajar kebiasaan kamu dari tiap tugas
- **Chat multi-tab per mode** — tiap mode punya riwayat chat sendiri-sendiri
- **Tim AI opsional** — 1 model main 3 peran: Arsitek → Coder → QA reviewer
- **Mode Eco** — hemat RAM/baterai buat laptop 8 GB (default ON)
- **Skills** — tambah kemampuan AI via file markdown, ala Claude Skills

## 🚀 Cara Jalanin

**Prasyarat:** macOS Apple Silicon, [Node.js](https://nodejs.org) ≥ 20, [Ollama](https://ollama.com/download).

```bash
# 1. Pull model AI-nya
ollama pull qwen3:4b-instruct

# 2. Install dependensi
npm install

# 3a. Mode development (hot-reload)
npm run dev          # terminal 1 — Vite dev server
npm start            # terminal 2 — Electron

# 3b. Atau build jadi app macOS (.dmg)
npm run dist         # hasil di dist-electron/
```

> Fitur generate gambar (Stable Diffusion) butuh setup Python terpisah: `cd python-agent && bash setup_image_gen.sh`

## 🏗️ Arsitektur

```
main.js            → proses utama Electron: lifecycle Ollama, IPC, terminal, git, watcher
agent-tools.js     → registry tools AI: dokumen, gambar/OCR, scrape, alarm+agenda (persist), fs
preload.js         → jembatan IPC yang aman (contextBridge)
src/
  App.jsx          → shell app: routing mode, layout, chat tabs per mode, status bar
  components/
    ChatAgent.jsx    → otak agent: prompt per mode, agent loop, parser tool, verifikasi klaim
    ModeWorkspace.jsx→ panel hasil per mode (galeri/dokumen/scrape/alarm/konsol)
    CodeEditor.jsx   → Monaco + autocomplete AI + diagnostics
    ...
python-agent/      → subprocess Python buat generate gambar (diffusers/MPS)
```

**Prinsip desain:** local-first (semua data & AI di mesin sendiri), model kecil dikawal ketat (guardrail verifikasi > percaya omongan model), tiap mode tampil sesuai fungsinya.

## 📦 Data & Privasi

Semua tersimpan lokal: alarm & agenda di `~/.nata/`, memory AI di `~/.nata/user-memory.md`, hasil kerja mode di `~/Nata/<Nama Mode>/`. Tidak ada data yang keluar dari laptop kamu (akses web cuma pas kamu suruh scrape/search).

## Lisensi

MIT
