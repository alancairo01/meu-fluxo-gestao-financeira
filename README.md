# Meu Fluxo — Gestão Financeira

Aplicação local para organizar receitas, despesas, categorias, contas recorrentes e compras parceladas.

## Rodar sem instalar nada

Dê dois cliques em `Abrir Meu Fluxo.bat` ou abra `index.html` no navegador.

## Rodar pelo terminal (Node.js)

No PowerShell, dentro desta pasta:

```powershell
npm install
npm start
```

Depois, abra: `http://localhost:3000`

> Esta aplicação não depende de banco de dados ou internet. Os dados ficam salvos no navegador do seu computador. Use **Backup** dentro do sistema periodicamente para guardar seus lançamentos.

## Recursos principais

- Receitas e despesas por categoria;
- Cartão, mercado, energia, moradia, transporte e outras categorias;
- Compras parceladas com total de parcelas e parcela atual (ex.: 3 de 12);
- Geração automática das próximas parcelas;
- Contas recorrentes mensais;
- Resumo mensal, orçamento por categoria e relatórios;
- Exportação CSV e backup JSON.

## Acessibilidade

O menu **Acessibilidade** permite ajustar a experiência conforme a necessidade:

- Texto normal, maior ou extra grande;
- Alto contraste;
- Redução de animações e transições;
- Navegação completa pelo teclado, com foco visível em botões e campos;
- Atalho “Pular para o conteúdo principal” ao pressionar `Tab` no início da página;
- Campos obrigatórios identificados, mensagens de erro e avisos anunciados para leitores de tela;
- Rótulos claros para filtros, tabela, gráficos, botões de editar e excluir;
- Gráfico e barras de orçamento com descrição textual, não dependendo apenas de cores.

### Teclado

- `Tab`: avança entre os campos e botões;
- `Shift + Tab`: volta;
- `Enter` ou `Espaço`: ativa botões e opções;
- `Esc`: fecha janelas de lançamento e acessibilidade.


## Simplificação do novo lançamento

O formulário de novo lançamento foi simplificado: foram removidos os campos **Forma de pagamento**, **Cartão ou conta** e **Status**. A categoria **Cartão** continua disponível para classificar compras feitas no cartão.

## Atualização: data padrão e relatório em PDF

- Ao abrir **Novo lançamento**, a data é preenchida automaticamente para o **dia 05 do próximo mês**. A data pode ser alterada quando necessário.
- Após salvar, o mês de referência muda automaticamente para o mês do lançamento, garantindo que ele apareça imediatamente na Visão geral.
- Em **Relatórios**, o botão **Gerar relatório PDF** abre uma versão profissional do resumo mensal. Na tela de impressão do navegador, escolha **Salvar como PDF**.

## Limpar todos os dados

Na aba **Relatórios**, em **Gerenciamento de dados**, há a opção **Limpar todos os dados**. Ela remove lançamentos, parcelas futuras e orçamentos salvos neste navegador. As preferências de tema e acessibilidade são mantidas. Antes de confirmar, o sistema recomenda gerar um **Backup JSON**.
