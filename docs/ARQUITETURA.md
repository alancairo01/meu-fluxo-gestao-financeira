# Arquitetura do Meu Fluxo

## Camadas

```text
src/
├── app.js                         Coordena as telas e os casos de uso.
├── config/                        Constantes fixas do sistema.
├── core/                          Acesso seguro ao DOM.
├── domain/                        Regras de lançamentos, orçamento e estado.
├── services/                      Autenticação, Supabase, arquivos, foto e relatórios.
├── ui/                            Formulários, preferências e renderizadores.
└── utils/                         Datas, textos, IDs e valores monetários.
```

## Fluxo de dados

```text
Interface
  ↓
FinanceApp
  ↓
FinanceRepository
  ↓
Supabase Auth, PostgreSQL e Storage
```

A cópia local por usuário é um cache e apoio para recuperação. O Supabase é a fonte principal dos dados sincronizados.

## Módulos principais

| Arquivo | Responsabilidade |
|---|---|
| `services/auth-service.js` | Login, cadastro, recuperação e encerramento de sessão. |
| `services/finance-repository.js` | Leitura e escrita das informações da conta no Supabase. |
| `services/migration-service.js` | Importação de dados da versão local e de backups. |
| `services/profile-storage-service.js` | Redução de foto e envio ao bucket privado. |
| `domain/state.js` | Normalização e cache local por usuário. |
| `domain/entries.js` | Parcelas, recorrência, filtros e resumos financeiros. |
| `ui/renderers/` | Atualização visual de cada aba. |

## Segurança

O navegador usa apenas a Publishable Key do Supabase. As tabelas e o bucket possuem RLS para que cada consulta seja limitada ao identificador do usuário autenticado.
