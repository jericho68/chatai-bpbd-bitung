export default {
async fetch(request, env, ctx) {

```
const url = new URL(request.url);

// =====================================================
// HALAMAN STATUS
// =====================================================
if (url.pathname === "/") {
  return new Response(
    `
    <html>
    <body style="font-family:Arial;padding:30px">
      <h2>🆘 Chatbot AI BPBD Kota Bitung</h2>
      <p>Status: <b style="color:green">AKTIF</b></p>
      <p>Webhook: /webhook</p>
    </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html;charset=UTF-8"
      }
    }
  );
}

// =====================================================
// TEST WEBHOOK
// =====================================================
if (url.pathname === "/webhook" && request.method === "GET") {
  return Response.json({
    status: "online",
    service: "Chatbot AI BPBD Kota Bitung"
  });
}

// =====================================================
// WEBHOOK FONNTE
// =====================================================
if (url.pathname === "/webhook" && request.method === "POST") {

  try {

    const data = await request.json();

    console.log("DATA FONNTE:", JSON.stringify(data));

    const sender =
      data.sender ||
      data.from ||
      "";

    const message =
      data.message ||
      data.text ||
      "";

    if (!sender || !message) {
      return Response.json({
        status: "ignored"
      });
    }

    // =================================================
    // PROMPT BPBD
    // =================================================

    const SYSTEM_PROMPT = `
```

Kamu adalah SIAGA (Sistem Informasi AI Gerak Cepat BPBD Kota Bitung).

Tugas:

* Menjawab pertanyaan kebencanaan.
* Memberikan edukasi mitigasi bencana.
* Membantu warga melaporkan kejadian.
* Selalu menggunakan Bahasa Indonesia.
* Ramah dan profesional.

Kontak Darurat:
112

Jika warga melaporkan bencana tanyakan:

1. Lokasi kejadian
2. Jenis bencana
3. Jumlah korban
4. Kondisi akses jalan
5. Nomor yang dapat dihubungi

Batas jawaban maksimal 3 paragraf.
`;

```
    // =================================================
    // KIRIM KE GEMINI
    // =================================================

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: SYSTEM_PROMPT
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const geminiData = await geminiResponse.json();

    let reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, sistem sedang sibuk. Silakan coba kembali.";

    // =================================================
    // KIRIM BALASAN KE WHATSAPP
    // =================================================

    await fetch(
      "https://api.fonnte.com/send",
      {
        method: "POST",
        headers: {
          "Authorization": env.FONNTE_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: sender,
          message: reply
        })
      }
    );

    return Response.json({
      status: "success"
    });

  } catch (err) {

    console.log(err);

    return Response.json({
      status: "error",
      message: err.message
    });
  }
}

return new Response("Not Found", {
  status: 404
});
```

}
};
