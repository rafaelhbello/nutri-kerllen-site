/* ===== Painel da Nutricionista (dados no Supabase) ===== */

if (!requireAuth()) throw new Error("Não autenticado");

let pacientesCache = [];
let leadsCache = [];

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function fmt(d) { return d ? d.split("-").reverse().join("/") : "—"; }
function initials(nome) { return nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(); }

function avisoErro(msg) {
  console.error(msg);
  alert(typeof msg === "string" ? msg : (msg?.message || "Ocorreu um erro ao falar com o Supabase."));
}

/* ---------- Carregamento inicial ---------- */
async function carregarTudo() {
  try {
    [pacientesCache, leadsCache] = await Promise.all([sb.getPacientes(), sb.getLeads()]);
    await sincronizarAnamneses();
    renderPacientes();
    renderLeads();
    await renderDashboard();
  } catch (err) {
    avisoErro(err);
  }
}

/* Marca como "completa" o paciente cuja anamnese já foi enviada pela área do paciente */
async function sincronizarAnamneses() {
  try {
    const anamneses = await sb.getAnamneses();
    const pendentes = pacientesCache.filter(p => p.anamnese !== "completa");
    for (const a of anamneses) {
      const nomeEnviado = (a.nome || "").trim().toLowerCase();
      const p = pendentes.find(x => x.nome.trim().toLowerCase() === nomeEnviado);
      if (p) {
        await sb.updatePaciente(p.id, { anamnese: "completa" });
        p.anamnese = "completa";
      }
    }
  } catch (err) {
    console.error("Falha ao sincronizar anamneses:", err);
  }
}

/* ---------- Navegação lateral ---------- */
document.querySelectorAll(".side-link[data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
  });
});

document.getElementById("btnLogout")?.addEventListener("click", () => sb.signOut());

/* ---------- Dashboard ---------- */
async function renderDashboard() {
  const pendentes = pacientesCache.filter(p => p.anamnese !== "completa" && p.status === "ativo");

  document.getElementById("statAtivos").textContent = pacientesCache.filter(p => p.status === "ativo").length;
  document.getElementById("statAnamnese").textContent = pendentes.length;
  document.getElementById("statLeads").textContent = leadsCache.length;

  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const agenda = document.getElementById("agendaHoje");
  try {
    const consultasHoje = await sb.getConsultasPorData(hojeISO());
    document.getElementById("statHoje").textContent = consultasHoje.length;
    agenda.innerHTML = consultasHoje.length
      ? consultasHoje.map(c => {
          const p = pacientesCache.find(x => x.id === c.paciente_id);
          return `<li><time>${fmt(c.data)}</time> ${p ? p.nome : "Paciente"} — ${c.resumo}</li>`;
        }).join("")
      : `<li class="empty-li">Nenhuma consulta registrada para hoje.</li>`;
  } catch (err) {
    document.getElementById("statHoje").textContent = "—";
    agenda.innerHTML = `<li class="empty-li">Não foi possível carregar a agenda de hoje.</li>`;
  }

  const pend = document.getElementById("listaPendencias");
  pend.innerHTML = pendentes.length
    ? pendentes.map(p => `<li>${p.nome} — anamnese pendente</li>`).join("")
    : `<li class="empty-li">Nenhuma pendência. ✦</li>`;
}

/* ---------- Lista de pacientes ---------- */
const tbody = document.querySelector("#tabelaPacientes tbody");
function renderPacientes() {
  const q = (document.getElementById("buscaPaciente").value || "").toLowerCase();
  const fs = document.getElementById("filtroStatus").value;
  const fa = document.getElementById("filtroAnamnese").value;
  const list = pacientesCache.filter(p =>
    (!q || p.nome.toLowerCase().includes(q) || (p.telefone || "").includes(q)) &&
    (!fs || p.status === fs) && (!fa || p.anamnese === fa)
  );
  document.getElementById("pacientesVazio").hidden = list.length > 0;
  tbody.innerHTML = list.map(p => `
    <tr data-id="${p.id}">
      <td><span class="t-name"><span class="t-avatar">${initials(p.nome)}</span>${p.nome}</span></td>
      <td>${p.telefone || "—"}</td>
      <td>${p.objetivo || "—"}</td>
      <td><span class="badge ${p.anamnese === "completa" ? "badge--ok" : "badge--warn"}">${p.anamnese === "completa" ? "Completa" : "Pendente"}</span></td>
      <td><span class="badge ${p.status === "ativo" ? "badge--ok" : "badge--off"}">${p.status === "ativo" ? "Ativo" : "Inativo"}</span></td>
      <td>›</td>
    </tr>`).join("");
  tbody.querySelectorAll("tr").forEach(tr => tr.addEventListener("click", () => abrirPerfil(+tr.dataset.id)));
}
["buscaPaciente", "filtroStatus", "filtroAnamnese"].forEach(id =>
  document.getElementById(id).addEventListener("input", renderPacientes));

/* ---------- Leads ---------- */
function renderLeads() {
  const leads = leadsCache.slice().reverse();
  const tb = document.querySelector("#tabelaLeads tbody");
  document.getElementById("leadsVazio").hidden = leads.length > 0;
  tb.innerHTML = leads.map(l =>
    `<tr><td class="t-name">${l.nome}</td><td>${l.whatsapp || "—"}</td><td>${l.objetivo || "—"}</td><td>${new Date(l.created_at).toLocaleDateString("pt-BR")}</td></tr>`).join("");
}

/* ---------- Modal novo paciente ---------- */
const modalNovo = document.getElementById("modalNovo");
["btnNovoPaciente", "btnNovoPaciente2"].forEach(id =>
  document.getElementById(id).addEventListener("click", () => (modalNovo.hidden = false)));

document.getElementById("formNovo").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('[type="submit"]');
  try {
    if (btn) btn.disabled = true;
    const [novo] = await sb.createPaciente({
      nome: f.nome.value.trim(), telefone: f.telefone.value.trim(),
      email: f.email.value.trim(), nascimento: f.nascimento.value || null,
      objetivo: f.objetivo.value, status: "ativo", anamnese: "pendente", metas: ""
    });
    pacientesCache.push(novo);
    f.reset(); modalNovo.hidden = true;
    renderDashboard(); renderPacientes();
  } catch (err) {
    avisoErro(err);
  } finally {
    if (btn) btn.disabled = false;
  }
});

/* ---------- Perfil do paciente ---------- */
const modalPerfil = document.getElementById("modalPerfil");
let atual = null;

async function abrirPerfil(id) {
  atual = pacientesCache.find(p => p.id === id);
  if (!atual) return;
  document.getElementById("perfilAvatar").textContent = initials(atual.nome);
  document.getElementById("perfilNome").textContent = atual.nome;
  document.getElementById("perfilMeta").textContent = `${atual.objetivo || "Sem objetivo definido"} · nascimento ${fmt(atual.nascimento)}`;
  document.getElementById("perfilTags").innerHTML =
    `<span class="badge ${atual.status === "ativo" ? "badge--ok" : "badge--off"}">${atual.status === "ativo" ? "Ativo" : "Inativo"}</span>
     <span class="badge ${atual.anamnese === "completa" ? "badge--ok" : "badge--warn"}">Anamnese ${atual.anamnese === "completa" ? "completa" : "pendente"}</span>`;
  document.getElementById("perfilDados").innerHTML = [
    ["WhatsApp", atual.telefone], ["E-mail", atual.email],
    ["Nascimento", fmt(atual.nascimento)], ["Objetivo", atual.objetivo]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v || "—"}</dd></div>`).join("");
  document.getElementById("perfilMetas").value = atual.metas || "";
  modalPerfil.hidden = false;

  document.getElementById("perfilHistorico").innerHTML = `<li class="empty-li">Carregando…</li>`;
  document.getElementById("perfilEvolucao").innerHTML = `<li class="empty-li">Carregando…</li>`;
  try {
    const [consultas, evolucao] = await Promise.all([sb.getConsultas(id), sb.getEvolucao(id)]);
    atual.consultas = consultas; atual.evolucao = evolucao;
    renderHistorico(); renderEvolucao();
  } catch (err) {
    avisoErro(err);
  }
}

async function persistAtual(campos) {
  try {
    await sb.updatePaciente(atual.id, campos);
    Object.assign(atual, campos);
    pacientesCache = pacientesCache.map(p => (p.id === atual.id ? { ...p, ...campos } : p));
    renderDashboard(); renderPacientes();
  } catch (err) {
    avisoErro(err);
  }
}

function renderHistorico() {
  const ul = document.getElementById("perfilHistorico");
  const cs = (atual.consultas || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = cs.length ? cs.map(c => `<li><strong>${fmt(c.data)}</strong> ${c.resumo}</li>`).join("")
    : `<li class="empty-li">Nenhuma consulta registrada.</li>`;
}
function renderEvolucao() {
  const ul = document.getElementById("perfilEvolucao");
  const ev = (atual.evolucao || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = ev.length ? ev.map(r => `<li><strong>${r.peso} kg</strong> ${fmt(r.data)} — ${r.obs || "sem observações"}</li>`).join("")
    : `<li class="empty-li">Nenhum registro de evolução ainda.</li>`;
}

document.getElementById("salvarMetas").addEventListener("click", () => {
  persistAtual({ metas: document.getElementById("perfilMetas").value });
});

document.getElementById("formConsulta").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const [nova] = await sb.addConsulta({ paciente_id: atual.id, data: e.target.data.value, resumo: e.target.resumo.value.trim() });
    atual.consultas = [...(atual.consultas || []), nova];
    e.target.reset(); renderHistorico();
  } catch (err) {
    avisoErro(err);
  }
});

document.getElementById("formEvolucao").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const [nova] = await sb.addEvolucao({ paciente_id: atual.id, data: hojeISO(), peso: +e.target.peso.value, obs: e.target.obs.value.trim() });
    atual.evolucao = [...(atual.evolucao || []), nova];
    e.target.reset(); renderEvolucao();
  } catch (err) {
    avisoErro(err);
  }
});

/* Fechar modais */
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m || e.target.hasAttribute("data-close")) m.hidden = true; });
});

carregarTudo();
