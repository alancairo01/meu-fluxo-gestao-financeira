# Meu Fluxo — Login e sincronização com Supabase

Aplicação de gestão financeira com login por e-mail e senha, dados separados por usuário e sincronização no Supabase.

## Executar no computador

1. Crie um arquivo `.env` usando `.env.example` como base.
2. Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. Execute `npm install` e depois `npm start`.
4. Acesse `http://localhost:3000`.

## Implantar no Render

Configure as variáveis de ambiente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
Use `npm install` como Build Command, `npm start` como Start Command e `/health` como Health Check Path.

## Configuração do banco

Execute o arquivo `supabase/schema.sql` no SQL Editor do Supabase. O guia completo está em `docs/SETUP-SUPABASE-RENDER.md`.

## Segurança

Use apenas a Publishable Key (`sb_publishable_...`) no projeto. Nunca use uma chave Secret (`sb_secret_...`) ou Service Role no navegador ou no Render para este sistema.
