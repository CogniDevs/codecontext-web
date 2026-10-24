import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import {
  catchError,
  debounceTime,
  EMPTY,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { cleanNodeForWasm, FileNode } from '@models/tree.model';
import {
  DefaultSettingsConfig,
  ScanOptions,
  TransformOptions,
} from '@models/settings.model';
import { GitStatusResponse } from '@models/git.model';
import {
  DependenciesRequest,
  PayloadRequest,
  StandaloneTreeRequest,
} from '@models/api.model';
import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { WasmService } from '@services/wasm.service';
import {
  FALLBACK_SCAN_OPTIONS,
  FALLBACK_TRANSFORM_OPTIONS,
  MAX_PREVIEW_LENGTH,
  STORAGE_KEY_SCAN,
  STORAGE_KEY_TRANSFORM,
} from '@core/utils/constants';
import {
  extractErrorMessage,
  isBoolean,
  isNumber,
  isRecord,
  isString,
  isStringArray,
} from '@core/utils/type-guards';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);
  private readonly wasm = inject(WasmService);
  private readonly fileSystem = inject(FileSystemService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fileSizesMap = new Map<string, number>();

  private readonly generateTrigger$ = new Subject<void>();
  private readonly loadResourcesTrigger$ = new Subject<void>();
  private readonly fetchGitignoreTrigger$ = new Subject<string>();

  readonly scanOptions = signal<ScanOptions>(this.loadScanOptions());
  readonly transformOptions = signal<TransformOptions>(
    this.loadTransformOptions(),
  );

  readonly rootPath = signal<string>('');
  readonly exportPath = signal<string>('');
  readonly selectedPaths = signal<Set<string>>(new Set<string>());
  readonly expandedPaths = signal<Set<string>>(new Set<string>(['']));
  readonly focusedPath = signal<string | null>(null);
  readonly generatedPayload = signal<string>('');
  readonly isGenerating = signal<boolean>(false);
  readonly gitModifiedFiles = signal<readonly string[]>([]);
  readonly projectGitignoreRules = signal<readonly string[]>([]);
  readonly workLogs = signal<readonly string[]>([
    'CodeContext инициализирован.',
  ]);

  readonly selectedFilesCount = computed<number>(
    () => this.selectedPaths().size,
  );

  readonly tokenCount = computed<number>(() => {
    if (!this.generatedPayload() || this.generatedPayload().startsWith('[')) {
      return 0;
    }
    if (this.generatedPayload().length > 400000 && !this.platform.isDesktop()) {
      return Math.round(this.generatedPayload().length / 3.3);
    }
    try {
      return this.wasm.countTokens(this.generatedPayload());
    } catch {
      return Math.round(this.generatedPayload().length / 3.3);
    }
  });

  readonly totalSizeBytes = computed<number>(() => {
    let sum = 0;
    for (const relPath of this.selectedPaths()) {
      sum += this.fileSizesMap.get(relPath) ?? 0;
    }
    return sum;
  });

  readonly totalSizeKb = computed<number>(
    () => Math.round((this.totalSizeBytes() / 1024) * 10) / 10,
  );

  readonly previewPayload = computed<string>(() => {
    if (this.generatedPayload().length <= MAX_PREVIEW_LENGTH) {
      return this.generatedPayload();
    }
    const truncated = this.generatedPayload().substring(0, MAX_PREVIEW_LENGTH);
    const totalKb = Math.round(this.generatedPayload().length / 1024);
    return `${truncated}\n\n[... Превью усечено для плавности интерфейса (полный размер: ${totalKb} KB). Полный контекст копируется в буфер и записывается в файл без сокращений ...]`;
  });

  private readonly generateHandler$ = this.generateTrigger$.pipe(
    debounceTime(250),
    switchMap(() => from(this.executePayloadGeneration())),
  );

  private readonly fetchGitignoreHandler$ = this.fetchGitignoreTrigger$.pipe(
    switchMap((targetDir) => {
      if (!this.platform.isDesktop() || !this.isAbsoluteDiskPath(targetDir)) {
        this.projectGitignoreRules.set([]);
        return EMPTY;
      }
      return this.api.getGitignoreRules(targetDir).pipe(
        tap((res) => {
          if (res && Array.isArray(res.rules)) {
            this.projectGitignoreRules.set(res.rules);
          }
        }),
        catchError(() => {
          this.projectGitignoreRules.set([]);
          return EMPTY;
        }),
      );
    }),
  );

  private readonly loadResourcesHandler$ = this.loadResourcesTrigger$.pipe(
    switchMap(() => {
      const hasSavedScan = Boolean(localStorage.getItem(STORAGE_KEY_SCAN));
      const hasSavedTransform = Boolean(
        localStorage.getItem(STORAGE_KEY_TRANSFORM),
      );

      return this.http
        .get<DefaultSettingsConfig>('assets/resources/default_settings.json')
        .pipe(
          tap((settings: DefaultSettingsConfig) => {
            if (!settings) {
              return;
            }

            if (!hasSavedScan) {
              this.scanOptions.update((opts) => ({
                ...opts,
                use_gitignore: settings.use_gitignore ?? opts.use_gitignore,
                ignore_binary: settings.ignore_binary ?? opts.ignore_binary,
                ignore_lockfiles:
                  settings.ignore_lockfiles ?? opts.ignore_lockfiles,
                manual_excludes: Array.from(
                  new Set([
                    ...opts.manual_excludes,
                    ...(settings.global_excludes ?? []),
                    'icon_data.py',
                  ]),
                ),
                binary_extensions: Array.from(
                  new Set([
                    ...opts.binary_extensions,
                    ...(settings.binary_extensions ?? []),
                  ]),
                ),
                lockfiles_excludes: Array.from(
                  new Set([
                    ...opts.lockfiles_excludes,
                    ...(settings.lockfiles_excludes ?? []),
                  ]),
                ),
              }));
            }

            if (!hasSavedTransform) {
              this.transformOptions.update((opts) => ({
                ...opts,
                xml_format: settings.xml_format ?? opts.xml_format,
                strip_comments: settings.strip_comments ?? opts.strip_comments,
                compress_whitespace:
                  settings.compress_whitespace ?? opts.compress_whitespace,
                sanitize_secrets:
                  settings.sanitize_secrets ?? opts.sanitize_secrets,
                always_send_full_tree: settings.always_send_full_tree ?? false,
              }));
            }
          }),
          switchMap(() =>
            this.http
              .get('assets/resources/comment_rules.json', {
                responseType: 'text',
              })
              .pipe(
                tap((rulesText) => {
                  if (rulesText) {
                    this.transformOptions.update((opts) => ({
                      ...opts,
                      comment_rules_json: rulesText,
                    }));
                  }
                }),
                catchError(() => EMPTY),
              ),
          ),
          catchError(() => EMPTY),
        );
    }),
  );

  private readonly sideEffects$ = merge(
    this.generateHandler$,
    this.fetchGitignoreHandler$,
    this.loadResourcesHandler$,
  );

  constructor() {
    this.sideEffects$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    effect(() => {
      localStorage.setItem(
        STORAGE_KEY_SCAN,
        JSON.stringify(this.scanOptions()),
      );
    });

    effect(() => {
      localStorage.setItem(
        STORAGE_KEY_TRANSFORM,
        JSON.stringify(this.transformOptions()),
      );
    });

    effect(() => {
      if (this.fileSystem.rootNode()) {
        this.resetExpandedToRoot();
      }
    });

    effect(() => {
      const hasRoot =
        this.fileSystem.rootNode() !== null || this.rootPath().length > 0;
      const hasSelection = this.selectedPaths().size > 0;
      const isDiff = this.transformOptions().git_diff_mode;

      if (hasRoot && (hasSelection || isDiff)) {
        this.schedulePayloadGeneration();
      } else {
        this.generatedPayload.set('');
      }
    });

    this.loadResourcesTrigger$.next();
  }

  isAbsoluteDiskPath(path: string): boolean {
    return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(path.trim());
  }

  appendLog(message: string): void {
    const timeStr = new Date().toLocaleTimeString();
    this.workLogs.update((prev) => [...prev, `[${timeStr}] ${message}`]);
  }

  clearLogs(): void {
    this.workLogs.set([]);
  }

  setExportPath(path: string): void {
    this.exportPath.set(path);
  }

  setRootNode(node: FileNode | null, rootPath?: string): void {
    if (!node || typeof node !== 'object' || !node.name) {
      this.fileSystem.setRootNode(null);
      this.rootPath.set('');
      this.fileSizesMap.clear();
      this.projectGitignoreRules.set([]);
      return;
    }

    this.fileSizesMap.clear();
    this.cacheFileSizes(node);

    this.fileSystem.setRootNode(node, rootPath);
    if (rootPath && this.isAbsoluteDiskPath(rootPath)) {
      this.rootPath.set(rootPath);
      const defaultExport = `${rootPath.replace(/[\\/]$/, '')}/code_context.txt`;
      this.exportPath.set(defaultExport);
      this.appendLog(`Rust Scan: ${rootPath}`);
      this.fetchProjectGitignoreRules(rootPath);
    } else {
      this.rootPath.set(node.full_path || node.name);
      this.appendLog(`Web Scan: ${node.name}`);
    }
  }

  setRootPath(path: string): void {
    this.rootPath.set(path);
  }

  fetchProjectGitignoreRules(path?: string): void {
    const targetDir = path ?? this.rootPath();
    this.fetchGitignoreTrigger$.next(targetDir);
  }

  setProjectGitignoreRules(rules: readonly string[]): void {
    this.projectGitignoreRules.set(rules);
  }

  resetExpandedToRoot(): void {
    this.expandedPaths.set(new Set<string>(['']));
  }

  isPathExpanded(relPath: string): boolean {
    return this.expandedPaths().has(relPath);
  }

  togglePathExpansion(relPath: string, expand?: boolean): void {
    this.expandedPaths.update((set) => {
      const next = new Set<string>(set);
      const shouldExpand = expand !== undefined ? expand : !next.has(relPath);
      if (shouldExpand) {
        next.add(relPath);
      } else {
        next.delete(relPath);
      }
      return next;
    });
  }

  expandAllFolders(): void {
    const root = this.fileSystem.rootNode();
    if (!root) {
      return;
    }
    const allDirs = new Set<string>();
    this.collectAllDirPaths(root, allDirs);
    this.expandedPaths.set(allDirs);
  }

  collapseAllFolders(): void {
    this.resetExpandedToRoot();
  }

  setFocusedPath(relPath: string | null): void {
    this.focusedPath.set(relPath);
  }

  togglePathSelection(relPath: string, isSelected: boolean): void {
    this.selectedPaths.update((set) => {
      const next = new Set<string>(set);
      if (isSelected) {
        next.add(relPath);
      } else {
        next.delete(relPath);
      }
      return next;
    });
  }

  selectAllFiles(check: boolean): void {
    const root = this.fileSystem.rootNode();
    if (!root) {
      return;
    }

    const newSet = new Set<string>();
    if (check) {
      this.collectAllFilePaths(root, newSet);
    }
    this.selectedPaths.set(newSet);
    this.appendLog(
      check ? 'Выделены все файлы проекта.' : 'Выделение файлов снято.',
    );
  }

  selectGitModifiedFilesOnly(): void {
    const root = this.fileSystem.rootNode();
    if (!root || this.gitModifiedFiles().length === 0) {
      this.appendLog('Git: нет измененных файлов для выделения.');
      return;
    }

    const availablePaths = new Set<string>();
    this.collectAllFilePaths(root, availablePaths);

    const matchingSet = new Set<string>();
    for (const modPath of this.gitModifiedFiles()) {
      if (availablePaths.has(modPath)) {
        matchingSet.add(modPath);
      }
    }
    this.selectedPaths.set(matchingSet);
    this.appendLog(
      `Git Status: выделено ${matchingSet.size} измененных файлов.`,
    );
  }

  schedulePayloadGeneration(): void {
    this.generateTrigger$.next();
  }

  fetchGitStatus(): Observable<readonly string[]> {
    if (
      !this.platform.isDesktop() ||
      !this.isAbsoluteDiskPath(this.rootPath())
    ) {
      this.gitModifiedFiles.set([]);
      return of([]);
    }

    return this.api.getGitStatus(this.rootPath()).pipe(
      tap((res: GitStatusResponse) => {
        if (res.success) {
          this.gitModifiedFiles.set(res.modified_files);
          this.appendLog(`Git Status: ${res.message}`);
        } else {
          this.gitModifiedFiles.set([]);
        }
      }),
      map((res: GitStatusResponse) => (res.success ? res.modified_files : [])),
      catchError(() => {
        this.gitModifiedFiles.set([]);
        return of([]);
      }),
    );
  }

  async traceDependenciesForFocusedFile(): Promise<number> {
    const focusedRelPath = this.focusedPath();
    const root = this.fileSystem.rootNode();
    const rootName = this.fileSystem.currentProjectName() || 'project';

    if (!focusedRelPath || !root) {
      return 0;
    }

    const focusedNode = this.findNodeByRelPath(root, focusedRelPath);
    if (!focusedNode || focusedNode.is_dir) {
      return 0;
    }

    const content = await this.fileSystem.getFileContent(focusedNode);

    let deps: string[] = [];
    if (this.platform.isDesktop() && this.isAbsoluteDiskPath(this.rootPath())) {
      const req: DependenciesRequest = {
        root_dir: this.rootPath(),
        target_rel_path: focusedRelPath,
        content,
      };
      const res = await firstValueFrom(this.api.traceDependencies(req));
      deps = res.dependencies;
    } else {
      await this.wasm.init();
      const allPaths = this.getAllFilePaths(root);
      deps = this.wasm.traceDependencies(
        rootName,
        focusedRelPath,
        content,
        allPaths,
      );
    }

    if (deps && deps.length > 0) {
      this.selectedPaths.update((set) => {
        const next = new Set<string>(set);
        for (const dep of deps) {
          next.add(dep);
        }
        return next;
      });
      this.appendLog(
        `Импорты: выделено ${deps.length} зависимостей для '${focusedRelPath}'.`,
      );
      return deps.length;
    }

    return 0;
  }

  async copyStandaloneTree(): Promise<string> {
    const root = this.fileSystem.rootNode();
    const rootName =
      this.fileSystem.currentProjectName() ||
      (this.rootPath()
        ? this.rootPath().split(/[\\/]/).pop() || 'project'
        : 'project');
    const xml = this.transformOptions().xml_format;

    if (this.platform.isDesktop() && this.isAbsoluteDiskPath(this.rootPath())) {
      const req: StandaloneTreeRequest = {
        root_name: rootName,
        root_node: root ? cleanNodeForWasm(root) : null,
        selected_paths: Array.from(this.selectedPaths()),
        xml_format: xml,
      };
      const res = await firstValueFrom(this.api.generateStandaloneTree(req));
      if (res.tree_text) {
        await navigator.clipboard.writeText(res.tree_text);
        this.appendLog('Скопирована только ASCII-структура проекта.');
        return res.tree_text;
      }
    } else {
      await this.wasm.init();
      const cleanedRoot = root ? cleanNodeForWasm(root) : null;
      const treeText = this.wasm.generateStandaloneTree(
        rootName,
        cleanedRoot ? JSON.stringify(cleanedRoot) : '',
        Array.from(this.selectedPaths()),
        xml,
      );
      if (treeText) {
        await navigator.clipboard.writeText(treeText);
        this.appendLog('Скопирована только ASCII-структура проекта (WASM).');
        return treeText;
      }
    }
    return '';
  }

  async generatePayload(): Promise<string> {
    return this.executePayloadGeneration();
  }

  private async executePayloadGeneration(): Promise<string> {
    const root = this.fileSystem.rootNode();
    const projectName = this.fileSystem.currentProjectName() || 'project';

    if (!root && !this.rootPath()) {
      this.generatedPayload.set('');
      return '';
    }

    if (
      this.selectedPaths().size === 0 &&
      !this.transformOptions().git_diff_mode
    ) {
      this.generatedPayload.set('');
      return '';
    }

    this.isGenerating.set(true);

    try {
      const isDesktopDiskScan =
        this.platform.isDesktop() && this.isAbsoluteDiskPath(this.rootPath());

      if (isDesktopDiskScan) {
        const req: PayloadRequest = {
          root_dir: this.rootPath(),
          root_node: root ? cleanNodeForWasm(root) : null,
          selected_paths: Array.from(this.selectedPaths()),
          options: this.transformOptions(),
        };

        const res = await firstValueFrom(this.api.buildPayload(req));
        this.generatedPayload.set(res.payload);
        return res.payload;
      }

      await this.wasm.init();

      if (root) {
        const filesToRead: FileNode[] = [];
        this.collectSelectedFileNodes(root, this.selectedPaths(), filesToRead);

        const filesPayload: Array<[string, string]> = [];
        const chunkSize = 15;
        for (let i = 0; i < filesToRead.length; i += chunkSize) {
          const chunk = filesToRead.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (node) => {
              try {
                const content = await this.fileSystem.getFileContent(node);
                return [node.rel_path, content] as [string, string];
              } catch {
                return [node.rel_path, '[Error reading file]'] as [
                  string,
                  string,
                ];
              }
            }),
          );
          filesPayload.push(...chunkResults);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const allAncestorPaths = new Set<string>();
        for (const relPath of this.selectedPaths()) {
          allAncestorPaths.add(relPath);
          const parts = relPath.split('/');
          for (let i = 1; i < parts.length; i++) {
            allAncestorPaths.add(parts.slice(0, i).join('/'));
          }
        }

        const cleanedRoot = cleanNodeForWasm(root);
        const payload = this.wasm.buildPayload(
          projectName,
          JSON.stringify(cleanedRoot),
          filesPayload,
          Array.from(allAncestorPaths),
          this.transformOptions(),
        );

        this.generatedPayload.set(payload);
        return payload;
      }

      this.generatedPayload.set('');
      return '';
    } catch (err: unknown) {
      const errMsg = `[Error generating context: ${extractErrorMessage(err)}]`;
      this.generatedPayload.set(errMsg);
      return errMsg;
    } finally {
      this.isGenerating.set(false);
    }
  }

  private cacheFileSizes(node: FileNode): void {
    if (!node.is_dir) {
      this.fileSizesMap.set(node.rel_path, node.size);
    }
    for (const child of node.children) {
      this.cacheFileSizes(child);
    }
  }

  private collectAllDirPaths(node: FileNode, acc: Set<string>): void {
    if (node.is_dir) {
      acc.add(node.rel_path);
      for (const child of node.children) {
        this.collectAllDirPaths(child, acc);
      }
    }
  }

  private getAllFilePaths(node: FileNode, acc: string[] = []): string[] {
    if (!node.is_dir) {
      acc.push(node.rel_path);
    }
    for (const child of node.children) {
      this.getAllFilePaths(child, acc);
    }
    return acc;
  }

  private findNodeByRelPath(node: FileNode, relPath: string): FileNode | null {
    if (node.rel_path === relPath) {
      return node;
    }
    for (const child of node.children) {
      const found = this.findNodeByRelPath(child, relPath);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private collectAllFilePaths(node: FileNode, acc: Set<string>): void {
    if (!node.is_dir) {
      acc.add(node.rel_path);
    }
    for (const child of node.children) {
      this.collectAllFilePaths(child, acc);
    }
  }

  private collectSelectedFileNodes(
    node: FileNode,
    selectedSet: ReadonlySet<string>,
    acc: FileNode[],
  ): void {
    if (!node.is_dir && selectedSet.has(node.rel_path)) {
      acc.push(node);
    }
    for (const child of node.children) {
      this.collectSelectedFileNodes(child, selectedSet, acc);
    }
  }

  private loadScanOptions(): ScanOptions {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCAN);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isRecord(parsed)) {
          return {
            use_gitignore: isBoolean(parsed['use_gitignore'])
              ? parsed['use_gitignore']
              : FALLBACK_SCAN_OPTIONS.use_gitignore,
            ignore_binary: isBoolean(parsed['ignore_binary'])
              ? parsed['ignore_binary']
              : FALLBACK_SCAN_OPTIONS.ignore_binary,
            ignore_lockfiles: isBoolean(parsed['ignore_lockfiles'])
              ? parsed['ignore_lockfiles']
              : FALLBACK_SCAN_OPTIONS.ignore_lockfiles,
            whitelist_extensions: isStringArray(parsed['whitelist_extensions'])
              ? parsed['whitelist_extensions']
              : FALLBACK_SCAN_OPTIONS.whitelist_extensions,
            manual_excludes: isStringArray(parsed['manual_excludes'])
              ? Array.from(
                  new Set([
                    ...FALLBACK_SCAN_OPTIONS.manual_excludes,
                    ...parsed['manual_excludes'],
                    'icon_data.py',
                  ]),
                )
              : FALLBACK_SCAN_OPTIONS.manual_excludes,
            gitignore_disabled_rules: isStringArray(
              parsed['gitignore_disabled_rules'],
            )
              ? parsed['gitignore_disabled_rules']
              : FALLBACK_SCAN_OPTIONS.gitignore_disabled_rules,
            binary_extensions: isStringArray(parsed['binary_extensions'])
              ? parsed['binary_extensions']
              : FALLBACK_SCAN_OPTIONS.binary_extensions,
            lockfiles_excludes: isStringArray(parsed['lockfiles_excludes'])
              ? parsed['lockfiles_excludes']
              : FALLBACK_SCAN_OPTIONS.lockfiles_excludes,
            output_file_path: isString(parsed['output_file_path'])
              ? parsed['output_file_path']
              : null,
            auto_watch: isBoolean(parsed['auto_watch'])
              ? parsed['auto_watch']
              : false,
          };
        }
      }
    } catch {}
    return FALLBACK_SCAN_OPTIONS;
  }

  private loadTransformOptions(): TransformOptions {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSFORM);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isRecord(parsed)) {
          return {
            strip_comments: isBoolean(parsed['strip_comments'])
              ? parsed['strip_comments']
              : FALLBACK_TRANSFORM_OPTIONS.strip_comments,
            compress_whitespace: isBoolean(parsed['compress_whitespace'])
              ? parsed['compress_whitespace']
              : FALLBACK_TRANSFORM_OPTIONS.compress_whitespace,
            sanitize_secrets: isBoolean(parsed['sanitize_secrets'])
              ? parsed['sanitize_secrets']
              : FALLBACK_TRANSFORM_OPTIONS.sanitize_secrets,
            skeleton_mode: isBoolean(parsed['skeleton_mode'])
              ? parsed['skeleton_mode']
              : FALLBACK_TRANSFORM_OPTIONS.skeleton_mode,
            xml_format: isBoolean(parsed['xml_format'])
              ? parsed['xml_format']
              : FALLBACK_TRANSFORM_OPTIONS.xml_format,
            always_send_full_tree: isBoolean(parsed['always_send_full_tree'])
              ? parsed['always_send_full_tree']
              : FALLBACK_TRANSFORM_OPTIONS.always_send_full_tree,
            auto_watch: isBoolean(parsed['auto_watch'])
              ? parsed['auto_watch']
              : false,
            system_prompt: isString(parsed['system_prompt'])
              ? parsed['system_prompt']
              : FALLBACK_TRANSFORM_OPTIONS.system_prompt,
            comment_rules_json: isString(parsed['comment_rules_json'])
              ? parsed['comment_rules_json']
              : null,
            max_token_budget: isNumber(parsed['max_token_budget'])
              ? parsed['max_token_budget']
              : null,
            git_diff_mode: isBoolean(parsed['git_diff_mode'])
              ? parsed['git_diff_mode']
              : false,
            git_diff_context_lines: isNumber(parsed['git_diff_context_lines'])
              ? parsed['git_diff_context_lines']
              : 3,
            git_diff_text: isString(parsed['git_diff_text'])
              ? parsed['git_diff_text']
              : null,
          };
        }
      }
    } catch {}
    return FALLBACK_TRANSFORM_OPTIONS;
  }
}
