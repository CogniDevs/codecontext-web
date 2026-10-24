import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import {
  extractErrorMessage,
  hasSaveFilePicker,
  sanitizeProjectContextFileName,
} from '@core/utils/type-guards';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FooterComponent {
  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  private readonly fileSystem = inject(FileSystemService);
  private readonly api = inject(ApiService);

  readonly copyStatus = signal<string>('Скопировать в буфер');
  readonly saveStatus = signal<string>('');

  readonly isExportDisabled = computed<boolean>(() => {
    return this.state.generatedPayload().length === 0;
  });

  readonly downloadFileName = computed<string>(() => {
    const rawName =
      this.fileSystem.currentProjectName() || this.state.rootPath() || 'code';

    const normalized = rawName.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const segments = normalized.split('/').filter(Boolean);
    const projectName = segments.pop() || normalized;

    return sanitizeProjectContextFileName(projectName);
  });

  readonly saveButtonText = computed<string>(() => {
    const status = this.saveStatus();
    if (status) {
      return status;
    }
    return 'Записать в файл';
  });

  protected async copyToClipboard(): Promise<void> {
    const payload = this.state.generatedPayload();
    if (!payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      this.copyStatus.set('Скопировано! ✓');
      setTimeout(() => this.copyStatus.set('Скопировать в буфер'), 2000);
    } catch {
      alert('Не удалось скопировать контекст в буфер обмена.');
    }
  }

  protected async downloadContextFile(): Promise<void> {
    const payload = this.state.generatedPayload();
    if (!payload) {
      return;
    }

    const defaultName = this.downloadFileName();

    if (this.platform.isDesktop()) {
      let targetPath = '';
      try {
        const res = await firstValueFrom(
          this.api.selectSaveFile(defaultName, '.txt'),
        );
        if (res.success && res.path) {
          targetPath = res.path;
        }
      } catch {
        targetPath = '';
      }

      if (targetPath) {
        this.api.saveFile(targetPath, payload).subscribe({
          next: () => {
            this.state.appendLog(`Контекст записан на диск: ${targetPath}`);
            this.saveStatus.set('Сохранено! ✓');
            setTimeout(() => this.saveStatus.set(''), 2000);
          },
          error: (err: unknown) => {
            const msg = extractErrorMessage(err);
            this.state.appendLog(`Ошибка записи файла: ${msg}`);
            alert(`Ошибка записи файла: ${msg}`);
          },
        });
      }
      return;
    }

    const mimeType = 'text/plain;charset=utf-8';

    if (hasSaveFilePicker(window)) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: 'Text Document',
              accept: { [mimeType]: ['.txt'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();
        this.state.appendLog(`Файл успешно сохранен: ${defaultName}`);
        this.saveStatus.set('Сохранено! ✓');
        setTimeout(() => this.saveStatus.set(''), 2000);
        return;
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (isAbort) {
          return;
        }
      }
    }

    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = defaultName;
    anchor.click();
    URL.revokeObjectURL(url);
    this.state.appendLog(`Файл сохранен: ${defaultName}`);
    this.saveStatus.set('Сохранено! ✓');
    setTimeout(() => this.saveStatus.set(''), 2000);
  }
}
