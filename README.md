# SmartPharma - Sistema de Gestão de Compras (Supabase Edition)

Este é um sistema completo para farmácias gerenciarem suas cotações e encontrarem automaticamente os melhores preços entre os fornecedores para maximizar o lucro. Ele roda inteiramente no navegador sem a necessidade de hospedar um servidor Python complexo, utilizando o poder do **Supabase** (Backend as a Service).

## Tecnologias Utilizadas
- **Frontend, Regras e UI:** React (Vite 8), Tailwind CSS v4, Lucide React
- **Banco de Dados em Nuvem e API:** Supabase (PostgreSQL)

---

## 🚀 Como Executar o Projeto com Supabase

### 1. Crie seu Banco de Dados no Supabase
O sistema precisa de um lugar para guardar os produtos e cotações reais. O Supabase é excelente porque é online e tem um "Nível Gratuito" generoso.
1. Acesse [supabase.com](https://supabase.com) e crie uma conta / faça login.
2. Clique em **"New Project"**.
3. Escolha uma senha forte para o banco de dados e prossiga. Aguarde a criação (demora uns 2 minutos).
4. No menu lateral esquerdo do Supabase, vá em **SQL Editor**.
5. Abra o arquivo que criamos chamado `supabase_schema.sql` (encontrado na pasta `/frontend/` do seu computador), copie todo o texto lá de dentro, cole no SQL Editor do Supabase e clique no botão verde **Run**. Isso criará as tabelas do Sistema na nuvem.

### 2. Conecte sua conta ao SmartPharma
1. Ainda no painel do Supabase, clique na "Engrenagem" (**Project Settings**) no final do menu esquerdo e depois em **API**.
2. Copie os valores do _Project URL_ (URL principal) e da sua _Project API keys -> anon_ (Key pública).
3. Na pasta `frontend` do seu computador, crie um arquivo chamado `.env.local`.
4. Adicione as chaves que você copiou exatamente neste formato:
```env
VITE_SUPABASE_URL=cole_sua_url_aqui
VITE_SUPABASE_ANON_KEY=cole_sua_anon_key_aqui
```

### 3. Rode o Sistema
Abra um terminal na pasta do projeto e navegue para a pasta `frontend`.
Execute:
```bash
npm install
npm run dev
```

Pronto! Acesse o link (normalmente `http://localhost:5175`) e tudo estará 100% gravando de verdade no banco de dados e gerando os relatórios de economia automaticamente!
