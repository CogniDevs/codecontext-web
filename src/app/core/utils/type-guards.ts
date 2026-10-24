export interface WebkitFileSystemEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  readonly fullPath: string;
}

export interface WebkitFileEntry extends WebkitFileSystemEntry {
  readonly isFile: true;
  readonly isDirectory: false;
  file(
    successCallback: (file: File) => void,
    errorCallback?: (error: unknown) => void,
  ): void;
}

export interface WebkitDirectoryReader {
  readEntries(
    successCallback: (entries: WebkitFileSystemEntry[]) => void,
    errorCallback?: (error: unknown) => void,
  ): void;
}

export interface WebkitDirectoryEntry extends WebkitFileSystemEntry {
  readonly isFile: false;
  readonly isDirectory: true;
  createReader(): WebkitDirectoryReader;
  getFile?(
    path: string,
    options?: { create?: boolean; exclusive?: boolean },
    successCallback?: (entry: WebkitFileSystemEntry) => void,
    errorCallback?: (error: unknown) => void,
  ): void;
}

export interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}

export interface WindowWithSaveFilePicker extends Window {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle>;
}

export interface DesktopNativeFile extends File {
  readonly path: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function hasDirectoryPicker(
  win: Window,
): win is WindowWithDirectoryPicker {
  return (
    'showDirectoryPicker' in win &&
    typeof win.showDirectoryPicker === 'function'
  );
}

export function hasSaveFilePicker(
  win: Window,
): win is WindowWithSaveFilePicker {
  return (
    'showSaveFilePicker' in win && typeof win.showSaveFilePicker === 'function'
  );
}

export function hasWebkitGetAsEntry(
  item: DataTransferItem,
): item is DataTransferItem & {
  webkitGetAsEntry: () => WebkitFileSystemEntry | null;
} {
  return (
    'webkitGetAsEntry' in item && typeof item.webkitGetAsEntry === 'function'
  );
}

export function isWebkitDirectoryEntry(
  value: unknown,
): value is WebkitDirectoryEntry {
  return (
    isRecord(value) &&
    value['isDirectory'] === true &&
    'createReader' in value &&
    typeof value['createReader'] === 'function'
  );
}

export function isWebkitFileEntry(value: unknown): value is WebkitFileEntry {
  return (
    isRecord(value) &&
    value['isFile'] === true &&
    'file' in value &&
    typeof value['file'] === 'function'
  );
}

export function isDesktopNativeFile(file: File): file is DesktopNativeFile {
  return (
    'path' in file && typeof file.path === 'string' && file.path.length > 0
  );
}

export function isFileSystemDirectoryHandle(
  handle: unknown,
): handle is FileSystemDirectoryHandle {
  return isRecord(handle) && handle['kind'] === 'directory';
}

export function isFileSystemFileHandle(
  handle: unknown,
): handle is FileSystemFileHandle {
  return isRecord(handle) && handle['kind'] === 'file';
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error)) {
    if ('error' in error) {
      const nested = error['error'];
      if (typeof nested === 'string') {
        return nested;
      }
      if (isRecord(nested) && 'detail' in nested) {
        return String(nested['detail']);
      }
    }
    if ('message' in error && typeof error['message'] === 'string') {
      return error['message'];
    }
  }
  return String(error);
}
