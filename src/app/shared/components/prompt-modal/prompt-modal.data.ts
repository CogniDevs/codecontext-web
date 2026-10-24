import { CategoryTab } from '@shared/components/prompt-modal/prompt-modal.model';

export const CATEGORY_TABS: readonly CategoryTab[] = [
  { key: 'system_role', title: 'Роль ИИ' },
  { key: 'interaction_protocol', title: 'Протокол диалога' },
  { key: 'quality_standards', title: 'Стандарты качества' },
  { key: 'version_alignment', title: 'Синхронизация версий' },
];

export const XML_TAG_MAP: Readonly<Record<string, string>> = {
  system_role: 'expert_role',
  interaction_protocol: 'interaction_protocol',
  quality_standards: 'code_generation_standards',
  version_alignment: 'technology_alignment',
};
