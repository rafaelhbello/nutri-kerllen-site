/* ===== Supabase config — Kerllen Rodrigues Nutrição ===== */
const SUPABASE_URL = "https://zuxugspnhjyjjygfbggc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHVnc3BuaGp5amp5Z2ZiZ2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTA0OTAsImV4cCI6MjEwMDcyNjQ5MH0.h9S1-tRgN7UE0C33xLtqeXei3bw6YWMgZgiyGP8oSKo"; // Chave anon (JWT)

const sb = {
  /* ---------- Sessão ---------- */
  _saveSession(data) {
    const atual = sb.getSession() || {};
    localStorage.setItem("kr_session", JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token || atual.refresh_token || null,
      // o token do Supabase vale ~1h; guardamos quando ele vence
      expires_at:    Date.now() + ((data.expires_in || 3600) * 1000),
      user:          data.user || atual.user || null
    }));
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || "Credenciais inválidas");
    sb._saveSession(data);
    return data;
  },

  signOut(motivo) {
    localStorage.removeItem("kr_session");
    window.location.href = motivo ? `login.html?motivo=${motivo}` : "login.html";
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem("kr_session")); } catch { return null; }
  },

  getToken() { return sb.getSession()?.access_token || null; },

  /* Devolve um token válido: se estiver perto de vencer, renova sozinho.
     É isso que evita o antigo "JWT expired" depois de 1 hora aberta. */
  async getValidToken() {
    const s = sb.getSession();
    if (!s) return null;

    const aindaVale = s.expires_at && Date.now() < (s.expires_at - 60000); // margem de 1 min
    if (aindaVale) return s.access_token;
    if (!s.refresh_token) return s.access_token; // sessão antiga: segue e o 401 trata

    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      const data = await r.json();
      if (!r.ok || !data.access_token) throw new Error("refresh recusado");
      sb._saveSession(data);
      return data.access_token;
    } catch (e) {
      console.warn("Não foi possível renovar a sessão:", e);
      return s.access_token;
    }
  },

  /* ---------- Requisições ---------- */
  async _req(method, path, body, auth) {
    // Formulários públicos (anamnese/leads) rodam SEM login: o RLS deixa INSERIR,
    // mas não LER. Pedir a linha de volta num insert anônimo faz o insert falhar,
    // por isso só usamos "return=representation" quando há usuário logado.
    const token = auth ? await sb.getValidToken() : null;
    const headers = {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": token ? "return=representation" : "return=minimal"
    };
    headers["Authorization"] = "Bearer " + (token || SUPABASE_KEY);

    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      // Sessão venceu de vez — manda pro login em vez de mostrar "JWT expired"
      if (auth && (r.status === 401 || r.status === 403)) {
        sb.signOut("expirada");
        throw new Error("Sessão expirada");
      }
      console.error("ERRO SUPABASE DETALHADO:", {
        status: r.status, statusText: r.statusText, error: e, path, body
      });
      throw new Error(e.message || r.statusText);
    }

    const text = await r.text();
    return text ? JSON.parse(text) : null;
  },

  /* ---------- Público (sem login) ---------- */
  saveLead:        (d)    => sb._req("POST",  "leads",     d),
  saveAnamnese:    (d)    => sb._req("POST",  "anamneses", d),

  /* ---------- Painel (exige login) ---------- */
  getLeads:        ()     => sb._req("GET",   "leads?order=created_at.desc",     null, true),
  getAnamneses:    ()     => sb._req("GET",   "anamneses?order=created_at.desc", null, true),

  getPacientes:    ()     => sb._req("GET",   "pacientes?order=nome.asc",        null, true),
  createPaciente:  (d)    => sb._req("POST",  "pacientes",                       d,    true),
  updatePaciente:  (id,d) => sb._req("PATCH", `pacientes?id=eq.${id}`,           d,    true),

  addEvolucao:     (d)    => sb._req("POST",  "evolucao",                        d,    true),
  getEvolucao:     (id)   => sb._req("GET",   `evolucao?paciente_id=eq.${id}&order=data.desc`, null, true),
  addConsulta:     (d)    => sb._req("POST",  "consultas",                       d,    true),
  getConsultas:    (id)   => sb._req("GET",   `consultas?paciente_id=eq.${id}&order=data.desc`, null, true),
  getConsultasPorData: (data) => sb._req("GET", `consultas?data=eq.${data}&order=id.asc`, null, true),
};

function requireAuth() {
  const s = sb.getSession();
  if (!s) { window.location.href = "login.html"; return false; }
  // Sessão vencida e sem como renovar: volta pro login antes de tentar carregar nada
  if (s.expires_at && Date.now() > s.expires_at && !s.refresh_token) {
    sb.signOut("expirada");
    return false;
  }
  return true;
}
