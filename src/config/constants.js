export const LEGACY_STORAGE_KEY = 'meuFluxo.finance.v1';
export const USER_STORAGE_PREFIX = 'meuFluxo.finance.user.v2';
export const MIGRATION_KEY_PREFIX = 'meuFluxo.finance.migration.v1';

export const DEFAULT_CATEGORIES = Object.freeze([
  ['Cartão', '💳'],
  ['Mercado', '🛒'],
  ['Energia', '⚡'],
  ['Água', '💧'],
  ['Internet', '◉'],
  ['Moradia', '⌂'],
  ['Transporte', '🚗'],
  ['Saúde', '✚'],
  ['Educação', '📚'],
  ['Lazer', '☀'],
  ['Parcelas', '▣'],
  ['Assinaturas', '◌'],
  ['Outros', '•']
]);

export const INCOME_CATEGORIES = Object.freeze([
  ['Salário', '↗'],
  ['Freelance', '✦'],
  ['Venda', '◫'],
  ['Rendimentos', '◌'],
  ['Outros', '•']
]);

export const PROFILE_ACCENTS = Object.freeze(['violet', 'ocean', 'emerald', 'coral', 'sunset']);

export const VIEW_METADATA = Object.freeze({
  dashboard: ['Acompanhe seu dinheiro', 'Visão geral'],
  lancamentos: ['Tudo em um lugar', 'Lançamentos'],
  orcamentos: ['Planeje antes de gastar', 'Orçamentos'],
  relatorios: ['Entenda seus hábitos', 'Relatórios'],
  perfil: ['Seu espaço, do seu jeito', 'Perfil e personalização']
});
