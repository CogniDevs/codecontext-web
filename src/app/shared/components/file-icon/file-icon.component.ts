import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

import { resolveFileIcon } from '@shared/components/file-icon/file-icon.utils';

@Component({
  selector: 'app-file-icon',
  templateUrl: './file-icon.component.html',
  styleUrl: './file-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FileIconComponent {
  readonly name = input<string>('');
  readonly isDir = input<boolean>(false);
  readonly isExpanded = input<boolean>(false);

  private readonly hasLoadError = signal<boolean>(false);

  readonly iconName = computed<string>(() => {
    if (this.hasLoadError()) {
      return this.isDir()
        ? this.isExpanded()
          ? 'folder-open'
          : 'folder'
        : 'file';
    }
    return resolveFileIcon(this.name(), this.isDir(), this.isExpanded());
  });

  readonly iconPath = computed<string>(
    () => `assets/icons/material/${this.iconName()}.svg`,
  );

  protected onIconError(): void {
    this.hasLoadError.set(true);
  }
}
