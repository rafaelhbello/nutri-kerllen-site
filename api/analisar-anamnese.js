/* ============================================================
 * /api/analisar-anamnese
 * Função serverless (Vercel) — mantém a chave do Gemini no servidor.
 * Recebe os dados já formatados da anamnese + o token de sessão da
 * nutricionista (mesmo token que o painel já usa), chama o Gemini,
 * e grava o resultado em "pacientes" usando a MESMA regra de RLS do
 * resto do sistema (só "authenticated" pode escrever em pacientes).
 * Não expõe a GEMINI_API_KEY ao navegador em nenhum momento.
 * ============================================================ */

const SUPABASE_URL = "https://zuxugspnhjyjjygfbggc.supabase.co";
// Chave anon pública — a mesma já usada em js/supabase.js no frontend, não é segredo.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHVnc3BuaGp5amp5Z2ZiZ2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTA0OTAsImV4cCI6MjEwMDcyNjQ5MH0.h9S1-tRgN7UE0C33xLtqeXei3bw6YWMgZgiyGP8oSKo";

const SCHEMA_RESPOSTA = {
  type: "object",
  properties: {
    resumo: { type: "string", description: "Resumo profissional e objetivo do caso (objetivo principal, hábitos relevantes, rotina alimentar, hidratação, sono, atividade física e um resumo geral do caso), em texto corrido com parágrafos curtos." },
    pontos_atencao: { type: "string", description: "Sinais e pontos de atenção, em linguagem cautelosa, sem diagnósticos, destacando fatores que podem impactar os resultados do paciente." },
    perguntas: { type: "array", items: { type: "string" }, description: "Entre 5 e 15 perguntas personalizadas para auxiliar o nutricionista durante a consulta." }
  },
  required: ["resumo", "pontos_atencao", "perguntas"]
};

function montarPrompt(textoAnamnese) {
  return `Você é um nutricionista clínico experiente.
Analise a anamnese recebida abaixo e gere:

1. Resumo da Anamnese: objetivo principal, hábitos relevantes, rotina alimentar, hidratação, sono, atividade física e um resumo geral do caso.
2. Sinais e Pontos de Atenção: identifique fatores que merecem investigação. Não realize diagnósticos. Utilize linguagem cautelosa.
3. Consulta Assistida: gere entre 5 e 15 perguntas personalizadas para auxiliar o nutricionista durante a consulta, com base nas respostas do paciente.

Dados da anamnese:
${textoAnamnese}

Responda estritamente no formato JSON definido pelo schema fornecido, em português do Brasil.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const { pacienteId, textoAnamnese, accessToken } = req.body || {};
  if (!pacienteId || !textoAnamnese || !accessToken) {
    return res.status(400).json({ error: "Dados incompletos para gerar a análise." });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "A chave da IA (GEMINI_API_KEY) não está configurada no servidor. Peça para configurar em Vercel > Project Settings > Environment Variables." });
  }

  try {
    // 1) Chama o Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: montarPrompt(textoAnamnese) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA_RESPOSTA,
          temperature: 0.4
        }
      })
    });

    const geminiData = await geminiResp.json();
    if (!geminiResp.ok) {
      const msg = geminiData?.error?.message || "Falha ao consultar a IA.";
      return res.status(502).json({ error: `Erro na IA: ${msg}` });
    }

    const textoBruto = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoBruto) {
      return res.status(502).json({ error: "A IA não retornou nenhum conteúdo. Tente novamente." });
    }

    let analise;
    try {
      analise = JSON.parse(textoBruto);
    } catch {
      return res.status(502).json({ error: "Não foi possível interpretar a resposta da IA." });
    }

    const agora = new Date().toISOString();
    const payload = {
      ai_summary: analise.resumo || "",
      ai_attention_points: analise.pontos_atencao || "",
      ai_consultation_questions: Array.isArray(analise.perguntas) ? analise.perguntas : [],
      ai_last_generated_at: agora
    };

    // 2) Salva no Supabase usando o token da própria nutricionista logada
    //    (mesma regra de RLS de "authenticated" já usada em todo o painel).
    const updResp = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?id=eq.${pacienteId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (!updResp.ok) {
      const e = await updResp.json().catch(() => ({}));
      return res.status(502).json({ error: e.message || "Falha ao salvar a análise no Supabase." });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Erro em /api/analisar-anamnese:", err);
    return res.status(500).json({ error: "Erro inesperado ao gerar a análise. Tente novamente em instantes." });
  }
}
