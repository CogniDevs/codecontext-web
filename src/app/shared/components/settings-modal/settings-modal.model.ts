export type SettingsTab = 'general' | 'extensions' | 'excludes' | 'gitignore';

export type SettingsPresetMap = Readonly<Record<string, readonly string[]>>;

export interface SettingsModalTabItem {
  readonly id: SettingsTab;
  readonly label: string;
}
