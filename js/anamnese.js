/* ===== Anamnese em etapas · Kerllen Rodrigues Nutrição ===== */

/* Estilos do rascunho (inline para não depender de CSS extra) */
(function injectDraftStyles() {
  if (document.getElementById("kr-draft-styles")) return;
  const s = document.createElement("style");
  s.id = "kr-draft-styles";
  s.textContent = `
    .draft-banner {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .8rem;
      background: #fdf9ef; border: 1px solid #e8d5a3; border-radius: 14px;
      padding: .9rem 1.2rem; margin-bottom: 1.4rem; font-size: .9rem; color: #2b2a26;
    }
    .draft-banner__clear {
      border: 1.4px solid #e5e2da; background: #fff; border-radius: 10px;
      padding: .45rem .9rem; font: 600 .8rem Inter, system-ui, sans-serif; color: #8a8578; cursor: pointer;
    }
    .draft-banner__clear:hover { border-color: #c6a15b; color: #a8823a; }
    .draft-hint {
      text-align: center; font-size: .75rem; color: #8a8578; margin: -.8rem 0 1.2rem;
    }
  `;
  document.head.appendChild(s);
})();

const form = document.getElementById("anamneseForm");
const steps = Array.from(form.querySelectorAll(".step"));
const bar = document.getElementById("progressBar");
const label = document.getElementById("progressLabel");
const btnVoltar = document.getElementById("btnVoltar");
const btnAvancar = document.getElementById("btnAvancar");

const DRAFT_KEY = "kr_anamnese_draft";

let idx = 0;

function visibleSteps() {
  const sexo = form.sexo ? form.sexo.value : "";
  return steps.filter(s => !s.dataset.onlySexo || s.dataset.onlySexo === sexo);
}

function render() {
  const vis = visibleSteps();
  if (idx >= vis.length) idx = vis.length - 1;
  if (idx < 0) idx = 0;
  steps.forEach(s => s.classList.remove("active"));
  vis[idx].classList.add("active");

  const pct = Math.round(((idx + 1) / vis.length) * 100);
  bar.style.width = pct + "%";
  label.textContent = `Etapa ${idx + 1} de ${vis.length} · ${pct}%`;

  btnVoltar.style.visibility = idx === 0 ? "hidden" : "visible";
  btnAvancar.textContent = idx === vis.length - 1 ? "Enviar anamnese ✓" : "Avançar →";
  vis[idx].scrollIntoView({ behavior: "smooth", block: "start" });
}

function validaAtual() {
  const vis = visibleSteps();
  let ok = true;
  vis[idx].querySelectorAll("[required]").forEach(el => {
    const vazio = !el.value.trim();
    el.classList.toggle("invalid", vazio);
    if (vazio) ok = false;
  });
  return ok;
}

btnAvancar.addEventListener("click", () => {
  if (!validaAtual()) return;
  salvarRascunho();
  const vis = visibleSteps();
  if (idx < vis.length - 1) { idx++; render(); }
  else enviar();
});
btnVoltar.addEventListener("click", () => {
  if (idx > 0) { idx--; render(); salvarRascunho(); }
});

const xixiCores = [
  { cor: "#f7f6ee", nivel: "good", texto: "Excelente! Hidratação em dia. 💧" },
  { cor: "#f5f1d8", nivel: "good", texto: "Muito bom — hidratação adequada." },
  { cor: "#f2e9b8", nivel: "good", texto: "Boa hidratação, continue assim." },
  { cor: "#eeda8f", nivel: "mid",  texto: "Atenção: beba um pouco mais de água ao longo do dia." },
  { cor: "#e5c563", nivel: "mid",  texto: "Sinal de alerta — aumente sua ingestão de água." },
  { cor: "#d4a938", nivel: "bad",  texto: "Desidratação provável. Priorize a água hoje!" },
  { cor: "#b8871f", nivel: "bad",  texto: "Desidratação importante — hidrate-se com urgência." },
  { cor: "#96660f", nivel: "bad",  texto: "Nível crítico. Procure se hidratar e observar os sintomas." }
];
let xixiSelecionado = null;

const xixiWrap = document.getElementById("xiximetro");
const xixiFeedback = document.getElementById("xixiFeedback");
xixiCores.forEach((c, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "xixi";
  b.style.background = c.cor;
  b.textContent = i + 1;
  b.setAttribute("aria-label", `Tom ${i + 1}`);
  b.addEventListener("click", () => {
    xixiSelecionado = i + 1;
    xixiWrap.querySelectorAll(".xixi").forEach(x => x.classList.remove("selected"));
    b.classList.add("selected");
    xixiFeedback.hidden = false;
    xixiFeedback.className = `xixi-feedback xixi-feedback--${c.nivel}`;
    xixiFeedback.textContent = `Nível ${i + 1} de 8 — ${c.texto}`;
    salvarRascunho();
  });
  xixiWrap.appendChild(b);
});

const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const weekGrid = document.getElementById("weekGrid");
dias.forEach(dia => {
  const row = document.createElement("div");
  row.className = "week-day";
  row.innerHTML = `
    <span>${dia.slice(0, 3)}</span>
    <input type="text" data-dia="${dia}" data-campo="atividade" placeholder="Atividade (ex.: musculação 1h)">
    <select data-dia="${dia}" data-campo="intensidade">
      <option value="">Intensidade</option>
      <option>Leve</option><option>Moderada</option><option>Intensa</option>
    </select>`;
  weekGrid.appendChild(row);
});

function coletarRascunho() {
  const campos = {};
  form.querySelectorAll("input, select, textarea").forEach(el => {
    if (!el.name) return;
    if (el.type === "radio") {
      if (el.checked) campos[el.name] = el.value;
    } else if (el.type === "checkbox") {
      if (!campos[el.name]) campos[el.name] = [];
      if (el.checked) campos[el.name].push(el.value);
    } else {
      campos[el.name] = el.value;
    }
  });

  const treinos = {};
  weekGrid.querySelectorAll("[data-dia]").forEach(el => {
    const dia = el.dataset.dia;
    treinos[dia] = treinos[dia] || {};
    if (el.value) treinos[dia][el.dataset.campo] = el.value;
  });

  return {
    campos,
    treinos,
    xiximetro: xixiSelecionado,
    idx,
    salvoEm: new Date().toISOString()
  };
}

function salvarRascunho() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(coletarRascunho()));
    mostrarIndicadorRascunho();
  } catch (e) {
    console.warn("Não foi possível salvar o rascunho:", e);
  }
}

function limparRascunho() {
  localStorage.removeItem(DRAFT_KEY);
  const el = document.getElementById("draftHint");
  if (el) el.remove();
}

function restaurarRascunho() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch { return false; }
  if (!draft || !draft.campos) return false;

  const { campos, treinos, xiximetro, idx: savedIdx } = draft;

  Object.keys(campos).forEach(name => {
    const val = campos[name];
    const els = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
    if (!els.length) return;

    els.forEach(el => {
      if (el.type === "radio") {
        el.checked = el.value === val;
      } else if (el.type === "checkbox") {
        const arr = Array.isArray(val) ? val : [val];
        el.checked = arr.includes(el.value);
      } else {
        el.value = val ?? "";
      }
    });
  });

  if (treinos) {
    weekGrid.querySelectorAll("[data-dia]").forEach(el => {
      const dia = el.dataset.dia;
      const campo = el.dataset.campo;
      if (treinos[dia] && treinos[dia][campo] != null) {
        el.value = treinos[dia][campo];
      }
    });
  }

  if (xiximetro && xiximetro >= 1 && xiximetro <= 8) {
    xixiSelecionado = xiximetro;
    const botoes = xixiWrap.querySelectorAll(".xixi");
    const b = botoes[xiximetro - 1];
    if (b) {
      b.classList.add("selected");
      const c = xixiCores[xiximetro - 1];
      xixiFeedback.hidden = false;
      xixiFeedback.className = `xixi-feedback xixi-feedback--${c.nivel}`;
      xixiFeedback.textContent = `Nível ${xiximetro} de 8 — ${c.texto}`;
    }
  }

  if (typeof savedIdx === "number" && savedIdx >= 0) {
    idx = savedIdx;
  }

  mostrarBannerRascunho(draft.salvoEm);
  return true;
}

function mostrarBannerRascunho(salvoEm) {
  if (document.getElementById("draftBanner")) return;
  const quando = salvoEm
    ? new Date(salvoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const banner = document.createElement("div");
  banner.id = "draftBanner";
  banner.className = "draft-banner";
  banner.innerHTML = `
    <span>✦ Rascunho restaurado${quando ? " de " + quando : ""}. Você pode continuar de onde parou.</span>
    <button type="button" id="btnLimparDraft" class="draft-banner__clear">Descartar e recomeçar</button>
  `;
  const head = document.querySelector(".anamnese-head");
  if (head) head.after(banner);
  document.getElementById("btnLimparDraft").addEventListener("click", () => {
    if (!confirm("Apagar o rascunho e recomeçar do zero?")) return;
    limparRascunho();
    form.reset();
    xixiSelecionado = null;
    xixiWrap.querySelectorAll(".xixi").forEach(x => x.classList.remove("selected"));
    xixiFeedback.hidden = true;
    weekGrid.querySelectorAll("input, select").forEach(el => { el.value = ""; });
    idx = 0;
    banner.remove();
    render();
  });
}

function mostrarIndicadorRascunho() {
  let el = document.getElementById("draftHint");
  if (!el) {
    el = document.createElement("p");
    el.id = "draftHint";
    el.className = "draft-hint";
    label.after(el);
  }
  el.textContent = "Progresso salvo automaticamente neste dispositivo";
  el.hidden = false;
}

let saveTimer = null;
form.addEventListener("input", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvarRascunho, 600);
});
form.addEventListener("change", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvarRascunho, 200);
});
weekGrid.addEventListener("input", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvarRascunho, 600);
});
weekGrid.addEventListener("change", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvarRascunho, 200);
});

function coletar() {
  const data = { identificacao: {}, respostas: {}, treinos: {}, enviadoEm: new Date().toISOString() };
  const fd = new FormData(form);

  data.identificacao = {
    nome: fd.get("nome") || "", idade: fd.get("idade") || "",
    sexo: fd.get("sexo") || "", telefone: fd.get("telefone") || ""
  };

  const multi = {};
  for (const [k, v] of fd.entries()) {
    if (["nome", "idade", "sexo", "telefone"].includes(k)) continue;
    if (multi[k]) multi[k].push(v);
    else multi[k] = [v];
  }
  Object.keys(multi).forEach(k => { data.respostas[k] = multi[k].length > 1 ? multi[k] : multi[k][0]; });

  data.respostas.xiximetro = xixiSelecionado ? `Nível ${xixiSelecionado} de 8` : "Não informado";
  data.respostas.peso = fd.get("peso") || null;
  data.respostas.altura = fd.get("altura") || null;

  weekGrid.querySelectorAll("[data-dia]").forEach(el => {
    const dia = el.dataset.dia;
    data.treinos[dia] = data.treinos[dia] || {};
    if (el.value) data.treinos[dia][el.dataset.campo] = el.value;
  });

  return data;
}

async function enviar() {
  if (!validaAtual()) return;
  const data = coletar();
  btnAvancar.disabled = true;
  console.log("DADOS COLETADOS PARA ENVIO:", data);
  try {
    const payload = {
      nome: data.identificacao.nome || "Sem nome",
      telefone: data.identificacao.telefone || "",
      sexo: data.identificacao.sexo || "",
      idade: data.identificacao.idade ? parseInt(data.identificacao.idade) : null,
      respostas: data.respostas || {},
      treinos: data.treinos || {}
    };
    console.log("PAYLOAD FINAL:", payload);
    await sb.saveAnamnese(payload);

    try {
      await sb.saveLead({
        nome: payload.nome,
        whatsapp: payload.telefone,
        objetivo: payload.respostas.queixa || "Preencheu Anamnese"
      });
      console.log("Lead criado com sucesso a partir da anamnese");
    } catch (e) {
      console.error("Erro ao criar lead automático:", e);
    }

    limparRascunho();
    form.hidden = true;
    document.querySelector(".progress").hidden = true;
    label.hidden = true;
    const hint = document.getElementById("draftHint");
    if (hint) hint.hidden = true;
    const banner = document.getElementById("draftBanner");
    if (banner) banner.remove();
    document.getElementById("successCard").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    alert("Não foi possível enviar a anamnese agora. Tente novamente em instantes.");
    btnAvancar.disabled = false;
  }
}

document.getElementById("campoSexo").addEventListener("change", () => {
  render();
  salvarRascunho();
});

restaurarRascunho();
render();
