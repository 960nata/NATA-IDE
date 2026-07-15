import fs from 'fs';
import path from 'path';
import axios from 'axios';

const NATA_HOME_DIR = path.join(process.env.HOME || process.cwd(), '.nata');
const DB_FILE = path.join(NATA_HOME_DIR, 'learning-hub.json');
const GLOBAL_LESSONS_FILE = path.join(NATA_HOME_DIR, 'learning-lessons.md');

// Default database structure
const DEFAULT_DB = {
  stats: {
    totalLearned: 0,
    streak: 0,
    lastLearnedDate: null, // YYYY-MM-DD
    lastFetchedDate: null
  },
  queue: [],
  learned: []
};

// Helper: Membaca database JSON
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);
    return {
      stats: { ...DEFAULT_DB.stats, ...(db.stats || {}) },
      queue: db.queue || [],
      learned: db.learned || []
    };
  } catch (err) {
    console.error('Gagal membaca DB learning-hub:', err);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

// Helper: Menulis database JSON
function writeDb(data) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Gagal menulis DB learning-hub:', err);
    return false;
  }
}

// Format tanggal ke YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// Cek apakah dua string tanggal adalah hari yang berurutan
function isYesterday(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

// 1. Ambil data database lengkap
export async function getHubData() {
  const db = readDb();
  return db;
}

// Helper: Membersihkan tag HTML dari Stack Overflow API dan mengubah ke Markdown sederhana
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<[^>]+>/g, '') // Hapus sisa tag HTML
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n+/g, '\n\n') // Satukan baris kosong berlebih
    .trim();
}

// 2. Tarik materi dari Dev.to dan Stack Overflow API
export async function fetchMaterials() {
  const db = readDb();
  const today = getTodayString();

  try {
    // 10 artikel programming populer dan 10 artikel debugging
    const urls = [
      'https://dev.to/api/articles?tag=programming&per_page=10',
      'https://dev.to/api/articles?tag=debugging&per_page=10'
    ];

    let newCount = 0;
    const existingIds = new Set([
      ...db.queue.map(item => item.id),
      ...db.learned.map(item => item.queueId || item.id)
    ]);

    // 1. Tarik dari Dev.to
    for (const url of urls) {
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) NataIDE/1.0' }
        });

        if (Array.isArray(response.data)) {
          for (const article of response.data) {
            const id = `devto_${article.id}`;
            if (!existingIds.has(id)) {
              db.queue.push({
                id,
                devtoId: article.id,
                title: article.title,
                url: article.url,
                source: 'Dev.to',
                description: article.description || article.body_markdown?.slice(0, 200) || 'Tidak ada deskripsi.',
                tags: article.tag_list || [],
                fetchedAt: Date.now(),
                status: 'pending'
              });
              existingIds.add(id);
              newCount++;
            }
          }
        }
      } catch (err) {
        console.warn('Gagal menarik materi dari Dev.to:', err.message);
      }
    }

    // 2. Tarik dari Stack Overflow
    try {
      const soUrl = 'https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&tagged=javascript;debugging&site=stackoverflow&filter=!20aKG._8Oscv*6djs8Pgm&pagesize=10';
      const response = await axios.get(soUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) NataIDE/1.0' }
      });

      if (response.data && Array.isArray(response.data.items)) {
        for (const question of response.data.items) {
          const id = `stackoverflow_${question.question_id}`;
          if (!existingIds.has(id)) {
            // Temukan jawaban terbaik
            let bestAnswer = null;
            if (Array.isArray(question.answers) && question.answers.length > 0) {
              bestAnswer = question.answers.find(a => a.is_accepted) || 
                           question.answers.sort((a, b) => b.score - a.score)[0];
            }

            // Susun deskripsi lengkap berisi pertanyaan dan jawaban terbaik
            let description = `### PERTANYAAN (BUG REPORT)\n\n${cleanHtml(question.body)}\n\n`;
            if (bestAnswer) {
              description += `### JAWABAN TERBAIK (SOLUSI)\n\n${cleanHtml(bestAnswer.body)}\n`;
            } else {
              description += `### JAWABAN TERBAIK (SOLUSI)\n\n(Tidak ada jawaban yang tersedia)\n`;
            }

            db.queue.push({
              id,
              soId: question.question_id,
              title: question.title,
              url: question.link,
              source: 'StackOverflow',
              description: description.slice(0, 4000), // Batasi ukuran konten
              tags: question.tags || [],
              fetchedAt: Date.now(),
              status: 'pending'
            });
            existingIds.add(id);
            newCount++;
          }
        }
      }
    } catch (err) {
      console.warn('Gagal menarik materi dari Stack Overflow:', err.message);
    }

    db.stats.lastFetchedDate = today;
    writeDb(db);

    return `🎉 Berhasil menarik ${newCount} materi belajar pemrograman baru!`;
  } catch (err) {
    throw new Error(`Koneksi internet bermasalah atau API rate limit: ${err.message}`);
  }
}

// 3. AI mempelajari satu item
export async function learnItem({ id, modelHost = 'http://localhost:11434', modelName = 'qwen3:4b-instruct' }) {
  const db = readDb();
  let item = null;

  if (id) {
    item = db.queue.find(q => q.id === id);
  } else {
    item = db.queue.find(q => q.status === 'pending');
  }

  if (!item) {
    // Jika kosong, berikan fallback lokal agar AI tetap bisa belajar offline
    item = {
      id: `fallback_${Date.now()}`,
      title: 'Optimal JavaScript Array Manipulations & Performance Tips',
      url: 'https://dev.to/nata_hub/optimal-js-arrays',
      source: 'Nata Hub Local',
      description: 'Reviewing performance bottlenecks in JavaScript array methods such as map, filter, and reduce vs traditional for loops in critical paths.',
      tags: ['javascript', 'performance'],
      fetchedAt: Date.now(),
      status: 'pending',
      isFallback: true
    };
  }

  // Jika item adalah item nyata di queue, tandai 'learning'
  if (!item.isFallback) {
    item.status = 'learning';
    writeDb(db);
  }

  let articleBody = item.description;

  // Jika online dan merupakan artikel Dev.to, coba ambil detail artikel lengkapnya
  if (item.devtoId && !item.isFallback) {
    try {
      const detailRes = await axios.get(`https://dev.to/api/articles/${item.devtoId}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) NataIDE/1.0' }
      });
      if (detailRes.data && detailRes.data.body_markdown) {
        // Potong ke 4000 karakter agar model tidak kehabisan RAM/konteks
        articleBody = detailRes.data.body_markdown.slice(0, 4000);
      }
    } catch (e) {
      console.warn('Gagal memuat detail artikel Dev.to, fallback ke deskripsi:', e.message);
    }
  }

  // Siapkan prompt instruksi untuk Ollama
  const prompt = `Analisis artikel pemrograman berikut ini:
Judul: ${item.title}
Sumber: ${item.source}
Tag: ${(item.tags || []).join(', ')}
Konten:
${articleBody}

Kamu harus mengekstrak:
1. Pelajaran inti (solusi bug, trik pengkodean, standar arsitektur baru, atau tips performa).
2. Contoh kode konkret yang mendemonstrasikan trik atau perbaikan bug tersebut. Buatlah perbandingan kode (contoh: cara lama yang lambat/bug vs cara baru yang optimal/aman).
3. Kategori singkat (misal: "JavaScript", "Security", "React", "CSS").
4. Rangkuman 1 baris pelajaran (maksimal 90 karakter) yang sangat spesifik dan aplikatif.

Jawab HANYA dengan format JSON yang valid (tanpa teks penjelasan lain di luar JSON):
{
  "lesson": "penjelasan detail pelajaran/solusi di sini",
  "codeTrick": "// Kode Contoh\\nconst oldWay = ...;\\n\\n// Kode Baru yang Dipelajari\\nconst newWay = ...;",
  "category": "Kategori",
  "summary": "Rangkuman 1 baris yang padat dan konkret"
}`;

  try {
    const response = await axios.post(`${modelHost}/api/chat`, {
      model: modelName,
      messages: [
        { role: 'system', content: 'Kamu adalah Nata Pembelajar — asisten yang ahli menyarikan teknik coding berkualitas tinggi dari artikel teknis menjadi berkas JSON.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 1536, // Dioptimalkan ke 1536 agar model 4B + KV cache muat penuh di GPU M1 tanpa tumpah ke CPU/SSD swap
        num_predict: 512, // Membatasi output JSON pelajaran agar proses regenerasi sangat singkat
        num_thread: 4 // Batasi thread CPU jika terjadi fallback memori
      }
    }, { timeout: 120000 });

    if (!response.data || !response.data.message?.content) {
      throw new Error('Ollama membalas dengan konten kosong.');
    }

    const reply = response.data.message.content;
    let learnedData = null;

    // Bersihkan code fences dan cari JSON
    try {
      const cleanReply = reply.replace(/```(?:json)?/gi, '').trim();
      const match = cleanReply.match(/\{[\s\S]*\}/);
      if (match) {
        learnedData = JSON.parse(match[0]);
      } else {
        learnedData = JSON.parse(cleanReply);
      }
    } catch (parseErr) {
      console.warn('Gagal parse JSON dari Ollama, fallback ke penyaringan regex:', parseErr);
      // Fallback manual parsing jika model gagal JSON
      learnedData = {
        lesson: reply.slice(0, 300),
        codeTrick: '// Kode trik tidak terparse',
        category: (item.tags && item.tags[0]) || 'General',
        summary: item.title.slice(0, 80)
      };
    }

    const today = getTodayString();
    
    // Hitung streak belajar
    let streak = db.stats.streak || 0;
    if (db.stats.lastLearnedDate === today) {
      // Sudah belajar hari ini, streak tetap
    } else if (isYesterday(db.stats.lastLearnedDate, today)) {
      streak += 1;
    } else {
      streak = 1; // reset streak atau mulai baru
    }

    // Buat objek pelajaran terdaftar
    const newLearn = {
      id: `learn_${Date.now()}`,
      queueId: item.isFallback ? null : item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      learnedAt: Date.now(),
      lesson: learnedData.lesson || 'Tidak ada penjelasan rinci.',
      codeTrick: learnedData.codeTrick || '',
      category: learnedData.category || 'Programming',
      summary: learnedData.summary || item.title
    };

    // Update database
    db.learned.push(newLearn);
    db.stats.totalLearned += 1;
    db.stats.streak = streak;
    db.stats.lastLearnedDate = today;

    // Hapus atau tandai learned di queue
    if (!item.isFallback) {
      const qIndex = db.queue.findIndex(q => q.id === item.id);
      if (qIndex !== -1) {
        db.queue[qIndex].status = 'learned';
      }
    }

    writeDb(db);

    // Tulis pelajaran ke berkas ingatan global (~/.nata/learning-lessons.md)
    try {
      fs.mkdirSync(NATA_HOME_DIR, { recursive: true });
      fs.appendFileSync(GLOBAL_LESSONS_FILE, `- ${newLearn.summary} (${newLearn.category})\n`, 'utf-8');
    } catch (e) {
      console.error('Gagal menulis ke lessons global:', e);
    }

    return {
      success: true,
      message: `🎯 Sukses belajar! Pelajaran baru: "${newLearn.summary}"`,
      data: newLearn
    };

  } catch (err) {
    // Reset status item jika gagal agar bisa dicoba lagi
    if (!item.isFallback) {
      const qIndex = db.queue.findIndex(q => q.id === item.id);
      if (qIndex !== -1) {
        db.queue[qIndex].status = 'pending';
        writeDb(db);
      }
    }
    throw new Error(`AI Gagal mempelajari artikel ini: ${err.message}`);
  }
}

// 4. Pengguna menambahkan materi belajar sendiri secara manual
export async function addCustomItem({ title, content, url }) {
  if (!title || !content) throw new Error('Butuh "title" dan "content".');
  const db = readDb();
  const id = `custom_${Date.now()}`;
  db.queue.push({
    id,
    title,
    url: url || '',
    source: 'Custom User',
    description: content,
    tags: ['custom'],
    fetchedAt: Date.now(),
    status: 'pending'
  });
  writeDb(db);
  return `📥 Berhasil menambahkan materi belajar buatan Anda ke antrean: "${title}"`;
}

// 5. Mengambil daftar pelajaran terbaru untuk diinjeksi ke system prompt
export async function getRecentLessons() {
  try {
    const db = readDb();
    if (!db.learned || db.learned.length === 0) return '';
    // Ambil 8 pelajaran terbaru
    const recent = db.learned.slice(-8).reverse();
    return recent.map((l, idx) => `${idx + 1}. [Kategori: ${l.category}] ${l.summary}\nTrik: ${l.codeTrick.slice(0, 150)}`).join('\n\n');
  } catch (e) {
    return '';
  }
}
