import {
  EXACT_FILE_MAP,
  EXTENSION_ICON_MAP,
  FOLDER_ICON_MAP,
} from '@shared/components/file-icon/file-icon.data';

export function resolveFileIcon(
  name: string,
  isDir: boolean,
  isExpanded: boolean,
): string {
  const raw = name.trim().toLowerCase();

  if (isDir) {
    const baseFolderIcon = FOLDER_ICON_MAP[raw];
    if (baseFolderIcon) {
      return isExpanded ? `${baseFolderIcon}-open` : baseFolderIcon;
    }
    return isExpanded ? 'folder-open' : 'folder';
  }

  const exactMatch = EXACT_FILE_MAP[raw];
  if (exactMatch) {
    return exactMatch;
  }

  if (raw.startsWith('.eslintrc')) {
    return 'eslint';
  }
  if (raw.startsWith('.prettierrc')) {
    return 'prettier';
  }
  if (raw.startsWith('tailwind.config')) {
    return 'tailwindcss';
  }
  if (raw.startsWith('vite.config')) {
    return 'vite';
  }
  if (raw.startsWith('webpack.config')) {
    return 'webpack';
  }
  if (
    raw.startsWith('dockerfile') ||
    raw.startsWith('docker-compose') ||
    raw === '.dockerignore'
  ) {
    return 'docker';
  }
  if (
    raw.startsWith('readme') ||
    raw.startsWith('license') ||
    raw.startsWith('changelog')
  ) {
    return 'readme';
  }

  const dotIndex = raw.lastIndexOf('.');
  if (dotIndex === -1) {
    return 'file';
  }

  const ext = raw.substring(dotIndex + 1);
  return EXTENSION_ICON_MAP[ext] ?? 'file';
}
