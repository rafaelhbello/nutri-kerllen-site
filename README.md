# Kerllen Rodrigues · Nutrição Clínica e Esportiva

Plataforma web completa: landing page, painel da nutricionista e formulário de anamnese.
HTML5 + CSS3 + JavaScript puro — sem dependências, pronto para rodar.

## Como usar

1. Extraia o ZIP em qualquer pasta.
2. **Adicione a foto da Kerllen** em `assets/kerllen.jpg` (formato retrato, ex.: 800×1000px).
   Enquanto a foto não existir, o site mostra um placeholder elegante no lugar.
3. Abra `index.html` no navegador. Pronto!

Para publicar de graça: Netlify Drop (arraste a pasta), Vercel ou GitHub Pages.

## Configurações rápidas

- **WhatsApp e Instagram** → edite as duas primeiras linhas de `js/main.js`:
  ```js
  const WHATSAPP_NUMBER = "5585900000000"; // DDI + DDD + número
  const INSTAGRAM_URL = "https://instagram.com/seu_perfil";
  ```
- **CRN** → troque "CRN 00000" em `index.html` e demais textos que quiser ajustar.

## Estrutura

```
index.html      → Landing page (hero, sobre, serviços, depoimentos, formulário de lead)
painel.html     → Painel da nutricionista (dashboard, pacientes, prontuário, leads)
anamnese.html   → Área do paciente: anamnese em 18 etapas com barra de progresso
css/style.css   → Estilos globais + landing
css/app.css     → Estilos do painel e da anamnese
js/main.js      → Interações da landing + captura de leads
js/painel.js    → Lógica do painel (dados salvos no navegador via localStorage)
js/anamnese.js  → Wizard da anamnese, Xixímetro interativo e grade de treinos
assets/         → Coloque aqui a foto kerllen.jpg
```

## O que já funciona

- Leads da landing são salvos e aparecem na aba "Leads do site" do painel, além de abrir o WhatsApp com mensagem pronta.
- Painel com métricas, busca/filtros de pacientes, perfil com metas, histórico de consultas e registro de evolução de peso.
- Anamnese com os 17 tópicos solicitados, etapa condicional de ciclo menstrual (só aparece para sexo feminino), Xixímetro com 8 tons e feedback automático, e grade semanal de treinos.
- Ao enviar a anamnese, o status do paciente correspondente (mesmo nome) muda para "Completa" no painel.

> Os dados ficam no navegador (localStorage) — ideal para demonstração e uso pessoal.
> Para multiusuário real, o próximo passo é conectar um backend (ex.: Firebase ou Supabase).
