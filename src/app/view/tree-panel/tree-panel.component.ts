import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { TreeNodeComponent } from '@view/tree-panel/tree-node/tree-node.component';

@Component({
  selector: 'app-tree-panel',
  templateUrl: './tree-panel.component.html',
  styleUrl: './tree-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TreeNodeComponent],
})
export class TreePanelComponent {
  protected readonly fileSystemService = inject(FileSystemService);
  protected readonly stateService = inject(StateService);
  protected readonly platformService = inject(PlatformService);
  private readonly apiService = inject(ApiService);

  protected readonly refreshTrigger$ = new Subject<void>();
  protected readonly gitSelectTrigger$ = new Subject<void>();
  protected readonly depsSelectTrigger$ = new Subject<void>();
  protected readonly copyTreeTrigger$ = new Subject<void>();

  readonly searchQuery = signal<string>('');
  readonly isSmartMenuOpen = signal<boolean>(false);

  readonly isGitAvailable = computed<boolean>(() => {
    return this.platformService.isGitAvailable();
  });

  private readonly refreshHandler$ = this.refreshTrigger$.pipe(
    exhaustMap(() => {
      if (this.platformService.isDesktop() && this.stateService.rootPath()) {
        this.stateService.isGenerating.set(true);
        return this.apiService
          .scanDirectory(
            this.stateService.rootPath(),
            this.stateService.scanOptions(),
          )
          .pipe(
            tap((tree: FileNode) => {
              this.stateService.setRootNode(tree, this.stateService.rootPath());
              this.stateService.isGenerating.set(false);
            }),
            switchMap(() => from(this.stateService.generatePayload())),
            catchError(() => {
              this.stateService.isGenerating.set(false);
              return EMPTY;
            }),
          );
      }
      return from(this.stateService.generatePayload()).pipe(
        catchError(() => EMPTY),
      );
    }),
  );

  private readonly gitSelectHandler$ = this.gitSelectTrigger$.pipe(
    exhaustMap(() => {
      return from(this.stateService.fetchGitStatus()).pipe(
        tap(() => {
          this.stateService.selectGitModifiedFilesOnly();
        }),
        catchError(() => EMPTY),
      );
    }),
  );

  private readonly depsSelectHandler$ = this.depsSelectTrigger$.pipe(
    exhaustMap(() => {
      return from(this.stateService.traceDependenciesForFocusedFile()).pipe(
        catchError(() => EMPTY),
      );
    }),
  );

  private readonly copyTreeHandler$ = this.copyTreeTrigger$.pipe(
    exhaustMap(() => {
      return from(this.stateService.copyStandaloneTree()).pipe(
        catchError(() => EMPTY),
      );
    }),
  );

  private readonly sideEffects$ = merge(
    this.refreshHandler$,
    this.gitSelectHandler$,
    this.depsSelectHandler$,
    this.copyTreeHandler$,
  );

  constructor() {
    this.sideEffects$.pipe(takeUntilDestroyed()).subscribe();
  }

  protected toggleSmartMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isSmartMenuOpen.update((prev) => !prev);
  }

  protected closeSmartMenu(): void {
    this.isSmartMenuOpen.set(false);
  }

  protected onSelectGit(): void {
    this.closeSmartMenu();
    this.gitSelectTrigger$.next();
  }

  protected onSelectDeps(): void {
    this.closeSmartMenu();
    this.depsSelectTrigger$.next();
  }

  protected selectAll(check: boolean): void {
    this.stateService.selectAllFiles(check);
  }

  protected setExpandAll(expand: boolean): void {
    if (expand) {
      this.stateService.expandAllFolders();
    } else {
      this.stateService.collapseAllFolders();
    }
  }

  protected onCopyTree(): void {
    this.copyTreeTrigger$.next();
  }

  protected onRefresh(): void {
    this.refreshTrigger$.next();
  }

  protected onSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchQuery.set(event.target.value);
    }
  }
}
