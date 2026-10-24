import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';

import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import { ThemeService } from '@services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class HeaderComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly fileSystemService = inject(FileSystemService);
  protected readonly stateService = inject(StateService);
  protected readonly platformService = inject(PlatformService);

  readonly openSettingsRequested = output<void>();

  protected readonly projectName = computed<string>(() => {
    const fsName = this.fileSystemService.currentProjectName();
    if (fsName) {
      return fsName;
    }
    const root = this.stateService.rootPath();
    if (root) {
      const parts = root.replace(/\\/g, '/').split('/');
      return parts[parts.length - 1] ?? root;
    }
    return '';
  });

  protected readonly platformBadge = computed<string>(() => {
    if (this.platformService.isChecking()) {
      return 'Проверка...';
    }
    return this.platformService.isDesktop() ? 'Desktop API' : 'WASM Web';
  });

  protected onOpenSettings(): void {
    this.openSettingsRequested.emit();
  }

  protected onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
