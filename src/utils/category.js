import { DEFAULT_CATEGORIES, INCOME_CATEGORIES } from '../config/constants.js';

export function getCategoryIcon(category) {
  return [...DEFAULT_CATEGORIES, ...INCOME_CATEGORIES].find(([name]) => name === category)?.[1] || '•';
}
