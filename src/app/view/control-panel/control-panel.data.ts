import { PromptPreset } from '@models/prompt.model';
import { BudgetOption } from '@view/control-panel/control-panel.model';

export const FALLBACK_PRESETS: readonly PromptPreset[] = [
  { key: 'just_code', title: 'Только контекст (Без инструкций)', prompt: '' },
];

export const BUDGET_OPTIONS: readonly BudgetOption[] = [
  { label: 'Без ограничений', value: null },
  { label: '32,000 токенов', value: 32000 },
  { label: '64,000 токенов', value: 64000 },
  { label: '128,000 токенов', value: 128000 },
  { label: '200,000 токенов', value: 200000 },
];
