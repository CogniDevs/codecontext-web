import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { FileNode } from '@models/tree.model';
import { ScanOptions } from '@models/settings.model';
import {
  CompilePromptResponse,
  CustomRuleRequest,
  PromptMutationResponse,
  PromptPreset,
  RuleItem,
  RuleMutationResponse,
} from '@models/prompt.model';
import {
  GitDiffRequest,
  GitDiffResponse,
  GitignoreRulesResponse,
  GitStatusRequest,
  GitStatusResponse,
} from '@models/git.model';
import {
  DependenciesRequest,
  DependenciesResponse,
  OperationStatusResponse,
  PayloadRequest,
  PayloadResponse,
  SaveFileRequest,
  SaveFileResponse,
  ScanRequest,
  SelectPathResponse,
  ServiceStatus,
  StandaloneTreeRequest,
  StandaloneTreeResponse,
  TokenCountRequest,
  TokenCountResponse,
  WatcherEvent,
} from '@models/api.model';
import { isRecord } from '@core/utils/type-guards';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<ServiceStatus> {
    return this.http.get<ServiceStatus>('/api/status');
  }

  selectFolder(): Observable<SelectPathResponse> {
    return this.http.post<SelectPathResponse>('/api/select-folder', {});
  }

  selectSaveFile(
    defaultFilename?: string,
    extension?: string,
  ): Observable<SelectPathResponse> {
    return this.http.post<SelectPathResponse>('/api/select-save-file', {
      default_filename: defaultFilename ?? '',
      extension: extension ?? '',
    });
  }

  getGitignoreRules(rootDir: string): Observable<GitignoreRulesResponse> {
    const params = new HttpParams().set('root_dir', rootDir);
    return this.http.get<GitignoreRulesResponse>('/api/gitignore', { params });
  }

  scanDirectory(
    rootDir: string,
    options?: ScanOptions | null,
  ): Observable<FileNode> {
    const payload: ScanRequest = { root_dir: rootDir, options };
    return this.http.post<FileNode>('/api/scan', payload);
  }

  buildPayload(req: PayloadRequest): Observable<PayloadResponse> {
    return this.http.post<PayloadResponse>('/api/payload', req);
  }

  generateStandaloneTree(
    req: StandaloneTreeRequest,
  ): Observable<StandaloneTreeResponse> {
    return this.http.post<StandaloneTreeResponse>(
      '/api/payload/standalone-tree',
      req,
    );
  }

  countTokens(text: string): Observable<TokenCountResponse> {
    const payload: TokenCountRequest = { text };
    return this.http.post<TokenCountResponse>('/api/payload/tokens', payload);
  }

  getGitStatus(rootDir: string): Observable<GitStatusResponse> {
    const payload: GitStatusRequest = { root_dir: rootDir };
    return this.http.post<GitStatusResponse>('/api/git/status', payload);
  }

  getGitDiff(
    rootDir: string,
    contextLines: number = 3,
  ): Observable<GitDiffResponse> {
    const payload: GitDiffRequest = {
      root_dir: rootDir,
      context_lines: contextLines,
    };
    return this.http.post<GitDiffResponse>('/api/git/diff', payload);
  }

  traceDependencies(
    req: DependenciesRequest,
  ): Observable<DependenciesResponse> {
    return this.http.post<DependenciesResponse>('/api/dependencies', req);
  }

  getSettings(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/settings');
  }

  saveSettings(settingsData: Record<string, unknown>): Observable<{
    readonly status: string;
    readonly settings: Record<string, unknown>;
  }> {
    return this.http.post<{
      readonly status: string;
      readonly settings: Record<string, unknown>;
    }>('/api/settings', settingsData);
  }

  getPrompts(): Observable<Record<string, PromptPreset>> {
    return this.http.get<Record<string, PromptPreset>>('/api/prompts');
  }

  updatePrompt(preset: PromptPreset): Observable<PromptMutationResponse> {
    return this.http.post<PromptMutationResponse>('/api/prompts', preset);
  }

  deletePrompt(key: string): Observable<OperationStatusResponse> {
    return this.http.delete<OperationStatusResponse>(`/api/prompts/${key}`);
  }

  getRules(): Observable<Record<string, RuleItem[]>> {
    return this.http.get<Record<string, RuleItem[]>>('/api/rules');
  }

  addCustomRule(rule: CustomRuleRequest): Observable<RuleMutationResponse> {
    return this.http.post<RuleMutationResponse>('/api/rules/custom', rule);
  }

  compilePrompt(
    selectedRules: Record<string, string[]>,
  ): Observable<CompilePromptResponse> {
    return this.http.post<CompilePromptResponse>('/api/rules/compile', {
      selected_rules: selectedRules,
    });
  }

  saveFile(filePath: string, content: string): Observable<SaveFileResponse> {
    const payload: SaveFileRequest = { file_path: filePath, content };
    return this.http.post<SaveFileResponse>('/api/save-file', payload);
  }

  watchFileEvents(): Observable<WatcherEvent> {
    return new Observable<WatcherEvent>((subscriber) => {
      const eventSource = new EventSource('/api/watch/events');

      eventSource.addEventListener('file_change', (event: Event) => {
        if (event instanceof MessageEvent && typeof event.data === 'string') {
          try {
            const parsed: unknown = JSON.parse(event.data);
            if (
              isRecord(parsed) &&
              typeof parsed['type'] === 'string' &&
              typeof parsed['path'] === 'string' &&
              typeof parsed['timestamp'] === 'number'
            ) {
              subscriber.next({
                type: parsed['type'],
                path: parsed['path'],
                timestamp: parsed['timestamp'],
              });
            }
          } catch (err: unknown) {
            subscriber.error(err);
          }
        }
      });

      eventSource.onerror = (error: Event) => {
        subscriber.error(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
