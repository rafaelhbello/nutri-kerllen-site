# Kerllen Rodrigues · Nutrição Clínica e Esportiva

Site completo (landing page, painel da nutricionista com login e área de anamnese do paciente),
agora com **Supabase** como backend real (sem `localStorage`).

## Estrutura

```
index.html          → Landing page (hero, sobre, serviços, depoimentos, formulário de lead)
login.html           → Login da nutricionista (Supabase Auth)
painel.html           → Painel protegido: dashboard, pacientes, prontuário, leads
anamnese.html        → Área do paciente: anamnese em etapas, Xixímetro, grade de treinos
css/style.css        → Estilos globais + landing
css/app.css          → Estilos do painel e da anamnese
js/supabase.js       → Client do Supabase (auth + todas as chamadas REST)
js/main.js           → Interações da landing + captura de leads (grava em `leads`)
js/painel.js         → Lógica do painel, 100% via Supabase (pacientes, consultas, evolução, leads)
js/anamnese.js       → Wizard da anamnese, grava em `anamneses`
supabase-schema.sql  → Script para criar as tabelas e políticas de segurança (RLS)
assets/              → Foto da Kerllen (kerllen.jpg)
```

## Configuração

1. **Banco de dados**: no projeto Supabase, abra *SQL Editor > New query*, cole o conteúdo de
   `supabase-schema.sql` e rode.
2. **Credenciais**: já estão em `js/supabase.js` (`SUPABASE_URL` e `SUPABASE_KEY`, a chave
   publishable/anon). Troque aqui se for usar outro projeto.
3. **Usuário da nutricionista**: crie um usuário em *Authentication > Users* no Supabase
   (e-mail + senha) — é com ele que se faz login em `login.html`.
4. Abra `index.html` no navegador (ou publique via Netlify Drop, Vercel ou GitHub Pages).

## O que já funciona

- Leads da landing são gravados na tabela `leads` (inserção pública) e abrem o WhatsApp com
  mensagem pronta.
- `painel.html` é protegido: sem sessão válida, redireciona para `login.html`. Login via
  Supabase Auth (e-mail/senha).
- Painel com métricas, agenda do dia (consultas com `data = hoje`), busca/filtros de pacientes,
  perfil com metas, histórico de consultas e registro de evolução de peso — tudo lido e gravado
  no Supabase (`pacientes`, `consultas`, `evolucao`).
- Anamnese com os tópicos solicitados, etapa condicional de ciclo menstrual, Xixímetro e grade
  semanal de treinos — grava na tabela `anamneses` (inserção pública, sem exigir login do
  paciente).
- Ao enviar a anamnese, o paciente correspondente (mesmo nome) é marcado como `anamnese: completa`
  automaticamente no Supabase na próxima vez que o painel é aberto.

## Segurança (RLS)

- `leads` e `anamneses`: qualquer visitante pode **inserir** (formulários públicos), mas só
  usuário autenticado pode **ler**.
- `pacientes`, `consultas`, `evolucao`: somente usuário autenticado (a nutricionista) pode ler
  e gerenciar.
