/* ===== Anamnese em etapas · Kerllen Rodrigues Nutrição ===== */

const form = document.getElementById("anamneseForm");
const steps = Array.from(form.querySelectorAll(".step"));
const bar = document.getElementById("progressBar");
const label = document.getElementById("progressLabel");
const btnVoltar = document.getElementById("btnVoltar");
const btnAvancar = document.getElementById("btnAvancar");

let idx = 0;

/* Etapas visíveis (o ciclo menstrual só entra se sexo = feminino) */
function visibleSteps() {
  const sexo = form.sexo ? form.sexo.value : "";
  return steps.filter(s => !s.dataset.onlySexo || s.dataset.onlySexo === sexo);
}

function render() {
  const vis = visibleSteps();
  if (idx >= vis.length) idx = vis.length - 1;
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
  const vis = visibleSteps();
  if (idx < vis.length - 1) { idx++; render(); }
  else enviar();
});
btnVoltar.addEventListener("click", () => { if (idx > 0) { idx--; render(); } });

/* ---------- Xixímetro ---------- */
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
  });
  xixiWrap.appendChild(b);
});

/* ---------- Grade semanal de treinos ---------- */
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

/* ---------- Envio ---------- */
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

  weekGrid.querySelectorAll("[data-dia]").forEach(el => {
    const dia = el.dataset.dia;
    data.treinos[dia] = data.treinos[dia] || {};
    if (el.value) data.treinos[dia][el.dataset.campo] = el.value;
  });

  return data;
}

function enviar() {
  if (!validaAtual()) return;
  const data = coletar();
  const all = JSON.parse(localStorage.getItem("kr_anamneses") || "[]");
  all.push(data);
  localStorage.setItem("kr_anamneses", JSON.stringify(all));

  form.hidden = true;
  document.querySelector(".progress").hidden = true;
  label.hidden = true;
  document.getElementById("successCard").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Recalcula fluxo quando o sexo muda (etapa condicional) */
document.getElementById("campoSexo").addEventListener("change", render);

render();
