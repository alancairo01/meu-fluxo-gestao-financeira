# Meu Fluxo — Código estruturado

Aplicação local de gestão financeira pessoal. Esta versão mantém os dados já salvos no navegador e reorganiza o código para facilitar correções, evolução e manutenção.

## Como executar

```powershell
npm start
```

Abra `http://localhost:3000` no navegador. Também é possível usar o arquivo **Abrir Meu Fluxo.bat**.

## Organização do código

```text
src/
├── config/       Constantes e configurações da aplicação
├── core/         Acesso ao DOM e armazenamento do estado
├── domain/       Regras de negócio de lançamentos, orçamento e estado
├── services/     Backup, CSV, foto de perfil e relatório PDF
├── ui/           Formulários, preferências, perfil e renderizadores
├── utils/        Datas, valores, categorias e identificadores
├── app.js        Orquestra os fluxos e eventos da aplicação
└── main.js       Ponto de entrada da interface
```

## Regras adotadas

- Responsabilidades separadas por módulo.
- Estado centralizado no `StateStore`.
- Regras financeiras fora da camada visual.
- Renderização dividida por tela: Home, Lançamentos, Orçamentos e Relatórios.
- Backup e restauração continuam compatíveis com os dados existentes.
- Sem dependências externas de JavaScript.
- Comentários de código, quando necessários, seguem o formato `//` e descrevem somente a função ou método.

## Atualização sem perder os dados

1. Feche o servidor atual com `Ctrl + C`.
2. Extraia esta versão em uma nova pasta ou substitua os arquivos do projeto atual.
3. Mantenha o mesmo navegador: os lançamentos permanecem no `localStorage` com a chave `meuFluxo.finance.v1`.
4. Execute `npm start` e atualize a página com `Ctrl + F5`.
