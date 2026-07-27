/* ===== Painel da Nutricionista ===== */

const KEY = "kr_pacientes";

/* Inicializa o armazenamento vazio */
if (!localStorage.getItem(KEY)) {
  localStorage.setItem(KEY, JSON.stringify([]));
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function load() {
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function fmt(d) {
  return d ? d.split("-").reverse().join("/") : "—";
}

function initials(nome) {
  return nome
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const pacientes = load();
  const leads = JSON.parse(localStorage.getItem("kr_leads") || "[]");
  const hoje = hojeISO();
  const consultasHoje = [];
  pacientes.forEach(p => (p.consultas || []).forEach(c => { if (c.data === hoje) consultasHoje.push({ ...c, nome: p.nome }); }));
  const pendentes = pacientes.filter(p => p.anamnese !== "completa" && p.status === "ativo");

  document.getElementById("statAtivos").textContent = pacientes.filter(p => p.status === "ativo").length;
  document.getElementById("statHoje").textContent = consultasHoje.length;
  document.getElementById("statAnamnese").textContent = pendentes.length;
  document.getElementById("statLeads").textContent = leads.length;

  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const agenda = document.getElementById("agendaHoje");
  agenda.innerHTML = consultasHoje.length
    ? consultasHoje.map((c, i) => `<li><time>${String(8 + i * 2).padStart(2, "0")}:00</time> ${c.nome} — ${c.resumo}</li>`).join("")
    : `<li class="empty-li">Nenhuma consulta registrada para hoje.</li>`;

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
  const list = load().filter(p =>
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
  const leads = JSON.parse(localStorage.getItem("kr_leads") || "[]").slice().reverse();
  const tb = document.querySelector("#tabelaLeads tbody");
  document.getElementById("leadsVazio").hidden = leads.length > 0;
  tb.innerHTML = leads.map(l =>
    `<tr><td class="t-name">${l.nome}</td><td>${l.whatsapp}</td><td>${l.objetivo}</td><td>${new Date(l.data).toLocaleDateString("pt-BR")}</td></tr>`).join("");
}

/* ---------- Modal novo paciente ---------- */
const modalNovo = document.getElementById("modalNovo");
["btnNovoPaciente", "btnNovoPaciente2"].forEach(id =>
  document.getElementById(id).addEventListener("click", () => (modalNovo.hidden = false)));

document.getElementById("formNovo").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  const list = load();
  list.push({
    id: Date.now(), nome: f.nome.value.trim(), telefone: f.telefone.value.trim(),
    email: f.email.value.trim(), nascimento: f.nascimento.value, objetivo: f.objetivo.value,
    status: "ativo", anamnese: "pendente", metas: "", consultas: [], evolucao: []
  });
  save(list); f.reset(); modalNovo.hidden = true;
  renderDashboard(); renderPacientes();
});

/* ---------- Perfil do paciente ---------- */
const modalPerfil = document.getElementById("modalPerfil");
let atual = null;

function abrirPerfil(id) {
  atual = load().find(p => p.id === id);
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
  renderHistorico(); renderEvolucao();
  modalPerfil.hidden = false;
}

function persistAtual() {
  const list = load().map(p => (p.id === atual.id ? atual : p));
  save(list); renderDashboard(); renderPacientes();
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
  atual.metas = document.getElementById("perfilMetas").value; persistAtual();
});
document.getElementById("formConsulta").addEventListener("submit", e => {
  e.preventDefault();
  atual.consultas = atual.consultas || [];
  atual.consultas.push({ data: e.target.data.value, resumo: e.target.resumo.value.trim() });
  e.target.reset(); persistAtual(); renderHistorico();
});
document.getElementById("formEvolucao").addEventListener("submit", e => {
  e.preventDefault();
  atual.evolucao = atual.evolucao || [];
  atual.evolucao.push({ data: hojeISO(), peso: +e.target.peso.value, obs: e.target.obs.value.trim() });
  e.target.reset(); persistAtual(); renderEvolucao();
});

/* Fechar modais */
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m || e.target.hasAttribute("data-close")) m.hidden = true; });
});

/* Sincroniza anamneses enviadas pela área do paciente */
(function syncAnamneses() {
  const enviadas = JSON.parse(localStorage.getItem("kr_anamneses") || "[]");
  if (!enviadas.length) return;
  const list = load();
  enviadas.forEach(a => {
    const p = list.find(x => x.nome.toLowerCase() === (a.identificacao?.nome || "").toLowerCase());
    if (p) p.anamnese = "completa";
  });
  save(list);
})();

renderDashboard(); renderPacientes(); renderLeads();
