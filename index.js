export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // Tes status
    if (request.method === "GET" && url.pathname === "/webhook") {
      return Response.json({
        status: "online",
        service: "Chatbot AI BPBD Kota Bitung"
      });
    }

    // Webhook Fonnte
    if (request.method === "POST" && url.pathname === "/webhook") {

      const data = await request.json();

      console.log("DATA FONNTE:", JSON.stringify(data));

      const sender =
        data.sender ||
        data.number ||
        data.from;

      const pesan =
        data.message ||
        data.text ||
        data.body;

      if (!sender || !pesan) {
        return Response.json({
          status: "ignored"
        });
      }

      // Panggil Gemini
      const gemini = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: pesan
                  }
                ]
              }
            ]
          })
        }
      );

      const hasil = await gemini.json();

      const balasan =
        hasil?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Maaf, saya belum dapat memberikan jawaban saat ini.";

      // Kirim ke WhatsApp
      await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: env.FONNTE_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: sender,
          message: balasan
        })
      });

      return Response.json({
        status: "success"
      });
    }

    return new Response("BPBD Bitung AI Aktif");
  }
};
