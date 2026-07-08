#!/bin/bash

# setup_ollama_auto.sh
# Otomatis install, jalankan, dan pantau Ollama + Gemma 4 Edge (gemma4:e4b)

echo "=== Memulai Setup Ollama Otomatis ==="

# Load Homebrew environment if it exists
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -f "/usr/local/bin/brew" ]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# 1. Cek apakah Ollama terinstall di /Applications atau PATH
OLLAMA_PATH=""

if command -v ollama &> /dev/null; then
    OLLAMA_PATH="ollama"
    echo "✓ Ollama CLI ditemukan di PATH."
elif [ -d "/Applications/Ollama.app" ]; then
    echo "✓ Aplikasi Ollama.app ditemukan di /Applications."
    export PATH="$PATH:/Applications/Ollama.app/Contents/Resources"
    OLLAMA_PATH="/Applications/Ollama.app/Contents/Resources/ollama"
    
    # Tambahkan permanen ke ~/.zshrc jika belum ada
    if ! grep -q "Ollama.app" ~/.zshrc; then
        echo '' >> ~/.zshrc
        echo '# Ollama PATH' >> ~/.zshrc
        echo 'export PATH="$PATH:/Applications/Ollama.app/Contents/Resources"' >> ~/.zshrc
        echo "✓ PATH Ollama ditambahkan ke ~/.zshrc."
    fi
else
    # Jika tidak ada, coba install via Brew Cask (agar akselerasi GPU Apple Silicon aktif)
    if command -v brew &> /dev/null; then
        echo "Menginstall Ollama via Homebrew Cask..."
        brew install --cask ollama
        export PATH="$PATH:/Applications/Ollama.app/Contents/Resources"
        OLLAMA_PATH="/Applications/Ollama.app/Contents/Resources/ollama"
    else
        echo "❌ Homebrew tidak ditemukan dan Ollama.app tidak ada di /Applications."
        echo "Silakan download manual dari https://ollama.com/download"
        exit 1
    fi
fi

# 2. Cek apakah Ollama App sedang berjalan
echo "Memeriksa status server Ollama..."
if ! curl -s http://localhost:11434 &> /dev/null; then
    echo "Server Ollama belum berjalan. Menjalankan Ollama.app..."
    open -a Ollama
    
    # Tunggu sampai server aktif (maksimal 30 detik)
    echo "Menunggu server Ollama aktif..."
    for i in {1..30}; do
        if curl -s http://localhost:11434 &> /dev/null; then
            echo "✓ Server Ollama berhasil aktif!"
            break
        fi
        sleep 1
    done
else
    echo "✓ Server Ollama sudah aktif."
fi

# Pastikan server benar-benar aktif
if ! curl -s http://localhost:11434 &> /dev/null; then
    echo "❌ Gagal mengaktifkan server Ollama. Silakan jalankan aplikasi Ollama manual."
    exit 1
fi

# 3. Pull model gemma4:e4b (4B - Edge model) yang aman untuk MacBook Air agar tidak freeze
echo "Menarik (pull) model gemma4:e4b (4B - Direkomendasikan untuk MacBook Air)..."
ollama pull gemma4:e4b

# 4. Verifikasi instalasi model
echo "Memeriksa daftar model..."
ollama list

echo "=== Setup Selesai! ==="
echo "Model gemma4:e4b siap digunakan."
