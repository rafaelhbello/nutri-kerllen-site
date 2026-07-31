/* ===== Painel da Nutricionista (dados no Supabase) ===== */

if (!requireAuth()) throw new Error("Não autenticado");

let pacientesCache = [];
let leadsCache = [];
let anamnesesCache = [];

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function fmt(d) { return d ? d.split("-").reverse().join("/") : "—"; }
function initials(nome) { return (nome || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(); }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function norm(s) { return (s || "").trim().toLowerCase(); }
function digits(s) { return (s || "").replace(/\D/g, ""); }

function avisoErro(msg) {
  console.error(msg);
  alert(typeof msg === "string" ? msg : (msg?.message || "Ocorreu um erro ao falar com o Supabase."));
}

/* ---------- Carregamento inicial ---------- */
async function carregarTudo() {
  try {
    [pacientesCache, leadsCache, anamnesesCache] = await Promise.all([
      sb.getPacientes(),
      sb.getLeads(),
      sb.getAnamneses().catch(() => [])
    ]);
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
    const pendentes = pacientesCache.filter(p => p.anamnese !== "completa");
    for (const a of anamnesesCache) {
      const nomeEnviado = norm(a.nome);
      const p = pendentes.find(x => norm(x.nome) === nomeEnviado);
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
    if (btn.dataset.view === "agenda") renderAgendaGeral();
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
          return `<li><time>${fmt(c.data)}</time> ${esc(p ? p.nome : "Paciente")} — ${esc(c.resumo)}</li>`;
        }).join("")
      : `<li class="empty-li">Nenhuma consulta registrada para hoje.</li>`;
  } catch (err) {
    document.getElementById("statHoje").textContent = "—";
    agenda.innerHTML = `<li class="empty-li">Não foi possível carregar a agenda de hoje.</li>`;
  }

  const pend = document.getElementById("listaPendencias");
  pend.innerHTML = pendentes.length
    ? pendentes.map(p => `<li>${esc(p.nome)} — anamnese pendente</li>`).join("")
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
      <td><span class="t-name"><span class="t-avatar">${initials(p.nome)}</span>${esc(p.nome)}</span></td>
      <td>${esc(p.telefone) || "—"}</td>
      <td>${esc(p.objetivo) || "—"}</td>
      <td><span class="badge ${p.anamnese === "completa" ? "badge--ok" : "badge--warn"}">${p.anamnese === "completa" ? "Completa" : "Pendente"}</span></td>
      <td><span class="badge ${p.status === "ativo" ? "badge--ok" : "badge--off"}">${p.status === "ativo" ? "Ativo" : "Inativo"}</span></td>
      <td class="td-acoes">
        <button class="btn-delete" onclick="event.stopPropagation(); confirmarExcluirPaciente(${p.id}, '${esc(p.nome)}')">🗑</button>
      </td>
    </tr>`).join("");
  tbody.querySelectorAll("tr").forEach(tr => tr.addEventListener("click", () => abrirPerfil(+tr.dataset.id)));
}
["buscaPaciente", "filtroStatus", "filtroAnamnese"].forEach(id =>
  document.getElementById(id).addEventListener("input", renderPacientes));

/* ---------- Leads ---------- */

/* Encontra a anamnese que pertence a um lead (por nome ou pelos últimos dígitos do WhatsApp) */
function anamneseDoLead(lead) {
  const nome = norm(lead.nome);
  const tel = digits(lead.whatsapp);
  return anamnesesCache.find(a => {
    if (nome && norm(a.nome) === nome) return true;
    const at = digits(a.telefone);
    return tel.length >= 8 && at.length >= 8 && at.slice(-8) === tel.slice(-8);
  }) || null;
}

function renderLeads() {
  const leads = leadsCache.slice().reverse();
  const tb = document.querySelector("#tabelaLeads tbody");
  document.getElementById("leadsVazio").hidden = leads.length > 0;
  tb.innerHTML = leads.map(l => {
    const temAnamnese = !!anamneseDoLead(l);
    return `<tr data-id="${l.id}">
      <td class="t-name">${esc(l.nome)}</td>
      <td>${esc(l.whatsapp) || "—"}</td>
      <td>${esc(l.objetivo) || "—"}</td>
      <td><span class="badge ${temAnamnese ? "badge--ok" : "badge--warn"}">${temAnamnese ? "Respondida" : "Sem anamnese"}</span></td>
      <td>${new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
      <td class="td-acoes">
        <button class="btn-delete" onclick="event.stopPropagation(); confirmarExcluirLead(${l.id}, '${esc(l.nome)}')">🗑</button>
      </td>
    </tr>`;
  }).join("");
  tb.querySelectorAll("tr").forEach(tr =>
    tr.addEventListener("click", () => abrirLead(+tr.dataset.id)));
}

/* Rótulos amigáveis para as perguntas da anamnese, na ordem do formulário */
const ROTULOS_ANAMNESE = [
  ["origem",             "Como me conheceu"],
  ["queixa",             "Queixa principal / objetivo"],
  ["acorda",             "Horário que acorda"],
  ["dorme",              "Horário que dorme"],
  ["trabalho",           "Trabalho / estudo"],
  ["rotinaDia",          "Um dia comum"],
  ["intestino",          "Funcionamento do intestino"],
  ["tgi",                "Sintomas gastrointestinais"],
  ["horasSono",          "Horas de sono"],
  ["qualidadeSono",      "Qualidade do sono"],
  ["sonoSintomas",       "Queixas de sono"],
  ["ansiedade",          "Nível de estresse / ansiedade"],
  ["compulsao",          "Gatilhos de compulsão"],
  ["cicloRegular",       "Ciclo menstrual regular"],
  ["tpm",                "Sintomas de TPM"],
  ["anticoncepcional",   "Anticoncepcional"],
  ["cpu",                "Cabelo, pele e unhas"],
  ["intolerancia",       "Intolerâncias"],
  ["intoleranciaOutros", "Outras intolerâncias"],
  ["temAlergia",         "Tem alergia alimentar"],
  ["alergias",           "Quais alergias"],
  ["suplementos",        "Suplementos em uso"],
  ["medicamentos",       "Medicamentos contínuos"],
  ["familia",            "Histórico familiar"],
  ["agua",               "Consumo de água"],
  ["xiximetro",          "Xixímetro"],
  ["hidraSintomas",      "Sinais de desidratação"],
  ["alcoolFreq",         "Frequência de álcool"],
  ["alcoolTipo",         "O que costuma beber"],
  ["tabaco",             "Cigarro / tabaco"],
  ["modalidade",         "Modalidades praticadas"]
];

function valorLegivel(v) {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (v && typeof v === "object") return Object.values(v).filter(Boolean).join(", ");
  return v == null ? "" : String(v);
}

function blocoRespostas(respostas) {
  const r = respostas || {};
  const usados = new Set();
  const linhas = [];

  ROTULOS_ANAMNESE.forEach(([chave, rotulo]) => {
    usados.add(chave);
    const v = valorLegivel(r[chave]).trim();
    if (v) linhas.push([rotulo, v]);
  });
  // Qualquer campo novo que ainda não tenha rótulo também aparece
  Object.keys(r).forEach(k => {
    if (usados.has(k)) return;
    const v = valorLegivel(r[k]).trim();
    if (v) linhas.push([k, v]);
  });

  if (!linhas.length) return `<p class="lead-vazio">Sem respostas registradas.</p>`;
  return `<dl class="datalist">${linhas
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}</dl>`;
}

function blocoTreinos(treinos) {
  const t = treinos || {};
  const itens = Object.keys(t)
    .map(dia => {
      const d = t[dia] || {};
      const txt = [d.atividade, d.intensidade].filter(Boolean).join(" · ");
      return txt ? `<li><strong>${esc(dia)}</strong> — ${esc(txt)}</li>` : "";
    })
    .filter(Boolean);
  if (!itens.length) return `<p class="lead-vazio">Nenhum treino informado.</p>`;
  return `<ul class="historico">${itens.join("")}</ul>`;
}

/* ---------- Ficha do lead ---------- */
const modalLead = document.getElementById("modalLead");
let leadAtual = null;

function abrirLead(id) {
  leadAtual = leadsCache.find(l => l.id === id);
  if (!leadAtual) return;

  const a = anamneseDoLead(leadAtual);
  const quando = new Date(leadAtual.created_at).toLocaleString("pt-BR");

  document.getElementById("leadAvatar").textContent = initials(leadAtual.nome);
  document.getElementById("leadNome").textContent = leadAtual.nome || "Sem nome";
  document.getElementById("leadMeta").textContent = `Chegou pelo site em ${quando}`;
  document.getElementById("leadTags").innerHTML = a
    ? `<span class="badge badge--ok">Anamnese respondida</span>`
    : `<span class="badge badge--warn">Sem anamnese</span>`;

  document.getElementById("leadDados").innerHTML = [
    ["WhatsApp", leadAtual.whatsapp],
    ["Objetivo", leadAtual.objetivo],
    ["Idade", a?.idade],
    ["Sexo", a?.sexo]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v) || "—"}</dd></div>`).join("");

  document.getElementById("leadAnamnese").innerHTML = a
    ? `<div class="lead-secao"><h3>Respostas da anamnese</h3>${blocoRespostas(a.respostas)}</div>
       <div class="lead-secao"><h3>Atividade física semanal</h3>${blocoTreinos(a.treinos)}</div>`
    : `<div class="lead-secao"><p class="lead-vazio">Este contato ainda não preencheu o formulário de anamnese.</p></div>`;

  const tel = digits(leadAtual.whatsapp);
  const whats = document.getElementById("leadWhats");
  if (tel.length >= 10) {
    whats.href = `https://wa.me/55${tel.slice(-11)}`;
    whats.hidden = false;
  } else {
    whats.hidden = true;
  }

  const jaEhPaciente = pacientesCache.some(p => norm(p.nome) === norm(leadAtual.nome));
  const btnVirar = document.getElementById("leadVirarPaciente");
  btnVirar.disabled = jaEhPaciente;
  btnVirar.textContent = jaEhPaciente ? "Já é paciente" : "Cadastrar como paciente";

  modalLead.hidden = false;
}

document.getElementById("leadVirarPaciente").addEventListener("click", async e => {
  if (!leadAtual) return;
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const a = anamneseDoLead(leadAtual);
    const criado = await sb.createPaciente({
      nome: leadAtual.nome,
      telefone: leadAtual.whatsapp || "",
      email: "",
      nascimento: null,
      objetivo: leadAtual.objetivo || "",
      status: "ativo",
      anamnese: a ? "completa" : "pendente",
      metas: ""
    });
    const novo = Array.isArray(criado) ? criado[0] : criado;
    if (novo) pacientesCache.push(novo);
    btn.textContent = "Já é paciente";
    renderPacientes();
    renderDashboard();
  } catch (err) {
    btn.disabled = false;
    avisoErro(err);
  }
});

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

/* Encontra a anamnese do paciente pelo nome (mesma lógica usada para leads) */
function anamneseDoPaciente(p) {
  const nome = norm(p.nome);
  return anamnesesCache.find(a => norm(a.nome) === nome) || null;
}

function imc(peso, alturaCm) {
  if (!peso || !alturaCm) return null;
  const m = alturaCm / 100;
  return peso / (m * m);
}
function classificaIMC(v) {
  if (v == null) return "";
  if (v < 18.5) return "Abaixo do peso";
  if (v < 25) return "Peso normal";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidade grau I";
  if (v < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

/* ---------- Assistente IA (análise automática da anamnese) ---------- */
function treinosTexto(treinos) {
  const t = treinos || {};
  const linhas = Object.keys(t).map(dia => {
    const d = t[dia] || {};
    const txt = [d.atividade, d.intensidade].filter(Boolean).join(" · ");
    return txt ? `${dia}: ${txt}` : null;
  }).filter(Boolean);
  return linhas.length ? linhas.join("\n") : "Nenhum treino informado.";
}

function textoAnamneseParaIA(paciente, anamnese) {
  const usados = new Set();
  const linhas = [];
  ROTULOS_ANAMNESE.forEach(([chave, rotulo]) => {
    usados.add(chave);
    const v = valorLegivel((anamnese.respostas || {})[chave]).trim();
    if (v) linhas.push(`${rotulo}: ${v}`);
  });
  Object.keys(anamnese.respostas || {}).forEach(k => {
    if (usados.has(k)) return;
    const v = valorLegivel(anamnese.respostas[k]).trim();
    if (v) linhas.push(`${k}: ${v}`);
  });

  return [
    `Nome: ${paciente.nome || "—"}`,
    `Idade: ${anamnese.idade || "—"}`,
    `Sexo: ${anamnese.sexo || "—"}`,
    `Objetivo cadastrado: ${paciente.objetivo || "—"}`,
    "",
    "Respostas da anamnese:",
    ...linhas,
    "",
    "Atividade física semanal:",
    treinosTexto(anamnese.treinos)
  ].join("\n");
}

function renderIA(anamnese) {
  const conteudo = document.getElementById("iaConteudo");
  const dataSpan = document.getElementById("iaDataGeracao");

  if (!anamnese) {
    conteudo.innerHTML = `<p class="lead-vazio">É necessário que o paciente tenha uma anamnese respondida para gerar a análise.</p>`;
    dataSpan.textContent = "";
    return;
  }

  dataSpan.textContent = atual.ai_last_generated_at
    ? `Gerada em ${new Date(atual.ai_last_generated_at).toLocaleString("pt-BR")}`
    : "";

  const temAnalise = !!atual.ai_last_generated_at;
  const perguntas = Array.isArray(atual.ai_consultation_questions) ? atual.ai_consultation_questions : [];

  conteudo.innerHTML = `
    ${temAnalise ? `
      <div class="ia-secao">
        <h4>Resumo da anamnese</h4>
        <p>${esc(atual.ai_summary || "—")}</p>
      </div>
      <div class="ia-secao">
        <h4>Sinais e pontos de atenção</h4>
        <p>${esc(atual.ai_attention_points || "—")}</p>
      </div>
      <div class="ia-secao">
        <h4>Consulta assistida — perguntas sugeridas</h4>
        <ul>${perguntas.map(p => `<li>${esc(p)}</li>`).join("") || "<li>—</li>"}</ul>
      </div>
    ` : ""}
    <button type="button" class="btn btn--gold" id="btnGerarIA">
      ${temAnalise ? "🔄 Atualizar análise" : "✨ Analisar Anamnese com IA"}
    </button>
  `;

  document.getElementById("btnGerarIA").addEventListener("click", () => gerarAnaliseIA(anamnese));
}

async function gerarAnaliseIA(anamnese) {
  const conteudo = document.getElementById("iaConteudo");
  const btnAnterior = conteudo.innerHTML;
  conteudo.innerHTML = `<div class="ia-loading"><span class="ia-spinner"></span> Analisando a anamnese com IA — isso pode levar alguns segundos…</div>`;

  try {
    const accessToken = await sb.getValidToken();
    const texto = textoAnamneseParaIA(atual, anamnese);
    const r = await fetch("/api/analisar-anamnese", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pacienteId: atual.id, textoAnamnese: texto, accessToken })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Não foi possível gerar a análise agora.");

    Object.assign(atual, data);
    pacientesCache = pacientesCache.map(p => (p.id === atual.id ? { ...p, ...data } : p));
    renderIA(anamnese);
  } catch (err) {
    conteudo.innerHTML = `<p class="ia-erro">${esc(err.message || "Não foi possível gerar a análise agora. Tente novamente em instantes.")}</p>` + btnAnterior;
    const btn = document.getElementById("btnGerarIA");
    if (btn) btn.addEventListener("click", () => gerarAnaliseIA(anamnese));
  }
}

/* ---------- Navegação por abas dentro do perfil ---------- */
document.querySelectorAll("#modalPerfil .tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#modalPerfil .tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#modalPerfil .tabpane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

async function abrirPerfil(id) {
  atual = pacientesCache.find(p => p.id === id);
  if (!atual) return;

  // Sempre volta pra primeira aba ao abrir
  document.querySelectorAll("#modalPerfil .tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll("#modalPerfil .tabpane").forEach(p => p.classList.remove("active"));
  document.querySelector('#modalPerfil .tab[data-tab="resumo"]').classList.add("active");
  document.getElementById("tab-resumo").classList.add("active");

  document.getElementById("perfilAvatar").textContent = initials(atual.nome);
  document.getElementById("perfilNome").textContent = atual.nome;
  document.getElementById("perfilMeta").textContent = `${atual.objetivo || "Sem objetivo definido"} · nascimento ${fmt(atual.nascimento)}`;
  document.getElementById("perfilTags").innerHTML =
    `<span class="badge ${atual.status === "ativo" ? "badge--ok" : "badge--off"}">${atual.status === "ativo" ? "Ativo" : "Inativo"}</span>
     <span class="badge ${atual.anamnese === "completa" ? "badge--ok" : "badge--warn"}">Anamnese ${atual.anamnese === "completa" ? "completa" : "pendente"}</span>`;
  document.getElementById("perfilDados").innerHTML = [
    ["WhatsApp", atual.telefone], ["E-mail", atual.email],
    ["Nascimento", fmt(atual.nascimento)], ["Objetivo", atual.objetivo]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v) || "—"}</dd></div>`).join("");
  // Auto-correção ao exibir: se for menor que 10, mostra em metros para o usuário
  const alturaExibicao = atual.altura_cm && atual.altura_cm < 10 ? (atual.altura_cm).toFixed(2) : atual.altura_cm;
  document.getElementById("perfilAltura").value = alturaExibicao || "";
  document.getElementById("perfilMetaPeso").value = atual.meta_peso || "";
  document.getElementById("perfilObsNutri").value = atual.observacoes_nutri || "";

  const a = anamneseDoPaciente(atual);
  document.getElementById("perfilAnamnese").innerHTML = a
    ? `<div class="lead-secao"><h3>Respostas da anamnese</h3>${blocoRespostas(a.respostas)}</div>
       <div class="lead-secao"><h3>Atividade física semanal</h3>${blocoTreinos(a.treinos)}</div>`
    : `<p class="lead-vazio">Este paciente ainda não preencheu o formulário de anamnese.</p>`;
  renderIA(a);

  modalPerfil.hidden = false;

  ["perfilHistorico", "perfilEvolucao", "perfilMedidas", "perfilLembretes",
   "perfilPlanos", "perfilSuplementos", "perfilExames", "perfilFotos", "perfilMetasLista"]
    .forEach(elId => { document.getElementById(elId).innerHTML = `<li class="empty-li">Carregando…</li>`; });
  document.getElementById("perfilResumo").innerHTML = "";

  try {
    const [consultas, evolucao, medidas, lembretes, planos, suplementos, exames, fotos, metas] = await Promise.all([
      sb.getConsultas(id), sb.getEvolucao(id), sb.getMedidas(id), sb.getLembretes(id),
      sb.getPlanos(id), sb.getSuplementos(id), sb.getArquivos(id, "exame"),
      sb.getArquivos(id, "foto_evolucao"), sb.getMetas(id)
    ]);
    atual.consultas = consultas; atual.evolucao = evolucao; atual.medidas = medidas;
    atual.lembretes = lembretes; atual.planos = planos; atual.suplementos = suplementos;
    atual.exames = exames; atual.fotos = fotos; atual.metasLista = metas;
    renderHistorico(); renderEvolucao(); renderMedidas(); renderLembretes();
    renderPlanos(); renderSuplementos(); renderArquivos(); renderMetasLista();
    renderResumo();
  } catch (err) {
    avisoErro(err);
  }
}

async function persistAtual(campos) {
  try {
    await sb.updatePaciente(atual.id, campos);
    Object.assign(atual, campos);
    pacientesCache = pacientesCache.map(p => (p.id === atual.id ? { ...p, ...campos } : p));
    renderDashboard(); renderPacientes(); renderResumo();
  } catch (err) {
    avisoErro(err);
  }
}

/* ---------- Resumo ---------- */
function renderResumo() {
  const div = document.getElementById("perfilResumo");
  const ev = (atual.evolucao || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  const ultimo = ev[0];
  
  // Auto-correção de altura: se for menor que 10, assume que foi digitado em metros
  let alturaCorrigida = atual.altura_cm;
  if (alturaCorrigida && alturaCorrigida < 10) {
    alturaCorrigida = alturaCorrigida * 100;
  }
  
  // Fallback de peso: usa o último registro de evolução, ou o peso da anamnese
  const pesoParaIMC = ultimo?.peso || (atual.peso_anamnese ? atual.peso_anamnese : null);
  const imcAtual = pesoParaIMC && alturaCorrigida ? imc(pesoParaIMC, alturaCorrigida) : null;
  const cs = (atual.consultas || []).slice().sort((a, b) => (a.data + (a.hora||"")).localeCompare(b.data + (b.hora||"")));
  const hoje = hojeISO();
  const proxima = cs.find(c => c.data >= hoje && c.status !== "cancelada");
  const ultimaRealizada = cs.slice().reverse().find(c => c.status === "realizada" || c.data < hoje);
  const pendMetas = (atual.metasLista || []).filter(m => m.status !== "concluida" && m.status !== "abandonada");

  const cards = [
    ["Peso atual", ultimo ? `${ultimo.peso} kg` : (pesoParaIMC ? `${pesoParaIMC} kg (anamnese)` : "—"), ultimo ? fmt(ultimo.data) : ""],
    ["IMC", imcAtual ? imcAtual.toFixed(1) : "—", imcAtual ? classificaIMC(imcAtual) : (alturaCorrigida ? "Registre o peso" : "Informe a altura")],
    ["% Gordura", ultimo?.percentual_gordura ? `${ultimo.percentual_gordura}%` : "—", ""],
    ["Massa muscular", ultimo?.massa_muscular ? `${ultimo.massa_muscular} kg` : "—", ""],
    ["Meta de peso", atual.meta_peso ? `${atual.meta_peso} kg` : "—", ""],
    ["Próxima consulta", proxima ? fmt(proxima.data) + (proxima.hora ? ` às ${proxima.hora.slice(0,5)}` : "") : "Nenhuma agendada", ""],
    ["Última consulta", ultimaRealizada ? fmt(ultimaRealizada.data) : "—", ""],
    ["Metas em andamento", pendMetas.length, ""]
  ];
  div.innerHTML = cards.map(([label, valor, sub]) => `
    <div class="resumo-card">
      <span class="resumo-card__label">${esc(label)}</span>
      <strong class="resumo-card__valor">${esc(valor)}</strong>
      ${sub ? `<span class="resumo-card__sub">${esc(sub)}</span>` : ""}
    </div>`).join("");
}

document.getElementById("salvarObsNutri").addEventListener("click", () => {
  persistAtual({ observacoes_nutri: document.getElementById("perfilObsNutri").value });
});

/* ---------- Consultas / agenda ---------- */
const STATUS_LABEL = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada", falta: "Faltou" };
const STATUS_BADGE  = { agendada: "badge--warn", realizada: "badge--ok", cancelada: "badge--off", falta: "badge--off" };

function renderHistorico() {
  const ul = document.getElementById("perfilHistorico");
  const cs = (atual.consultas || []).slice().sort((a, b) => (b.data + (b.hora||"")).localeCompare(a.data + (a.hora||"")));
  ul.innerHTML = cs.length ? cs.map(c => `
    <li data-id="${c.id}">
      <div style="flex:1">
        <strong>${fmt(c.data)}${c.hora ? " · " + c.hora.slice(0,5) : ""}</strong>
        ${c.tipo ? `<span class="badge badge--off">${esc(c.tipo)}</span>` : ""}
        <span class="badge ${STATUS_BADGE[c.status] || "badge--off"}">${STATUS_LABEL[c.status] || c.status || "—"}</span>
        <div style="margin-top:.3rem">${esc(c.resumo)}</div>
      </div>
      <div class="lead-acoes" style="margin:0">
        <button type="button" class="btn btn--ghost" data-consulta-status="realizada" data-id="${c.id}">Marcar realizada</button>
        <button type="button" class="btn btn--ghost" data-consulta-status="falta" data-id="${c.id}">Falta</button>
        <button type="button" class="btn btn--ghost" data-consulta-status="cancelada" data-id="${c.id}">Cancelar</button>
      </div>
    </li>`).join("")
    : `<li class="empty-li">Nenhuma consulta registrada.</li>`;

  ul.querySelectorAll("[data-consulta-status]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const cid = +btn.dataset.id;
      const status = btn.dataset.consultaStatus;
      try {
        await sb.updateConsulta(cid, { status });
        atual.consultas = atual.consultas.map(c => (c.id === cid ? { ...c, status } : c));
        renderHistorico(); renderResumo();
      } catch (err) { avisoErro(err); }
    });
  });
}

document.getElementById("formConsulta").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [nova] = await sb.addConsulta({
      paciente_id: atual.id, data: f.data.value, hora: f.hora.value || null,
      tipo: f.tipo.value || null, resumo: f.resumo.value.trim(), status: "agendada"
    });
    atual.consultas = [...(atual.consultas || []), nova];
    f.reset(); renderHistorico(); renderResumo();
  } catch (err) {
    avisoErro(err);
  }
});

/* ---------- Lembretes ---------- */
function renderLembretes() {
  const ul = document.getElementById("perfilLembretes");
  const ls = (atual.lembretes || []).slice().sort((a, b) => a.data.localeCompare(b.data));
  ul.innerHTML = ls.length ? ls.map(l => `
    <li data-id="${l.id}">
      <div style="flex:1; ${l.concluido ? "opacity:.55; text-decoration:line-through" : ""}">
        <strong>${fmt(l.data)}</strong> ${esc(l.texto)}
      </div>
      <div class="lead-acoes" style="margin:0">
        <button type="button" class="btn btn--ghost" data-lembrete-toggle="${l.id}">${l.concluido ? "Reabrir" : "Concluir"}</button>
        <button type="button" class="btn-delete" data-lembrete-del="${l.id}">🗑</button>
      </div>
    </li>`).join("")
    : `<li class="empty-li">Nenhum lembrete cadastrado.</li>`;

  ul.querySelectorAll("[data-lembrete-toggle]").forEach(btn => btn.addEventListener("click", async () => {
    const lid = +btn.dataset.lembreteToggle;
    const atualL = atual.lembretes.find(l => l.id === lid);
    try {
      await sb.updateLembrete(lid, { concluido: !atualL.concluido });
      atual.lembretes = atual.lembretes.map(l => (l.id === lid ? { ...l, concluido: !l.concluido } : l));
      renderLembretes();
    } catch (err) { avisoErro(err); }
  }));
  ul.querySelectorAll("[data-lembrete-del]").forEach(btn => btn.addEventListener("click", async () => {
    const lid = +btn.dataset.lembreteDel;
    try {
      await sb.deleteLembrete(lid);
      atual.lembretes = atual.lembretes.filter(l => l.id !== lid);
      renderLembretes();
    } catch (err) { avisoErro(err); }
  }));
}

document.getElementById("formLembrete").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [novo] = await sb.addLembrete({ paciente_id: atual.id, data: f.data.value, texto: f.texto.value.trim() });
    atual.lembretes = [...(atual.lembretes || []), novo];
    f.reset(); renderLembretes();
  } catch (err) { avisoErro(err); }
});

/* ---------- Evolução física ---------- */
let chartPeso = null;
let chartComposicao = null;

function renderEvolucao() {
  const ul = document.getElementById("perfilEvolucao");
  const ev = (atual.evolucao || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = ev.length ? ev.map(r => {
    const i = imc(r.peso, atual.altura_cm);
    const extras = [
      i ? `IMC ${i.toFixed(1)}` : null,
      r.percentual_gordura ? `${r.percentual_gordura}% gordura` : null,
      r.massa_muscular ? `${r.massa_muscular}kg massa musc.` : null
    ].filter(Boolean).join(" · ");
    return `
      <li>
        <div class="evolucao-info">
          <strong>${r.peso} kg</strong> ${fmt(r.data)}${extras ? " — " + extras : ""}${r.obs ? " — " + esc(r.obs) : ""}
        </div>
        <button class="btn-delete-small" onclick="confirmarExcluirEvolucao(${r.id})" title="Excluir registro">🗑</button>
      </li>`;
  }).join("") : `<li class="empty-li">Nenhum registro de evolução ainda.</li>`;

  renderGraficosEvolucao();
}

function renderGraficosEvolucao() {
  if (typeof Chart === "undefined") return; // biblioteca não carregou (ex.: sem internet)

  const ev = (atual.evolucao || []).slice().sort((a, b) => a.data.localeCompare(b.data));
  const labels = ev.map(r => fmt(r.data));

  // ---- Gráfico 1: Peso, meta de peso e IMC ----
  const pesoEmpty = document.getElementById("chartPesoEmpty");
  const canvasPeso = document.getElementById("chartPeso");
  if (chartPeso) { chartPeso.destroy(); chartPeso = null; }
  if (ev.length < 2) {
    pesoEmpty.hidden = false; canvasPeso.style.display = "none";
  } else {
    pesoEmpty.hidden = true; canvasPeso.style.display = "block";
    const datasetsPeso = [
      {
        label: "Peso (kg)", data: ev.map(r => r.peso), yAxisID: "y",
        borderColor: "#a8823a", backgroundColor: "#a8823a", tension: .25
      }
    ];
    if (atual.meta_peso) {
      datasetsPeso.push({
        label: "Meta de peso (kg)", data: ev.map(() => atual.meta_peso), yAxisID: "y",
        borderColor: "#c6a15b", borderDash: [6, 4], pointRadius: 0
      });
    }
    if (atual.altura_cm) {
      datasetsPeso.push({
        label: "IMC", data: ev.map(r => { const v = imc(r.peso, atual.altura_cm); return v ? +v.toFixed(1) : null; }),
        yAxisID: "y1", borderColor: "#7d7668", tension: .25
      });
    }
    chartPeso = new Chart(canvasPeso, {
      type: "line",
      data: { labels, datasets: datasetsPeso },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y:  { type: "linear", position: "left", title: { display: true, text: "kg" } },
          y1: { type: "linear", position: "right", title: { display: true, text: "IMC" }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  // ---- Gráfico 2: % gordura e massa muscular ----
  const compEmpty = document.getElementById("chartComposicaoEmpty");
  const canvasComp = document.getElementById("chartComposicao");
  if (chartComposicao) { chartComposicao.destroy(); chartComposicao = null; }
  const temGordura = ev.some(r => r.percentual_gordura != null);
  const temMassa = ev.some(r => r.massa_muscular != null);
  if (!temGordura && !temMassa) {
    compEmpty.hidden = false; canvasComp.style.display = "none";
  } else {
    compEmpty.hidden = true; canvasComp.style.display = "block";
    const datasetsComp = [];
    if (temGordura) datasetsComp.push({
      label: "% Gordura", data: ev.map(r => r.percentual_gordura), yAxisID: "y",
      borderColor: "#b3564d", backgroundColor: "#b3564d", tension: .25, spanGaps: true
    });
    if (temMassa) datasetsComp.push({
      label: "Massa muscular (kg)", data: ev.map(r => r.massa_muscular), yAxisID: "y1",
      borderColor: "#3e7d3e", backgroundColor: "#3e7d3e", tension: .25, spanGaps: true
    });
    chartComposicao = new Chart(canvasComp, {
      type: "line",
      data: { labels, datasets: datasetsComp },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y:  { type: "linear", position: "left", title: { display: true, text: "% gordura" } },
          y1: { type: "linear", position: "right", title: { display: true, text: "kg" }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }
}

document.getElementById("formEvolucao").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [nova] = await sb.addEvolucao({
      paciente_id: atual.id, data: f.data.value, peso: +f.peso.value,
      percentual_gordura: f.percentual_gordura.value ? +f.percentual_gordura.value : null,
      massa_muscular: f.massa_muscular.value ? +f.massa_muscular.value : null,
      obs: f.obs.value.trim()
    });
    atual.evolucao = [...(atual.evolucao || []), nova];
    f.reset(); renderEvolucao(); renderResumo();
  } catch (err) {
    avisoErro(err);
  }
});

/* ---------- Medidas corporais ---------- */
function renderMedidas() {
  const ul = document.getElementById("perfilMedidas");
  const ms = (atual.medidas || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = ms.length ? ms.map(m => {
    const partes = [
      m.cintura && `cintura ${m.cintura}`, m.quadril && `quadril ${m.quadril}`,
      m.abdomen && `abdômen ${m.abdomen}`, m.peito && `peito ${m.peito}`,
      m.braco && `braço ${m.braco}`, m.coxa && `coxa ${m.coxa}`, m.panturrilha && `panturrilha ${m.panturrilha}`
    ].filter(Boolean).join(" · ");
    return `<li><strong>${fmt(m.data)}</strong> ${esc(partes) || "sem valores"}</li>`;
  }).join("") : `<li class="empty-li">Nenhuma medida registrada ainda.</li>`;
}

document.getElementById("formMedidas").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const num = v => (v ? +v : null);
  try {
    const [nova] = await sb.addMedida({
      paciente_id: atual.id, data: f.data.value,
      cintura: num(f.cintura.value), quadril: num(f.quadril.value), abdomen: num(f.abdomen.value),
      peito: num(f.peito.value), braco: num(f.braco.value), coxa: num(f.coxa.value), panturrilha: num(f.panturrilha.value)
    });
    atual.medidas = [...(atual.medidas || []), nova];
    f.reset(); renderMedidas();
  } catch (err) {
    avisoErro(err);
  }
});

/* ---------- Plano alimentar (histórico) & suplementação ---------- */
function renderPlanos() {
  const ul = document.getElementById("perfilPlanos");
  const ps = (atual.planos || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = ps.length ? ps.map(p => `
    <li><strong>${esc(p.titulo)}</strong> ${fmt(p.data)}
      <span class="badge ${p.ativo ? "badge--ok" : "badge--off"}">${p.ativo ? "Ativo" : "Encerrado"}</span>
    </li>`).join("") : `<li class="empty-li">Nenhum plano alimentar registrado.</li>`;
}
document.getElementById("formPlano").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [novo] = await sb.addPlano({
      paciente_id: atual.id, titulo: f.titulo.value.trim(), data: f.data.value, ativo: f.ativo.checked
    });
    atual.planos = [...(atual.planos || []), novo];
    f.reset(); renderPlanos();
  } catch (err) { avisoErro(err); }
});

function renderSuplementos() {
  const ul = document.getElementById("perfilSuplementos");
  const ss = (atual.suplementos || []);
  ul.innerHTML = ss.length ? ss.map(s => `
    <li><strong>${esc(s.nome)}</strong> ${esc(s.dose) || ""} ${s.data_inicio ? "· desde " + fmt(s.data_inicio) : ""}</li>`
  ).join("") : `<li class="empty-li">Nenhuma suplementação registrada.</li>`;
}
document.getElementById("formSuplemento").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [novo] = await sb.addSuplemento({
      paciente_id: atual.id, nome: f.nome.value.trim(), dose: f.dose.value.trim(), data_inicio: f.data_inicio.value || null
    });
    atual.suplementos = [...(atual.suplementos || []), novo];
    f.reset(); renderSuplementos();
  } catch (err) { avisoErro(err); }
});

/* ---------- Arquivos: exames e fotos de evolução ---------- */
function linhaArquivo(item) {
  return `<li data-id="${item.id}">
    <div style="flex:1"><strong>${esc(item.nome) || "Arquivo"}</strong> · ${fmt(item.data)}</div>
    <div class="lead-acoes" style="margin:0">
      <button type="button" class="btn btn--ghost" data-arquivo-abrir="${item.id}">Abrir</button>
      <button type="button" class="btn-delete" data-arquivo-del="${item.id}">🗑</button>
    </div>
  </li>`;
}
function ligarAcoesArquivo(ul, bucket, cacheKey) {
  ul.querySelectorAll("[data-arquivo-abrir]").forEach(btn => btn.addEventListener("click", async () => {
    const item = atual[cacheKey].find(i => i.id === +btn.dataset.arquivoAbrir);
    try {
      const url = await sb.getSignedUrl(bucket, item.storage_path);
      window.open(url, "_blank");
    } catch (err) { avisoErro(err); }
  }));
  ul.querySelectorAll("[data-arquivo-del]").forEach(btn => btn.addEventListener("click", async () => {
    const aid = +btn.dataset.arquivoDel;
    const item = atual[cacheKey].find(i => i.id === aid);
    if (!confirm("Excluir este arquivo?")) return;
    try {
      await sb.deleteArquivoRow(aid);
      await sb.deleteArquivoStorage(bucket, item.storage_path).catch(() => {});
      atual[cacheKey] = atual[cacheKey].filter(i => i.id !== aid);
      renderArquivos();
    } catch (err) { avisoErro(err); }
  }));
}
function renderArquivos() {
  const ulE = document.getElementById("perfilExames");
  const ulF = document.getElementById("perfilFotos");
  const exames = (atual.exames || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  const fotos = (atual.fotos || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  ulE.innerHTML = exames.length ? exames.map(linhaArquivo).join("") : `<li class="empty-li">Nenhum exame anexado.</li>`;
  ulF.innerHTML = fotos.length ? fotos.map(linhaArquivo).join("") : `<li class="empty-li">Nenhuma foto de evolução anexada.</li>`;
  ligarAcoesArquivo(ulE, "exames", "exames");
  ligarAcoesArquivo(ulF, "fotos-evolucao", "fotos");
}

async function enviarArquivo(form, bucket, tipo, cacheKey) {
  const file = form.arquivo.files[0];
  if (!file) return;
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    const path = `${atual.id}/${Date.now()}_${file.name}`;
    await sb.uploadArquivo(bucket, path, file);
    const [row] = await sb.addArquivoRow({
      paciente_id: atual.id, tipo, nome: form.nome.value.trim() || file.name, storage_path: path
    });
    atual[cacheKey] = [...(atual[cacheKey] || []), row];
    form.reset(); renderArquivos();
  } catch (err) {
    avisoErro(err);
  } finally {
    btn.disabled = false;
  }
}
document.getElementById("formExame").addEventListener("submit", e => { e.preventDefault(); enviarArquivo(e.target, "exames", "exame", "exames"); });
document.getElementById("formFoto").addEventListener("submit", e => { e.preventDefault(); enviarArquivo(e.target, "fotos-evolucao", "foto_evolucao", "fotos"); });

/* ---------- Metas nutricionais ---------- */
function renderMetasLista() {
  const ul = document.getElementById("perfilMetasLista");
  const ms = (atual.metasLista || []);
  ul.innerHTML = ms.length ? ms.map(m => `
    <li data-id="${m.id}">
      <div style="flex:1">
        <strong>${esc(m.descricao)}</strong> ${m.data_alvo ? "· até " + fmt(m.data_alvo) : ""}
      </div>
      <select data-meta-status="${m.id}" style="padding:.4rem .6rem;border-radius:8px;border:1px solid var(--line)">
        <option value="em andamento" ${m.status === "em andamento" ? "selected" : ""}>Em andamento</option>
        <option value="concluida" ${m.status === "concluida" ? "selected" : ""}>Concluída</option>
        <option value="abandonada" ${m.status === "abandonada" ? "selected" : ""}>Abandonada</option>
      </select>
    </li>`).join("") : `<li class="empty-li">Nenhuma meta cadastrada.</li>`;

  ul.querySelectorAll("[data-meta-status]").forEach(sel => sel.addEventListener("change", async () => {
    const mid = +sel.dataset.metaStatus;
    try {
      await sb.updateMeta(mid, { status: sel.value });
      atual.metasLista = atual.metasLista.map(m => (m.id === mid ? { ...m, status: sel.value } : m));
      renderResumo();
    } catch (err) { avisoErro(err); }
  }));
}
document.getElementById("formMeta").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const [nova] = await sb.addMeta({ paciente_id: atual.id, descricao: f.descricao.value.trim(), data_alvo: f.data_alvo.value || null });
    atual.metasLista = [...(atual.metasLista || []), nova];
    f.reset(); renderMetasLista(); renderResumo();
  } catch (err) { avisoErro(err); }
});

/* ---------- Agenda geral (Fase 4) ---------- */
async function renderAgendaGeral() {
  const ulC = document.getElementById("agendaLista");
  const ulL = document.getElementById("agendaLembretes");
  ulC.innerHTML = `<li class="empty-li">Carregando…</li>`;
  ulL.innerHTML = `<li class="empty-li">Carregando…</li>`;
  try {
    const [consultas, lembretes] = await Promise.all([
      sb.getConsultasFuturas(hojeISO()), sb.getLembretesPendentes()
    ]);
    const nomeDe = pid => pacientesCache.find(p => p.id === pid)?.nome || "Paciente";

    ulC.innerHTML = consultas.length ? consultas.map(c => `
      <li data-id="${c.id}">
        <div style="flex:1;cursor:pointer" data-abrir-paciente="${c.paciente_id}">
          <time>${fmt(c.data)}${c.hora ? " " + c.hora.slice(0,5) : ""}</time>
          <strong>${esc(nomeDe(c.paciente_id))}</strong>
          ${c.tipo ? `<span class="badge badge--off">${esc(c.tipo)}</span>` : ""}
          <span class="badge ${STATUS_BADGE[c.status] || "badge--off"}">${STATUS_LABEL[c.status] || c.status}</span>
          <div style="font-size:.82rem;color:var(--muted)">${esc(c.resumo) || ""}</div>
        </div>
        <div class="lead-acoes" style="margin:0">
          <button type="button" class="btn btn--ghost" data-agenda-status="realizada" data-id="${c.id}">Realizada</button>
          <button type="button" class="btn btn--ghost" data-agenda-status="falta" data-id="${c.id}">Falta</button>
          <button type="button" class="btn btn--ghost" data-agenda-status="cancelada" data-id="${c.id}">Cancelar</button>
        </div>
      </li>`).join("") : `<li class="empty-li">Nenhuma consulta agendada.</li>`;

    ulL.innerHTML = lembretes.length ? lembretes.map(l => `
      <li data-id="${l.id}">
        <div style="flex:1"><strong>${fmt(l.data)}</strong> ${esc(nomeDe(l.paciente_id))} — ${esc(l.texto)}</div>
        <button type="button" class="btn btn--ghost" data-agenda-lembrete-ok="${l.id}">Concluir</button>
      </li>`).join("") : `<li class="empty-li">Nenhum lembrete pendente. ✦</li>`;

    ulC.querySelectorAll("[data-abrir-paciente]").forEach(el => el.addEventListener("click", () => {
      document.querySelectorAll(".side-link[data-view]").forEach(b => b.classList.remove("active"));
      document.querySelector('.side-link[data-view="pacientes"]').classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-pacientes").classList.add("active");
      abrirPerfil(+el.dataset.abrirPaciente);
    }));
    ulC.querySelectorAll("[data-agenda-status]").forEach(btn => btn.addEventListener("click", async () => {
      try {
        await sb.updateConsulta(+btn.dataset.id, { status: btn.dataset.agendaStatus });
        renderAgendaGeral();
      } catch (err) { avisoErro(err); }
    }));
    ulL.querySelectorAll("[data-agenda-lembrete-ok]").forEach(btn => btn.addEventListener("click", async () => {
      try {
        await sb.updateLembrete(+btn.dataset.agendaLembreteOk, { concluido: true });
        renderAgendaGeral();
      } catch (err) { avisoErro(err); }
    }));
  } catch (err) {
    avisoErro(err);
  }
}

/* Fechar modais */
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m || e.target.hasAttribute("data-close")) m.hidden = true; });
});

/* ---------- Exclusão ---------- */
async function confirmarExcluirPaciente(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir o paciente "${nome}"?\nEsta ação é irreversível e excluirá todo o histórico e prontuário.`)) return;
  try {
    await sb.deletePaciente(id);
    pacientesCache = pacientesCache.filter(p => p.id !== id);
    renderDashboard();
    renderPacientes();
  } catch (err) {
    avisoErro(err);
  }
}

async function confirmarExcluirLead(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir o lead de "${nome}"?`)) return;
  try {
    await sb.deleteLead(id);
    leadsCache = leadsCache.filter(l => l.id !== id);
    renderDashboard();
    renderLeads();
  } catch (err) {
    avisoErro(err);
  }
}

async function confirmarExcluirEvolucao(id) {
  if (!confirm("Tem certeza que deseja excluir este registro de evolução?")) return;
  try {
    await sb.deleteEvolucao(id);
    if (atual && atual.evolucao) {
      atual.evolucao = atual.evolucao.filter(r => r.id !== id);
      renderEvolucao();
      renderResumo();
    }
  } catch (err) {
    avisoErro(err);
  }
}

carregarTudo();

document.getElementById("salvarDadosExtra").addEventListener("click", async () => {
  const btn = document.getElementById("salvarDadosExtra");
  const altura = document.getElementById("perfilAltura").value ? +document.getElementById("perfilAltura").value : null;
  const metaPeso = document.getElementById("perfilMetaPeso").value ? +document.getElementById("perfilMetaPeso").value : null;
  
  if (!altura && !metaPeso) {
    alert("Preencha pelo menos a altura ou a meta de peso.");
    return;
  }
  
  const textOriginal = btn.textContent;
  btn.textContent = "Salvando...";
  btn.disabled = true;
  
  try {
    // Auto-correção: se altura for menor que 10, assume que foi digitado em metros
    let alturaCorrigida = altura;
    if (alturaCorrigida && alturaCorrigida < 10) {
      alturaCorrigida = alturaCorrigida * 100;
    }
    
    await persistAtual({ altura_cm: alturaCorrigida, meta_peso: metaPeso });
    btn.textContent = "✓ Salvo!";
    setTimeout(() => { btn.textContent = textOriginal; btn.disabled = false; }, 2000);
    renderEvolucao();
    renderResumo();
  } catch (err) {
    btn.textContent = textOriginal;
    btn.disabled = false;
    avisoErro(err);
  }
});
document.getElementById("salvarObsNutri").addEventListener("click", () => {
  persistAtual({ observacoes_nutri: document.getElementById("perfilObsNutri").value });
});
