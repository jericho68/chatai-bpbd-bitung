// ============================================================
// CHATBOT AI BPBD KOTA BITUNG — Cloudflare Workers Version
// Paste kode ini di editor Cloudflare Workers
// Tidak perlu install apapun!
// ============================================================

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
- Kec. Lembeh Utara: Titik kumpul Lapangan Paal 2, evakuasi ke daratan via kapal
- Kec. Lembeh Selatan: Titik kumpul depan Kantor Kecamatan Lembeh Selatan
- Kec. Madidir: Titik kumpul GOR Bitung, evakuasi ke Jalan Ring Road
- Kec. Aertembaga: Titik kumpul Lapangan Aertembaga, evakuasi ke Jalan Trans Sulawesi
- Kec. Matuari: Titik kumpul SD Negeri 1 Matuari, evakuasi ke Jalan Utama Bitung
- Kec. Girian: Titik kumpul Lapangan Girian, evakuasi ke Jalan Nasional
- Kec. Ranowangko: Titik kumpul Kantor Kecamatan Ranowangko
- Kec. Pateten: Titik kumpul Lapangan Pateten, evakuasi ke RSUD Bitung

KONTAK DARURAT:
- Emergency 24 jam: 112
- Posko BPBD Bitung: (0438) 21XXX
- Damkar Bitung: 113
- RSUD Bitung: (0438) 21XXX
- Polres Bitung: (0438) 21XXX
- Basarnas Sulut: (0431) 860XXX
- BMKG Manado: (0431) 860XXX

STATUS SIAGA:
- SIAGA 1 (Merah): Bencana sedang terjadi — SEGERA EVAKUASI
- SIAGA 2 (Oranye): Ancaman tinggi — Bersiap evakuasi
- SIAGA 3 (Kuning): Waspada — Pantau informasi terus
- SIAGA 4 (Hijau): Normal — Tetap waspada

PROSEDUR LAPORAN BENCANA:
Ketika warga melaporkan bencana, tanyakan:
1. Lokasi (kecamatan/kelurahan/RT/RW)
2. Jenis bencana
3. Jumlah korban/terdampak
4. Kondisi akses jalan
5. Nomor HP yang bisa dihubungi

PANDUAN KEBENCANAAN:
- Gempa: berlindung di bawah meja, jauhi jendela, keluar setelah guncangan berhenti
- Tsunami: lari ke tempat tinggi setelah gempa kuat, JANGAN tunggu peringatan
- Banjir: matikan listrik, bawa dokumen penting, evakuasi ke titik kumpul
- Longsor: hindari lereng bukit saat hujan deras, perhatikan retakan tanah
- Kebakaran: hubungi 113, jangan masuk kembali ke bangunan terbakar

ATURAN RESPONS:
1. Untuk keadaan darurat, UTAMAKAN instruksi keselamatan dan nomor 112
2. Respons maksimal 3 paragraf (agar nyaman dibaca di WhatsApp)
3. Gunakan emoji secukupnya: ⚠️ 🆘 📍 📞
4. Jika tidak tahu, akui dan sarankan hubungi posko`;

// Simpan riwayat percakapan sementara (per sesi Worker)
const riwayat = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Halaman status
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(halamanStatus(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Webhook dari Fonnte
    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    return new Response("BPBD Bitung Chatbot - OK", { status: 200 });
  },
};

async function handleWebhook(request, env) {
  try {
    let data;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      data = Object.fromEntries(params);
    }

    const sender  = data.sender  || data.from || "";
    const message = data.message || data.text  || "";

    if (!sender || !message) {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Pesan dari ${sender}: ${message}`);

    // Ambil/buat riwayat percakapan
    if (!riwayat.has(sender)) riwayat.set(sender, []);
    const history = riwayat.get(sender);

    // Tambah pesan user
    history.push({ role: "user", parts: [{ text: message }] });
    if (history.length > 20) history.splice(0, history.length - 20);

    // Tanya Gemini AI
    const balasan = await tanyaGemini(history, env.GEMINI_API_KEY);

    // Tambah balasan AI ke riwayat
    history.push({ role: "model", parts: [{ text: balasan }] });

    // Kirim balasan ke WhatsApp
    await kirimWhatsApp(sender, balasan, env.FONNTE_TOKEN);

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function tanyaGemini(history, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history,
    generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  return (
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Maaf, sistem sedang terganggu. Hubungi posko BPBD di 112 untuk keadaan darurat. ⚠️"
  );
}

async function kirimWhatsApp(nomor, pesan, token) {
  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target: nomor, message: pesan, countryCode: "62" }),
  });
}

function halamanStatus() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chatbot BPBD Kota Bitung</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
    h1 { color: #c0392b; }
    .badge { display:inline-block; background:#27ae60; color:white; padding:4px 12px; border-radius:20px; font-size:14px; }
    code { background:#f0f0f0; padding:4px 8px; border-radius:4px; font-size:14px; word-break:break-all; }
    .info { background:#eaf4fb; border-left:4px solid #2980b9; padding:12px 16px; border-radius:4px; margin:16px 0; }
  </style>
</head>
<body>
  <h1>🆘 Chatbot AI BPBD Kota Bitung</h1>
  <p>Status: <span class="badge">✅ Aktif</span></p>
  <div class="info">
    <b>Webhook URL untuk Fonnte:</b><br><br>
    <code id="wh"></code>
  </div>
  <p>Salin URL di atas ke pengaturan Webhook di dashboard Fonnte Anda.</p>
  <script>
    document.getElementById('wh').textContent = location.origin + '/webhook';
  </script>
</body>
</html>`;
}
