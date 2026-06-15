// ============================================================
// CHATBOT AI BPBD KOTA BITUNG
// Server utama - Hubungkan WhatsApp (Fonnte) + Gemini AI
// ============================================================

const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── KONFIGURASI (isi sesuai akun Anda) ──────────────────────
const CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AQ.Ab8RN6IrpC4NE3NDtR0zuvxeWyt9Kux0DB861Tl5Xr92rtZI_Q",
  FONNTE_TOKEN:   process.env.FONNTE_TOKEN   || "FV1WnFQpvoKs6vGJmtqN",
  PORT:           process.env.PORT           || 3000,
};
// ────────────────────────────────────────────────────────────

// Riwayat percakapan per nomor HP (disimpan sementara di memori)
const riwayatPercakapan = {};

// ── SISTEM PENGETAHUAN BPBD BITUNG ──────────────────────────
const SYSTEM_PROMPT = `Kamu adalah asisten AI resmi BPBD (Badan Penanggulangan Bencana Daerah) Kota Bitung, Sulawesi Utara.

IDENTITAS:
- Nama: Siaga (Sistem Informasi AI Gerak cepAt BPBD Bitung)
- Bahasa: Indonesia yang ramah, jelas, dan mudah dipahami
- Sifat: Sigap, empati, informatif, dan tenang dalam keadaan darurat

WILAYAH RAWAN BENCANA KOTA BITUNG:
- Gunung berapi: Gunung Lokon (Tomohon dekat Bitung), Gunung Klabat
- Tsunami: Pesisir Lembeh, Aertembaga, Madidir, Girian
- Banjir: Matuari, Ranowangko, DAS Girian
- Longsor: Daerah perbukitan Matuari dan Girian Atas
- Abrasi pantai: Pesisir Barat dan Selatan Lembeh
- Gempa bumi: Seluruh wilayah (zona aktif Cincin Api Pasifik)

JALUR EVAKUASI UTAMA:
- Kecamatan Lembeh Utara: Titik kumpul Lapangan Paal 2, evakuasi ke daratan via kapal
- Kecamatan Lembeh Selatan: Titik kumpul depan Kantor Kecamatan Lembeh Selatan
- Kecamatan Madidir: Titik kumpul GOR Bitung, evakuasi ke Jalan Ring Road
- Kecamatan Aertembaga: Titik kumpul Lapangan Aertembaga, evakuasi ke Jalan Trans Sulawesi
- Kecamatan Matuari: Titik kumpul SD Negeri 1 Matuari, evakuasi ke Jalan Utama Bitung
- Kecamatan Girian: Titik kumpul Lapangan Girian, evakuasi ke Jalan Nasional
- Kecamatan Ranowangko: Titik kumpul Kantor Kecamatan Ranowangko
- Kecamatan Pateten: Titik kumpul Lapangan Pateten, evakuasi ke RSUD Bitung

KONTAK DARURAT BPBD BITUNG:
- Emergency 24 jam: 112

STATUS SIAGA:
- SIAGA 1 (Merah): Bencana sedang terjadi — SEGERA EVAKUASI
- SIAGA 2 (Oranye): Ancaman tinggi — Bersiap evakuasi
- SIAGA 3 (Kuning): Waspada — Pantau informasi terus
- SIAGA 4 (Hijau): Normal — Tetap waspada

PROSEDUR LAPORAN BENCANA DARI WARGA:
Ketika warga melaporkan bencana, tanyakan:
1. Lokasi kejadian (kecamatan/kelurahan/RT/RW)
2. Jenis bencana (banjir/longsor/kebakaran/lainnya)
3. Jumlah korban/terdampak jika ada
4. Kondisi akses jalan
5. Nomor HP yang bisa dihubungi

PESAN DARURAT:
- Jika ada korban jiwa → langsung sarankan hubungi 112
- Jika bencana besar → berikan instruksi evakuasi sesuai kecamatan
- Selalu akhiri dengan menawarkan bantuan lebih lanjut

INFORMASI UMUM KEBENCANAAN:
- Cara menghadapi gempa: berlindung di bawah meja, jauhi jendela, keluar setelah guncangan berhenti
- Cara menghadapi tsunami: lari ke tempat tinggi setelah gempa kuat, jangan tunggu peringatan
- Cara menghadapi banjir: matikan listrik, bawa dokumen penting, evakuasi ke titik kumpul
- Cara menghadapi longsor: hindari lereng bukit saat hujan deras, perhatikan retakan tanah
- Cara menghadapi kebakaran: hubungi damkar 113, jangan masuk kembali ke bangunan terbakar

ATURAN RESPONS:
1. Selalu jawab dalam Bahasa Indonesia
2. Untuk keadaan darurat, UTAMAKAN instruksi keselamatan
3. Berikan nomor darurat yang relevan
4. Jika tidak tahu informasi spesifik, akui dan sarankan hubungi posko
5. Respons maksimal 3 paragraf agar mudah dibaca di WhatsApp
6. Gunakan emoji secukupnya untuk memperjelas (⚠️ 🆘 📍 📞)`;

// ── ENDPOINT WEBHOOK DARI FONNTE ────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const { sender, message, device } = req.body;

    if (!sender || !message) {
      return res.json({ status: "ok", info: "pesan kosong diabaikan" });
    }

    console.log(`[${new Date().toLocaleString("id-ID")}] Pesan dari ${sender}: ${message}`);

    // Inisialisasi riwayat jika belum ada
    if (!riwayatPercakapan[sender]) {
      riwayatPercakapan[sender] = [];
    }

    // Tambahkan pesan user ke riwayat
    riwayatPercakapan[sender].push({
      role: "user",
      parts: [{ text: message }],
    });

    // Batasi riwayat 10 pesan terakhir agar tidak terlalu panjang
    if (riwayatPercakapan[sender].length > 20) {
      riwayatPercakapan[sender] = riwayatPercakapan[sender].slice(-20);
    }

    // Kirim ke Gemini AI
    const balasan = await tanyaGemini(sender, message);

    // Tambahkan balasan AI ke riwayat
    riwayatPercakapan[sender].push({
      role: "model",
      parts: [{ text: balasan }],
    });

    // Kirim balasan ke WhatsApp via Fonnte
    await kirimPesanWhatsApp(sender, balasan);

    // Simpan log laporan ke console (bisa diganti database)
    if (isLaporanBencana(message)) {
      console.log(`[LAPORAN BENCANA] dari ${sender}: ${message}`);
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Error webhook:", error.message);
    res.json({ status: "error", message: error.message });
  }
});

// ── FUNGSI TANYA GEMINI AI ───────────────────────────────────
async function tanyaGemini(sender, pesanBaru) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  // Bangun riwayat percakapan untuk konteks
  const contents = riwayatPercakapan[sender] || [];

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const response = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
  });

  const teks = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return teks || "Maaf, sistem sedang terganggu. Hubungi posko BPBD di 112 untuk keadaan darurat.";
}

// ── FUNGSI KIRIM PESAN VIA FONNTE ───────────────────────────
async function kirimPesanWhatsApp(nomor, pesan) {
  await axios.post(
    "https://api.fonnte.com/send",
    { target: nomor, message: pesan, countryCode: "62" },
    { headers: { Authorization: CONFIG.FONNTE_TOKEN }, timeout: 15000 }
  );
}

// ── DETEKSI LAPORAN BENCANA ──────────────────────────────────
function isLaporanBencana(pesan) {
  const kataKunci = ["banjir", "longsor", "gempa", "tsunami", "kebakaran", "korban", "darurat", "tolong", "help", "bencana"];
  return kataKunci.some((k) => pesan.toLowerCase().includes(k));
}

// ── HALAMAN UTAMA (CEK STATUS SERVER) ───────────────────────
app.get("/", (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
    <h2>🆘 Chatbot AI BPBD Kota Bitung</h2>
    <p>Status: <b style="color:green">✅ Aktif</b></p>
    <p>Waktu server: ${new Date().toLocaleString("id-ID")}</p>
    <hr>
    <p>Webhook URL: <code>${process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "http://localhost:" + CONFIG.PORT}/webhook</code></p>
    <p>Salin URL di atas ke pengaturan Fonnte Anda.</p>
    </body></html>
  `);
});

// ── JALANKAN SERVER ──────────────────────────────────────────
app.listen(CONFIG.PORT, () => {
  console.log(`✅ Server BPBD Bitung aktif di port ${CONFIG.PORT}`);
  console.log(`📡 Webhook: http://localhost:${CONFIG.PORT}/webhook`);
});
