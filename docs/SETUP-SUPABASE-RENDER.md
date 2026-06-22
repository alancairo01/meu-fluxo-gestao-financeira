# Configuração do Meu Fluxo com Supabase e Render

## 1. Criar o projeto no Supabase

1. Acesse o painel do Supabase e crie um projeto.
2. Defina uma senha forte para o banco e aguarde a criação terminar.
3. Abra **SQL Editor**.
4. Crie uma nova consulta.
5. Cole todo o conteúdo de `supabase/schema.sql`.
6. Execute a consulta uma única vez.

Esse arquivo cria as tabelas, as políticas de segurança por usuário, o bucket privado de fotos e o gatilho que prepara os registros de uma nova conta.

## 2. Configurar autenticação

No Supabase, abra **Authentication** e confirme que o login por e-mail está habilitado.

Em **URL Configuration**, configure:

- Site URL: `https://SEU-SITE.onrender.com`
- Redirect URLs: `https://SEU-SITE.onrender.com/`
- Redirect URLs para desenvolvimento: `http://localhost:3000/`

Substitua `SEU-SITE` pela URL real da sua aplicação no Render.

O sistema funciona tanto com confirmação de e-mail habilitada quanto desabilitada. Com a confirmação habilitada, após criar a conta o usuário precisa abrir o e-mail enviado pelo Supabase antes de entrar.

## 3. Copiar os dados públicos de conexão

No Supabase, abra **Project Settings** e depois **API** ou **Data API**.

Copie somente:

- Project URL
- Publishable key, iniciada por `sb_publishable_`

Não use a chave secreta. Uma chave `sb_secret_...` ou Service Role Key nunca deve ser colocada no Render para este sistema nem enviada ao navegador.

## 4. Configurar o Render

No seu serviço atual do Render, abra **Environment** e crie estas variáveis:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | Project URL copiada do Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key copiada do Supabase |

Use:

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Depois de salvar as variáveis, faça um novo deploy.

O arquivo `render.yaml` também está incluído para facilitar uma implantação nova a partir do GitHub.

## 5. Executar no computador

Na pasta do projeto, crie um arquivo chamado `.env` com base em `.env.example`:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publica
```

Depois rode:

```powershell
npm install
npm start
```

Abra `http://localhost:3000`.

## 6. Importar os dados atuais

Ao entrar pela primeira vez, o sistema verifica se existem lançamentos, orçamento e perfil salvos na versão local neste computador.

Quando encontrar dados, será exibida a opção **Importar para minha conta**. Ao confirmar:

1. Os lançamentos e parcelas são copiados para a conta.
2. Perfil, tema, acessibilidade e orçamento são sincronizados.
3. A foto de perfil é enviada para o bucket privado da conta.
4. Os dados locais não são apagados automaticamente.

Gere um Backup JSON antes da primeira atualização por segurança. Depois da migração, os backups continuam funcionando como uma segunda cópia.

## 7. Segurança da informação

Cada tabela possui uma coluna vinculada ao usuário autenticado e políticas RLS. Assim, o banco só aceita leitura e alteração quando o identificador da sessão corresponde ao dono do registro.

As fotos são gravadas em um bucket privado dentro de uma pasta com o identificador da conta. A aplicação usa links temporários para exibir a imagem somente ao usuário autorizado.

## 8. Teste final

1. Crie duas contas diferentes.
2. Cadastre um lançamento em cada conta.
3. Saia e entre novamente com cada conta.
4. Confirme que os dados de uma conta não aparecem na outra.
5. Em outro navegador ou celular, entre com a primeira conta e confirme a sincronização.
