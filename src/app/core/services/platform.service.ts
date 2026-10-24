import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, merge, Subject, switchMap, tap } from 'rxjs';

import { ServiceStatus } from '@models/api.model';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly checkTrigger$ = new Subject<void>();

  readonly status = signal<ServiceStatus | null>(null);
  readonly isChecking = signal<boolean>(true);
  readonly isDesktop = signal<boolean>(false);

  readonly isGitAvailable = computed<boolean>(
    () => this.isDesktop() && (this.status()?.desktop_bridge ?? false),
  );
  readonly isWatcherAvailable = computed<boolean>(() => this.isDesktop());
  readonly isWasmOnly = computed<boolean>(() => !this.isDesktop());

  private readonly checkHandler$ = this.checkTrigger$.pipe(
    switchMap(() => {
      this.isChecking.set(true);
      return this.http.get<ServiceStatus>('/api/status').pipe(
        tap((res: ServiceStatus) => {
          this.status.set(res);
          this.isDesktop.set(true);
          this.isChecking.set(false);
        }),
        catchError(() => {
          this.status.set(null);
          this.isDesktop.set(false);
          this.isChecking.set(false);
          return EMPTY;
        }),
      );
    }),
  );

  private readonly sideEffects$ = merge(this.checkHandler$);

  constructor() {
    this.sideEffects$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.checkTrigger$.next();
  }

  checkPlatform(): void {
    this.checkTrigger$.next();
  }
}
