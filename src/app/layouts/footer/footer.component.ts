import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import {
  extractErrorMessage,
  hasSaveFilePicker,
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
  private readonly api = inject(ApiService);

  readonly copyStatus = signal<string>('Скопировать в буфер');
  readonly saveStatus = signal<string>('');

  readonly isExportDisabled = computed<boolean>(() => {
    return this.state.generatedPayload().length === 0;
  });

  readonly downloadFileName = computed<string>(() => {
    return this.state.transformOptions().xml_format
      ? 'code_context.xml'
      : 'code_context.txt';
  });

  readonly saveButtonText = computed<string>(() => {
    const status = this.saveStatus();
    if (status) {
      return status;
    }
    return this.state.transformOptions().xml_format
      ? 'Записать в XML'
      : 'Записать в TXT';
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

    if (this.platform.isDesktop()) {
      let targetPath = this.state.exportPath();
      if (!targetPath) {
        const ext = this.state.transformOptions().xml_format ? '.xml' : '.txt';
        const defaultName = `code_context${ext}`;
        try {
          const res = await firstValueFrom(
            this.api.selectSaveFile(defaultName, ext),
          );
          if (res.success && res.path) {
            targetPath = res.path;
            this.state.setExportPath(targetPath);
          }
        } catch {
          targetPath = '';
        }
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
        return;
      }
    }

    const ext = this.state.transformOptions().xml_format ? '.xml' : '.txt';
    const defaultName = `code_context${ext}`;
    const mimeType = this.state.transformOptions().xml_format
      ? 'application/xml;charset=utf-8'
      : 'text/plain;charset=utf-8';

    if (hasSaveFilePicker(window)) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: ext === '.xml' ? 'XML Document' : 'Text Document',
              accept: { [mimeType]: [ext] },
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
    anchor.download = this.downloadFileName();
    anchor.click();
    URL.revokeObjectURL(url);
    this.state.appendLog(`Файл сохранен: ${this.downloadFileName()}`);
    this.saveStatus.set('Сохранено! ✓');
    setTimeout(() => this.saveStatus.set(''), 2000);
  }
}
