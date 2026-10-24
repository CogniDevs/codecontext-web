import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  from,
  merge,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { FileNode } from '@models/tree.model';
import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import {
  extractErrorMessage,
  hasSaveFilePicker,
} from '@core/utils/type-guards';

@Component({
  selector: 'app-paths-panel',
  templateUrl: './paths-panel.component.html',
  styleUrl: './paths-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class PathsPanelComponent {
  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  protected readonly fileSystem = inject(FileSystemService);
  private readonly api = inject(ApiService);

  protected readonly browseDesktopTrigger$ = new Subject<void>();
  protected readonly browseSaveTrigger$ = new Subject<void>();

  private readonly desktopFolderHandler$ = this.browseDesktopTrigger$.pipe(
    exhaustMap(() => {
      if (!this.platform.isDesktop()) {
        return EMPTY;
      }
      return this.api.selectFolder().pipe(
        switchMap((res) => {
          if (!res.success || !res.path) {
            return EMPTY;
          }
          this.state.isGenerating.set(true);
          return this.api
            .scanDirectory(res.path, this.state.scanOptions())
            .pipe(
              tap((tree: FileNode) => {
                this.state.setRootNode(tree, res.path);
              }),
              switchMap(() => from(this.state.generatePayload())),
              tap(() => {
                this.state.isGenerating.set(false);
              }),
              catchError((err: unknown) => {
                this.state.isGenerating.set(false);
                const message = extractErrorMessage(err);
                this.state.appendLog(`Ошибка сканирования: ${message}`);
                return EMPTY;
              }),
            );
        }),
        catchError((err: unknown) => {
          const message = extractErrorMessage(err);
          this.state.appendLog(`Ошибка диалога: ${message}`);
          return EMPTY;
        }),
      );
    }),
  );

  private readonly desktopSaveHandler$ = this.browseSaveTrigger$.pipe(
    exhaustMap(() => {
      if (!this.platform.isDesktop()) {
        return EMPTY;
      }
      const extension = this.state.transformOptions().xml_format
        ? '.xml'
        : '.txt';
      const defaultFilename = `code_context${extension}`;
      return this.api.selectSaveFile(defaultFilename, extension).pipe(
        tap((res) => {
          if (res.success && res.path) {
            this.state.setExportPath(res.path);
            this.state.appendLog(`Выбран путь экспорта: ${res.path}`);
          }
        }),
        catchError((err: unknown) => {
          const message = extractErrorMessage(err);
          this.state.appendLog(`Ошибка выбора пути сохранения: ${message}`);
          return EMPTY;
        }),
      );
    }),
  );

  private readonly sideEffects$ = merge(
    this.desktopFolderHandler$,
    this.desktopSaveHandler$,
  );

  constructor() {
    this.sideEffects$.pipe(takeUntilDestroyed()).subscribe();
  }

  protected onProjectDirChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const path = event.target.value.trim();
      this.state.setRootPath(path);
    }
  }

  protected onExportPathChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const path = event.target.value.trim();
      this.state.setExportPath(path);
    }
  }

  protected async browseProjectDir(): Promise<void> {
    if (this.platform.isDesktop()) {
      this.browseDesktopTrigger$.next();
      return;
    }

    try {
      const res = await this.fileSystem.openDirectoryPicker(
        this.state.scanOptions(),
      );
      if (res.rootNode) {
        this.state.setRootNode(res.rootNode);
        this.state.setProjectGitignoreRules(res.gitignoreRules);
        await this.state.generatePayload();
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        const message = extractErrorMessage(err);
        this.state.appendLog(`Ошибка открытия директории: ${message}`);
      }
    }
  }

  protected async browseExportPath(): Promise<void> {
    if (this.platform.isDesktop()) {
      this.browseSaveTrigger$.next();
      return;
    }

    const extension = this.state.transformOptions().xml_format
      ? '.xml'
      : '.txt';
    const defaultName = `code_context${extension}`;

    if (hasSaveFilePicker(window)) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description:
                extension === '.xml' ? 'XML Document' : 'Text Document',
              accept: {
                [extension === '.xml' ? 'application/xml' : 'text/plain']: [
                  extension,
                ],
              },
            },
          ],
        });
        if (handle.name) {
          this.state.setExportPath(handle.name);
        }
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (!isAbort) {
          this.state.setExportPath(defaultName);
        }
      }
    } else {
      const currentPath = this.state.exportPath();
      if (!currentPath && this.state.rootPath()) {
        this.state.setExportPath(
          `${this.state.rootPath().replace(/[\\/]$/, '')}/code_context${extension}`,
        );
      } else if (!currentPath) {
        this.state.setExportPath(defaultName);
      }
    }
  }
}
