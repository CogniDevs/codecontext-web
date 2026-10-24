import { effect, Injectable, signal } from '@angular/core';

import { Theme } from '@models/settings.model';
import { STORAGE_KEY_THEME } from '@core/utils/constants';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<Theme>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const theme = this.currentTheme();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    });
  }

  toggleTheme(): void {
    this.currentTheme.update((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }

  private getInitialTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
}
