/* ===== Kerllen Rodrigues · Landing page ===== */

/* Configure aqui os contatos reais */
const WHATSAPP_NUMBER = "5585900000000"; // DDI + DDD + número, só dígitos
const INSTAGRAM_URL = "https://instagram.com/"; // perfil da nutricionista

/* Header sombra ao rolar */
const header = document.getElementById("header");
window.addEventListener("scroll", () => {
  header.classList.toggle("header--scrolled", window.scrollY > 12);
});

/* Menu mobile */
const hamburger = document.getElementById("hamburger");
const nav = document.getElementById("nav");
hamburger.addEventListener("click", () => nav.classList.toggle("open"));
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

/* Reveal on scroll */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

/* Contador animado das métricas */
const counters = document.querySelectorAll("[data-count]");
const ioCount = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = +el.dataset.count;
    const dur = 1400, t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString("pt-BR") + (el.dataset.count === "98" ? "" : "+");
    };
    requestAnimationFrame(tick);
    ioCount.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => ioCount.observe(c));

/* Máscara simples de telefone */
const zapInput = document.getElementById("leadZap");
zapInput.addEventListener("input", () => {
  let v = zapInput.value.replace(/\D/g, "").slice(0, 11);
  if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  zapInput.value = v;
});

/* Formulário de lead → salva localmente e abre WhatsApp */
const leadForm = document.getElementById("leadForm");
leadForm.addEventListener("submit", e => {
  e.preventDefault();
  const nome = leadForm.nome.value.trim();
  const whatsapp = leadForm.whatsapp.value.trim();
  const objetivo = leadForm.objetivo.value;

  let ok = true;
  [["leadNome", nome], ["leadZap", whatsapp.replace(/\D/g, "").length >= 10 ? "x" : ""], ["leadObjetivo", objetivo]]
    .forEach(([id, val]) => {
      const el = document.getElementById(id);
      el.classList.toggle("invalid", !val);
      if (!val) ok = false;
    });
  if (!ok) return;

  const leads = JSON.parse(localStorage.getItem("kr_leads") || "[]");
  leads.push({ nome, whatsapp, objetivo, data: new Date().toISOString() });
  localStorage.setItem("kr_leads", JSON.stringify(leads));

  document.getElementById("leadOk").hidden = false;
  const msg = encodeURIComponent(
    `Olá, Kerllen! Me chamo ${nome} e meu objetivo é: ${objetivo}. Gostaria de agendar uma avaliação.`
  );
  setTimeout(() => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    leadForm.reset();
  }, 900);
});

/* Links dinâmicos */
document.getElementById("footerZap").href = `https://wa.me/${WHATSAPP_NUMBER}`;
document.querySelectorAll('a[href="#"][target="_blank"]').forEach(a => (a.href = INSTAGRAM_URL));
document.getElementById("year").textContent = new Date().getFullYear();
