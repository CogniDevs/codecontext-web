import { SettingsModalTabItem } from '@shared/components/settings-modal/settings-modal.model';

export const SETTINGS_TABS: readonly SettingsModalTabItem[] = [
  { id: 'general', label: 'Общие' },
  { id: 'extensions', label: 'Расширения файлов' },
  { id: 'excludes', label: 'Папки-исключения' },
  { id: 'gitignore', label: 'Исключения .gitignore' },
];
