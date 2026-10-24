import { inject, Injectable, signal } from '@angular/core';

import { DirectoryScanResult, FileNode } from '@models/tree.model';
import { ScanOptions } from '@models/settings.model';
import { WasmService } from '@services/wasm.service';
import {
  DEFAULT_BINARY_EXTENSIONS,
  DEFAULT_HARD_EXCLUDES,
  MAX_SINGLE_LINE_LENGTH,
  MAX_WEB_FILE_SIZE_BYTES,
} from '@core/utils/constants';
import {
  hasDirectoryPicker,
  hasWebkitGetAsEntry,
  isFileSystemDirectoryHandle,
  isFileSystemFileHandle,
  isWebkitDirectoryEntry,
  isWebkitFileEntry,
  WebkitDirectoryEntry,
  WebkitFileEntry,
  WebkitFileSystemEntry,
} from '@core/utils/type-guards';

@Injectable({
  providedIn: 'root',
})
export class FileSystemService {
  private readonly wasmService = inject(WasmService);

  readonly currentProjectName = signal<string>('');
  readonly isScanning = signal<boolean>(false);
  readonly rootNode = signal<FileNode | null>(null);

  private readonly fileContentCache = new Map<string, string>();

  setRootNode(node: FileNode | null, projectName?: string): void {
    this.rootNode.set(node);
    if (projectName) {
      this.currentProjectName.set(projectName);
    } else if (node) {
      this.currentProjectName.set(node.name);
    } else {
      this.currentProjectName.set('');
    }
  }

  clearCache(): void {
    this.fileContentCache.clear();
  }

  async openDirectoryPicker(
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    if (hasDirectoryPicker(window)) {
      try {
        const handle = await window.showDirectoryPicker();

        this.isScanning.set(true);
        await this.wasmService.init();
        this.currentProjectName.set(handle.name);

        const { effectiveOptions, gitignoreRules } =
          await this.prepareScanOptions(handle, options);
        const root = await this.scanDirectoryHandle(
          handle,
          handle.name,
          '',
          effectiveOptions,
        );

        this.clearCache();
        this.rootNode.set(root);
        return { rootNode: root, gitignoreRules };
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (isAbort) {
          return { rootNode: null, gitignoreRules: [] };
        }
        return await this.openInputDirectoryFallback(options);
      } finally {
        this.isScanning.set(false);
      }
    }

    return await this.openInputDirectoryFallback(options);
  }

  async readFromFiles(
    files: FileList | readonly File[],
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return { rootNode: null, gitignoreRules: [] };
      }

      const firstFile = fileArray[0];
      const firstPath =
        firstFile?.webkitRelativePath || firstFile?.name || 'project';
      const rootName = firstPath.split('/')[0] || 'project';
      this.currentProjectName.set(rootName);

      const gitignoreFile = fileArray.find(
        (f) =>
          f.name === '.gitignore' ||
          (f.webkitRelativePath &&
            f.webkitRelativePath.split('/').pop() === '.gitignore'),
      );

      let effectiveOptions = this.ensureDefaultExcludes(options);
      let gitignoreRules: string[] = [];
      if (gitignoreFile && options.use_gitignore) {
        const text = await gitignoreFile.text();
        gitignoreRules = this.parseGitignoreText(text);
        const mergedExcludes = new Set<string>([
          ...effectiveOptions.manual_excludes,
        ]);
        for (const r of gitignoreRules) {
          if (!options.gitignore_disabled_rules.includes(r)) {
            mergedExcludes.add(r);
          }
        }
        effectiveOptions = {
          ...effectiveOptions,
          manual_excludes: Array.from(mergedExcludes),
        };
      }

      const root: FileNode = {
        name: rootName,
        full_path: rootName,
        rel_path: '',
        is_dir: true,
        size: 0,
        children: [],
      };

      for (const file of fileArray) {
        const relPath = file.webkitRelativePath
          ? file.webkitRelativePath.substring(rootName.length + 1)
          : file.name;

        if (!relPath) {
          continue;
        }

        if (this.checkIsIgnored(relPath, false, effectiveOptions)) {
          continue;
        }

        this.addFileToTree(root, relPath.split('/'), file);
      }

      this.clearCache();
      this.rootNode.set(root);
      return { rootNode: root, gitignoreRules };
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromDataTransfer(
    items: DataTransferItemList,
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    let rootEntry: WebkitDirectoryEntry | null = null;
    const fileList: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === 'file') {
        if (hasWebkitGetAsEntry(item)) {
          const entry = item.webkitGetAsEntry();
          if (isWebkitDirectoryEntry(entry)) {
            rootEntry = entry;
            break;
          }
        }
        const file = item.getAsFile();
        if (file) {
          fileList.push(file);
        }
      }
    }

    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      if (rootEntry) {
        this.currentProjectName.set(rootEntry.name);
        const { effectiveOptions, gitignoreRules } =
          await this.prepareScanOptionsForWebkitEntry(rootEntry, options);
        const root = await this.scanWebkitEntry(
          rootEntry,
          rootEntry.name,
          '',
          effectiveOptions,
        );
        this.clearCache();
        this.rootNode.set(root);
        return { rootNode: root, gitignoreRules };
      }

      if (fileList.length > 0) {
        return await this.readFromFiles(fileList, options);
      }

      return { rootNode: null, gitignoreRules: [] };
    } finally {
      this.isScanning.set(false);
    }
  }

  async getFileContent(node: FileNode): Promise<string> {
    if (node.is_dir) {
      return '';
    }

    const cached = this.fileContentCache.get(node.rel_path);
    if (cached !== undefined) {
      return cached;
    }

    if (
      node.name.toLowerCase() === 'icon_data.py' ||
      node.name.toLowerCase().endsWith('_data.py')
    ) {
      return `[Auto-generated base64 asset file '${node.name}' omitted]`;
    }

    const dotIdx = node.name.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = node.name.substring(dotIdx).toLowerCase();
      if (DEFAULT_BINARY_EXTENSIONS.includes(ext)) {
        return `[Binary file '${node.name}' omitted]`;
      }
    }

    if (node.size > MAX_WEB_FILE_SIZE_BYTES) {
      return `[File '${node.name}' omitted: exceeds max size limit of 1.5MB]`;
    }

    let content = '';
    if (node.fileHandle) {
      const file = await node.fileHandle.getFile();
      content = await file.text();
    } else if (node.rawFile) {
      content = await node.rawFile.text();
    }

    if (content) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.length > MAX_SINGLE_LINE_LENGTH) {
          content = `[File '${node.name}' omitted: contains excessively long single-line data]`;
          break;
        }
      }
      this.fileContentCache.set(node.rel_path, content);
    }

    return content;
  }

  private openInputDirectoryFallback(
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async () => {
        try {
          if (input.files && input.files.length > 0) {
            const res = await this.readFromFiles(input.files, options);
            resolve(res);
          } else {
            resolve({ rootNode: null, gitignoreRules: [] });
          }
        } finally {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve({ rootNode: null, gitignoreRules: [] });
      };

      input.click();
    });
  }

  private ensureDefaultExcludes(options: ScanOptions): ScanOptions {
    const excludes = new Set<string>([
      ...DEFAULT_HARD_EXCLUDES,
      ...options.manual_excludes,
    ]);
    return {
      ...options,
      manual_excludes: Array.from(excludes),
    };
  }

  private async parseGitignoreFromWebkitEntry(
    entry: WebkitDirectoryEntry,
  ): Promise<string[]> {
    return new Promise((resolve) => {
      if ('getFile' in entry && typeof entry.getFile === 'function') {
        entry.getFile(
          '.gitignore',
          {},
          (fileEntry) => {
            if (isWebkitFileEntry(fileEntry)) {
              fileEntry.file(
                async (file) => {
                  try {
                    const text = await file.text();
                    resolve(this.parseGitignoreText(text));
                  } catch {
                    resolve([]);
                  }
                },
                () => resolve([]),
              );
            } else {
              resolve([]);
            }
          },
          () => resolve([]),
        );
      } else {
        const reader = entry.createReader();
        reader.readEntries(
          (entries) => {
            const gitignoreEntry = entries.find(
              (e) => e.name === '.gitignore' && e.isFile,
            );
            if (gitignoreEntry && isWebkitFileEntry(gitignoreEntry)) {
              gitignoreEntry.file(
                async (file) => {
                  try {
                    const text = await file.text();
                    resolve(this.parseGitignoreText(text));
                  } catch {
                    resolve([]);
                  }
                },
                () => resolve([]),
              );
            } else {
              resolve([]);
            }
          },
          () => resolve([]),
        );
      }
    });
  }

  private async prepareScanOptionsForWebkitEntry(
    rootEntry: WebkitDirectoryEntry,
    options: ScanOptions,
  ): Promise<{
    readonly effectiveOptions: ScanOptions;
    readonly gitignoreRules: string[];
  }> {
    const baseOptions = this.ensureDefaultExcludes(options);
    if (!baseOptions.use_gitignore) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const gitignoreRules = await this.parseGitignoreFromWebkitEntry(rootEntry);
    if (gitignoreRules.length === 0) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const mergedExcludes = new Set<string>([...baseOptions.manual_excludes]);
    for (const rule of gitignoreRules) {
      if (!baseOptions.gitignore_disabled_rules.includes(rule)) {
        mergedExcludes.add(rule);
      }
    }

    return {
      effectiveOptions: {
        ...baseOptions,
        manual_excludes: Array.from(mergedExcludes),
      },
      gitignoreRules,
    };
  }

  private async prepareScanOptions(
    rootHandle: FileSystemDirectoryHandle,
    options: ScanOptions,
  ): Promise<{
    readonly effectiveOptions: ScanOptions;
    readonly gitignoreRules: string[];
  }> {
    const baseOptions = this.ensureDefaultExcludes(options);
    if (!baseOptions.use_gitignore) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const gitignoreRules = await this.parseGitignoreFromHandle(rootHandle);
    if (gitignoreRules.length === 0) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const mergedExcludes = new Set<string>([...baseOptions.manual_excludes]);
    for (const rule of gitignoreRules) {
      if (!baseOptions.gitignore_disabled_rules.includes(rule)) {
        mergedExcludes.add(rule);
      }
    }

    return {
      effectiveOptions: {
        ...baseOptions,
        manual_excludes: Array.from(mergedExcludes),
      },
      gitignoreRules,
    };
  }

  private parseGitignoreText(text: string): string[] {
    const rules: string[] = [];
    for (let rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const cleanRule = line.includes(' #')
        ? line.split(' #')[0]?.trim()
        : line;
      if (cleanRule) {
        rules.push(cleanRule);
      }
    }
    return rules;
  }

  private async parseGitignoreFromHandle(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<string[]> {
    try {
      const fileHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return this.parseGitignoreText(text);
    } catch {
      return [];
    }
  }

  private checkIsIgnored(
    relPath: string,
    isDir: boolean,
    options: ScanOptions,
  ): boolean {
    const cleanPath = relPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    const name = parts[parts.length - 1] ?? '';

    if (
      DEFAULT_HARD_EXCLUDES.includes(name) ||
      DEFAULT_HARD_EXCLUDES.includes(cleanPath)
    ) {
      return true;
    }

    for (const exclude of options.manual_excludes) {
      const cleanExclude = exclude.trim().replace(/\/$/, '');
      if (
        cleanExclude &&
        (parts.includes(cleanExclude) ||
          cleanPath === cleanExclude ||
          cleanPath.startsWith(`${cleanExclude}/`))
      ) {
        return true;
      }
    }

    if (!isDir) {
      const dotIdx = name.lastIndexOf('.');
      if (dotIdx !== -1) {
        const ext = name.substring(dotIdx).toLowerCase();

        if (options.ignore_binary) {
          if (
            DEFAULT_BINARY_EXTENSIONS.includes(ext) ||
            options.binary_extensions.includes(ext)
          ) {
            return true;
          }
        }

        if (options.ignore_lockfiles) {
          if (options.lockfiles_excludes.includes(name)) {
            return true;
          }
        }

        if (options.whitelist_extensions.length > 0) {
          if (!options.whitelist_extensions.includes(ext)) {
            return true;
          }
        }
      }
    }

    return this.wasmService.isIgnored(relPath, isDir, options);
  }

  private async scanDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    name: string,
    relPath: string,
    options: ScanOptions,
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: [],
    };

    const entries: FileSystemHandle[] = [];
    try {
      for await (const handle of dirHandle.values()) {
        entries.push(handle);
      }
    } catch {
      return currentNode;
    }

    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return b.kind === 'directory' ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    const dirHandles: FileSystemDirectoryHandle[] = [];
    const fileHandles: FileSystemFileHandle[] = [];

    for (const handle of entries) {
      const childRelPath = relPath ? `${relPath}/${handle.name}` : handle.name;
      const isDir = isFileSystemDirectoryHandle(handle);

      if (this.checkIsIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isFileSystemDirectoryHandle(handle)) {
        dirHandles.push(handle);
      } else if (isFileSystemFileHandle(handle)) {
        fileHandles.push(handle);
      }
    }

    for (const handle of dirHandles) {
      const childRelPath = relPath ? `${relPath}/${handle.name}` : handle.name;
      const childNode = await this.scanDirectoryHandle(
        handle,
        handle.name,
        childRelPath,
        options,
      );
      currentNode.children.push(childNode);
    }

    const fileNodes = await Promise.all(
      fileHandles.map(async (handle) => {
        const childRelPath = relPath
          ? `${relPath}/${handle.name}`
          : handle.name;
        try {
          const file = await handle.getFile();
          const node: FileNode = {
            name: handle.name,
            full_path: `${currentNode.full_path}/${handle.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: file.size,
            children: [],
            fileHandle: handle,
          };
          return node;
        } catch {
          const fallbackNode: FileNode = {
            name: handle.name,
            full_path: `${currentNode.full_path}/${handle.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: [],
            fileHandle: handle,
          };
          return fallbackNode;
        }
      }),
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private async scanWebkitEntry(
    entry: WebkitDirectoryEntry,
    name: string,
    relPath: string,
    options: ScanOptions,
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: [],
    };

    const dirReader = entry.createReader();
    const entries: WebkitFileSystemEntry[] = [];

    try {
      let readBatch: WebkitFileSystemEntry[];
      do {
        readBatch = await new Promise((resolve) => {
          dirReader.readEntries(
            (results) => resolve(results || []),
            () => resolve([]),
          );
        });
        entries.push(...readBatch);
      } while (readBatch.length > 0);
    } catch {
      return currentNode;
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return b.isDirectory ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    const dirEntries: WebkitDirectoryEntry[] = [];
    const fileEntries: WebkitFileEntry[] = [];

    for (const childEntry of entries) {
      const childRelPath = relPath
        ? `${relPath}/${childEntry.name}`
        : childEntry.name;
      const isDir = childEntry.isDirectory;

      if (this.checkIsIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isWebkitDirectoryEntry(childEntry)) {
        dirEntries.push(childEntry);
      } else if (isWebkitFileEntry(childEntry)) {
        fileEntries.push(childEntry);
      }
    }

    for (const childEntry of dirEntries) {
      const childRelPath = relPath
        ? `${relPath}/${childEntry.name}`
        : childEntry.name;
      const childNode = await this.scanWebkitEntry(
        childEntry,
        childEntry.name,
        childRelPath,
        options,
      );
      currentNode.children.push(childNode);
    }

    const fileNodes = await Promise.all(
      fileEntries.map(async (childEntry) => {
        const childRelPath = relPath
          ? `${relPath}/${childEntry.name}`
          : childEntry.name;
        try {
          const file: File = await new Promise((resolve, reject) =>
            childEntry.file(resolve, reject),
          );
          const node: FileNode = {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: file.size,
            children: [],
            rawFile: file,
          };
          return node;
        } catch {
          const fallbackNode: FileNode = {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: [],
          };
          return fallbackNode;
        }
      }),
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private addFileToTree(
    parent: FileNode,
    parts: readonly string[],
    file: File,
  ): void {
    if (parts.length === 1) {
      const fileName = parts[0] ?? '';
      parent.children.push({
        name: fileName,
        full_path: `${parent.full_path}/${fileName}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${fileName}` : fileName,
        is_dir: false,
        size: file.size,
        children: [],
        rawFile: file,
      });
      return;
    }

    const dirName = parts[0] ?? '';
    let childDir = parent.children.find(
      (child) => child.is_dir && child.name === dirName,
    );

    if (!childDir) {
      childDir = {
        name: dirName,
        full_path: `${parent.full_path}/${dirName}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${dirName}` : dirName,
        is_dir: true,
        size: 0,
        children: [],
      };
      parent.children.push(childDir);
    }

    this.addFileToTree(childDir, parts.slice(1), file);
  }
}
