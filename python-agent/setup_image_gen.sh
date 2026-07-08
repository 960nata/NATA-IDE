#!/usr/bin/env bash
# setup_image_gen.sh — install deps buat generate gambar lokal (SD).
# Jalanin SEKALI dari folder python-agent/:
#   bash setup_image_gen.sh
#
# torch untuk Apple Silicon (MPS) = PyTorch biasa, MPS support built-in >= 1.12.
# Download total ~2-3GB (torch + diffusers). Dilakukan cuma sekali.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/venv"

if [ ! -d "$VENV" ]; then
  echo "❌ Venv belum ada. Jalanin dulu: python3 -m venv venv"
  exit 1
fi

echo "📦 Install torch (Apple Silicon / MPS) ..."
"$VENV/bin/pip" install --upgrade pip

# Cek arsitektur
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  echo "✅ Apple Silicon terdeteksi — torch dengan MPS"
  "$VENV/bin/pip" install torch torchvision torchaudio
else
  echo "⚠️  Intel Mac — MPS tidak tersedia, akan pakai CPU (lebih lambat)"
  "$VENV/bin/pip" install torch torchvision torchaudio
fi

echo "📦 Install diffusers + deps ..."
"$VENV/bin/pip" install "diffusers>=0.28.0" "transformers>=4.36.0" "accelerate>=0.24.0" Pillow

echo ""
echo "✅ Selesai! Gambar AI siap dipakai via Nata IDE."
echo "   Model Stable Diffusion bakal di-download otomatis saat pertama kali generate."
echo "   (~1.7GB, disimpen di ~/.cache/huggingface)"
