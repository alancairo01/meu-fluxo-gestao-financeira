# Arquitetura do Meu Fluxo

## Camadas

- **Configuração:** categorias, cores permitidas, rótulos de navegação e chave de armazenamento.
- **Core:** utilitários mínimos de DOM e o `StateStore` responsável por normalizar e persistir o estado.
- **Domínio:** regras de parcelas, recorrências, filtros, somatórios e orçamentos.
- **Serviços:** geração de arquivo, leitura de backup, compressão de foto e relatório PDF.
- **Interface:** controles de formulário e renderização das telas.
- **Aplicação:** `FinanceApp` liga eventos, serviços, estado e interface.

## Fluxo de atualização

1. O usuário interage com a interface.
2. `FinanceApp` valida a ação e chama uma regra de domínio ou serviço.
3. O `StateStore` normaliza e salva o novo estado.
4. Os renderizadores atualizam os componentes necessários.

## Convenções

- Funções usam verbos: `render`, `save`, `create`, `apply`, `get`, `find` e `format`.
- IDs de HTML ficam centralizados no próprio elemento e são acessados por `byId`.
- Regras financeiras não dependem do HTML.
- O estado persistido aceita backups das versões anteriores e remove campos descontinuados automaticamente.
