import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, tap } from 'rxjs';

import { PromptPreset } from '@models/prompt.model';
import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import {
  BooleanTransformOption,
  BudgetOption,
} from '@view/control-panel/control-panel.model';
import {
  BUDGET_OPTIONS,
  FALLBACK_PRESETS,
} from '@view/control-panel/control-panel.data';

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ControlPanelComponent implements OnInit {
  protected readonly budgetOptions: readonly BudgetOption[] = BUDGET_OPTIONS;

  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly logContainer =
    viewChild<ElementRef<HTMLTextAreaElement>>('logContainer');

  readonly addPromptRequested = output<void>();
  readonly editPromptRequested = output<PromptPreset>();

  readonly promptPresets = signal<readonly PromptPreset[]>(FALLBACK_PRESETS);
  readonly selectedPromptKey = signal<string>('just_code');

  readonly isGitDiffAvailable = computed<boolean>(() => {
    return this.platform.isDesktop();
  });

  readonly isDiffModeActive = computed<boolean>(() => {
    return this.state.transformOptions().git_diff_mode;
  });

  readonly logsText = computed<string>(() => {
    return this.state.workLogs().join('\n');
  });

  constructor() {
    effect(() => {
      this.state.workLogs();
      const elem = this.logContainer()?.nativeElement;
      if (elem) {
        queueMicrotask(() => {
          elem.scrollTop = elem.scrollHeight;
        });
      }
    });
  }

  ngOnInit(): void {
    this.loadPrompts();
  }

  protected onPromptChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const key = event.target.value;
      this.selectedPromptKey.set(key);
      const preset = this.promptPresets().find((p) => p.key === key);
      const systemPrompt = preset ? preset.prompt : '';

      this.state.transformOptions.update((opts) => ({
        ...opts,
        system_prompt: systemPrompt,
      }));
      this.state.schedulePayloadGeneration();
    }
  }

  protected onBudgetChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const rawValue = event.target.value;
      const budget = rawValue === 'null' ? null : parseInt(rawValue, 10);

      this.state.transformOptions.update((opts) => ({
        ...opts,
        max_token_budget: budget,
      }));
      this.state.schedulePayloadGeneration();
    }
  }

  protected updateBooleanOption(
    key: BooleanTransformOption,
    event: Event,
  ): void {
    if (event.target instanceof HTMLInputElement) {
      const value = event.target.checked;
      this.state.transformOptions.update((opts) => ({
        ...opts,
        [key]: value,
      }));
      this.state.schedulePayloadGeneration();
    }
  }

  protected updateDiffLines(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const val = parseInt(event.target.value, 10);
      const lines = isNaN(val) ? 3 : Math.max(0, Math.min(20, val));
      this.state.transformOptions.update((opts) => ({
        ...opts,
        git_diff_context_lines: lines,
      }));
      this.state.schedulePayloadGeneration();
    }
  }

  protected onAddPrompt(): void {
    this.addPromptRequested.emit();
  }

  protected onEditPrompt(): void {
    const current = this.promptPresets().find(
      (p) => p.key === this.selectedPromptKey(),
    );
    if (current) {
      this.editPromptRequested.emit(current);
    }
  }

  protected onClearLogs(): void {
    this.state.clearLogs();
  }

  upsertPrompt(preset: PromptPreset): void {
    this.promptPresets.update((list) => {
      const idx = list.findIndex((p) => p.key === preset.key);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = preset;
        return next;
      }
      return [...list, preset];
    });

    this.selectedPromptKey.set(preset.key);
    this.state.transformOptions.update((opts) => ({
      ...opts,
      system_prompt: preset.prompt,
    }));
    this.state.schedulePayloadGeneration();
  }

  private loadPrompts(): void {
    if (this.platform.isDesktop()) {
      this.api
        .getPrompts()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap((data: Record<string, PromptPreset>) => {
            const loaded: PromptPreset[] = Object.entries(data).map(
              ([key, item]) => ({
                key,
                title: item.title,
                prompt: item.prompt,
                custom: item.custom,
              }),
            );
            if (loaded.length > 0) {
              this.promptPresets.set(loaded);
            }
          }),
          catchError(() => {
            this.loadFallbackPrompts();
            return EMPTY;
          }),
        )
        .subscribe();
    } else {
      this.loadFallbackPrompts();
    }
  }

  private loadFallbackPrompts(): void {
    this.http
      .get<Record<string, PromptPreset>>(
        'assets/resources/default_prompts.json',
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((data: Record<string, PromptPreset>) => {
          if (!data) {
            return;
          }
          const loaded: PromptPreset[] = Object.entries(data).map(
            ([key, item]) => ({
              key,
              title: item.title,
              prompt: item.prompt,
              custom: item.custom,
            }),
          );
          if (loaded.length > 0) {
            this.promptPresets.set(loaded);
          }
        }),
        catchError(() => EMPTY),
      )
      .subscribe();
  }
}
