import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { catchError, EMPTY, tap } from 'rxjs';

import { PromptPreset, RuleItem } from '@models/prompt.model';
import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import {
  CategoryTab,
  PromptModalMode,
} from '@shared/components/prompt-modal/prompt-modal.model';
import {
  CATEGORY_TABS,
  XML_TAG_MAP,
} from '@shared/components/prompt-modal/prompt-modal.data';

@Component({
  selector: 'app-prompt-modal',
  templateUrl: './prompt-modal.component.html',
  styleUrl: './prompt-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class PromptModalComponent implements OnInit {
  protected readonly categories: readonly CategoryTab[] = CATEGORY_TABS;

  private readonly api = inject(ApiService);
  private readonly platform = inject(PlatformService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly promptSaved = output<PromptPreset>();

  protected readonly form = new FormGroup({
    title: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    promptText: new FormControl<string>('', { nonNullable: true }),
  });

  readonly isOpen = signal<boolean>(false);
  readonly mode = signal<PromptModalMode>('edit');
  readonly activeCategory = signal<string>('system_role');
  readonly rulesData = signal<Record<string, RuleItem[]>>({});

  private readonly currentPromptKey = signal<string>('');
  private defaultRulesSnapshot: Record<string, RuleItem[]> = {};

  readonly currentCategoryRules = computed<readonly RuleItem[]>(() => {
    return this.rulesData()[this.activeCategory()] ?? [];
  });

  ngOnInit(): void {
    this.loadInitialRules();
  }

  openEdit(preset: PromptPreset): void {
    this.mode.set('edit');
    this.currentPromptKey.set(preset.key);
    this.form.patchValue({
      title: preset.title,
      promptText: preset.prompt,
    });
    this.isOpen.set(true);
  }

  openCreate(): void {
    this.mode.set('create');
    this.currentPromptKey.set(`custom_${Date.now()}`);
    this.form.reset({ title: '', promptText: '' });
    if (Object.keys(this.defaultRulesSnapshot).length > 0) {
      this.rulesData.set(JSON.parse(JSON.stringify(this.defaultRulesSnapshot)));
    }
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected setCategory(key: string): void {
    this.activeCategory.set(key);
  }

  protected toggleRule(ruleId: string): void {
    const cat = this.activeCategory();
    this.rulesData.update((prev) => {
      const catRules = prev[cat] ?? [];
      const updated = catRules.map((r) =>
        r.id === ruleId ? { ...r, active: !r.active } : r,
      );
      return { ...prev, [cat]: updated };
    });
  }

  protected onSave(): void {
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const promptContent =
      this.mode() === 'edit' ? raw.promptText : this.compileLocalPrompt();

    const preset: PromptPreset = {
      key: this.currentPromptKey(),
      title: raw.title.trim(),
      prompt: promptContent,
      custom: true,
    };

    if (this.platform.isDesktop()) {
      this.api
        .updatePrompt(preset)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.promptSaved.emit(preset);
            this.close();
          },
          error: () => {
            this.promptSaved.emit(preset);
            this.close();
          },
        });
    } else {
      this.promptSaved.emit(preset);
      this.close();
    }
  }

  private loadInitialRules(): void {
    this.http
      .get<Record<string, RuleItem[]>>('assets/resources/default_rules.json')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((data: Record<string, RuleItem[]>) => {
          if (data) {
            this.defaultRulesSnapshot = data;
            this.rulesData.set(JSON.parse(JSON.stringify(data)));
          }
        }),
        catchError(() => EMPTY),
      )
      .subscribe();
  }

  private compileLocalPrompt(): string {
    const lines: string[] = [];
    const data = this.rulesData();

    for (const [catKey, xmlTag] of Object.entries(XML_TAG_MAP)) {
      const activeRules = (data[catKey] ?? []).filter((r) => r.active);
      if (activeRules.length > 0) {
        lines.push(`<${xmlTag}>`);
        for (const r of activeRules) {
          lines.push(`  - ${r.rule_text}`);
        }
        lines.push(`</${xmlTag}>\n`);
      }
    }

    return lines.join('\n').trim();
  }
}
