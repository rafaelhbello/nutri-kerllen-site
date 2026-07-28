/* ===== Supabase config — Kerllen Rodrigues Nutrição ===== */
const SUPABASE_URL = "https://zuxugspnhjyjjygfbggc.supabase.co";
// A chave abaixo parece estar incorreta ou expirada. 
// O usuário deve fornecer a chave correta do Supabase (anon key).
const SUPABASE_KEY = "SUA_ANON_KEY_AQUI";

const sb = {
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || "Credenciais inválidas");
    localStorage.setItem("kr_session", JSON.stringify({
      access_token: data.access_token, user: data.user
    }));
    return data;
  },

  signOut() {
    localStorage.removeItem("kr_session");
    window.location.href = "login.html";
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem("kr_session")); } catch { return null; }
  },

  getToken() { return this.getSession()?.access_token || null; },

  async _req(method, path, body, token) {
    const headers = {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
    // Para requisições anônimas (sem token de usuário logado), 
    // usamos a SUPABASE_KEY tanto no apikey quanto no Authorization Bearer.
    headers["Authorization"] = "Bearer " + (token || SUPABASE_KEY);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) { 
      const e = await r.json().catch(() => ({})); 
      console.error("ERRO SUPABASE DETALHADO:", {
        status: r.status,
        statusText: r.statusText,
        error: e,
        path: path,
        body: body
      });
      throw new Error(e.message || r.statusText); 
    }
    return r.status === 204 ? null : r.json();
  },

  saveLead:        (d)    => sb._req("POST",  "leads",                              d),
  getLeads:        ()     => sb._req("GET",   "leads?order=created_at.desc",        null, sb.getToken()),

  getPacientes:    ()     => sb._req("GET",   "pacientes?order=nome.asc",           null, sb.getToken()),
  createPaciente:  (d)    => sb._req("POST",  "pacientes",                          d,    sb.getToken()),
  updatePaciente:  (id,d) => sb._req("PATCH", `pacientes?id=eq.${id}`,              d,    sb.getToken()),

  saveAnamnese:    (d)    => sb._req("POST",  "anamneses",                          d),
  getAnamneses:    ()     => sb._req("GET",   "anamneses?order=created_at.desc",    null, sb.getToken()),

  addEvolucao:     (d)    => sb._req("POST",  "evolucao",                           d,    sb.getToken()),
  getEvolucao:     (id)   => sb._req("GET",   `evolucao?paciente_id=eq.${id}&order=data.desc`, null, sb.getToken()),
  addConsulta:     (d)    => sb._req("POST",  "consultas",                          d,    sb.getToken()),
  getConsultas:    (id)   => sb._req("GET",   `consultas?paciente_id=eq.${id}&order=data.desc`, null, sb.getToken()),
  getConsultasPorData: (data) => sb._req("GET", `consultas?data=eq.${data}&order=id.asc`, null, sb.getToken()),
};

function requireAuth() {
  if (!sb.getSession()) { window.location.href = "login.html"; return false; }
  return true;
}
