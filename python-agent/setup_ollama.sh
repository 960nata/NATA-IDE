#!/bin/bash

# setup_ollama.sh
# Script untuk setup Ollama dan menjalankan model Gemma 4 dengan aman di MacBook Air.

echo "============================================="
echo "   Ollama & Gemma 4 Setup for MacBook Air   "
echo "============================================="

# 1. Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✓ Ollama sudah terinstall."
else
    echo "🔍 Ollama belum terinstall atau tidak ada di PATH."
    
    # Check if Ollama.app exists in /Applications
    if [ -d "/Applications/Ollama.app" ]; then
        echo "✓ Aplikasi Ollama ditemukan di /Applications."
        echo "Menambahkan Ollama ke PATH..."
        # Add Ollama binary path inside the app to search path
        export PATH="$PATH:/Applications/Ollama.app/Contents/Resources"
        # Make it permanent in ~/.zshrc if not already there
        if ! grep -q "Ollama.app" ~/.zshrc; then
            echo '' >> ~/.zshrc
            echo '# Ollama PATH' >> ~/.zshrc
            echo 'export PATH="$PATH:/Applications/Ollama.app/Contents/Resources"' >> ~/.zshrc
            echo "✓ PATH Ollama telah ditambahkan ke ~/.zshrc."
        fi
    else
        # Try installing via Homebrew
        if command -v brew &> /dev/null; then
            echo "Menginstall Ollama menggunakan Homebrew..."
            brew install ollama
        else
            echo "❌ Homebrew tidak ditemukan."
            echo "Silakan unduh dan install Ollama manual dari: https://ollama.com/download"
            exit 1
        fi
    fi
fi

# Double check if ollama is available now
if ! command -v ollama &> /dev/null; then
    # Try using the Homebrew path explicitly
    if [ -f "/opt/homebrew/bin/ollama" ]; then
        export PATH="$PATH:/opt/homebrew/bin"
    else
        echo "❌ Ollama gagal diaktifkan. Silakan buka aplikasi Ollama secara manual di folder Applications terlebih dahulu."
        exit 1
    fi
fi

echo "✓ Ollama aktif!"
echo ""
echo "⚠️ PERINGATAN MEMORI (MacBook Air):"
echo "Menjalankan model 12B (gemma4:12b) membutuhkan sekitar 8-12 GB RAM."
echo "Pada MacBook Air (terutama versi RAM 8GB atau 16GB), menjalankan model 12B"
echo "dapat menyebabkan swapping ke SSD yang membuat sistem hang, lag berat, atau freeze ('nge-frish')."
echo ""
echo "Sangat disarankan menggunakan model Edge yang dioptimalkan untuk laptop:"
echo "1. gemma4:e4b (4 Billion parameters - Sangat direkomendasikan, cerdas & ringan)"
echo "2. gemma4:e2b (2 Billion parameters - Super cepat, sangat hemat memori)"
echo ""
echo "Pilihlah model yang ingin Anda jalankan:"
echo "1) gemma4:e4b (Rekomendasi Laptop/MacBook Air)"
echo "2) gemma4:e2b (Paling Ringan & Cepat)"
echo "3) gemma4:12b (Ukuran Besar - Berisiko membuat Mac freeze jika RAM < 16GB)"
read -p "Masukkan pilihan (1/2/3): " choice

case $choice in
    1)
        MODEL="gemma4:e4b"
        ;;
    2)
        MODEL="gemma4:e2b"
        ;;
    3)
        MODEL="gemma4:12b"
        echo "⚠️ Anda memilih 12B. Jika Mac Anda mulai freeze/lambat, tekan Ctrl+C untuk menghentikan."
        ;;
    *)
        echo "Pilihan tidak valid, menggunakan model rekomendasi: gemma4:e4b"
        MODEL="gemma4:e4b"
        ;;
esac

echo ""
echo "Menjalankan perintah: ollama run $MODEL"
echo "Silakan tunggu proses download jika model belum ada..."
ollama run $MODEL
