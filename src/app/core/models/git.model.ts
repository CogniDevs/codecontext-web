export interface GitStatusRequest {
  readonly root_dir: string;
}

export interface GitStatusResponse {
  readonly success: boolean;
  readonly message: string;
  readonly modified_files: string[];
}

export interface GitDiffRequest {
  readonly root_dir: string;
  readonly context_lines: number;
}

export interface GitDiffResponse {
  readonly success: boolean;
  readonly message: string;
  readonly diff_text: string;
}

export interface GitignoreRulesResponse {
  readonly rules: string[];
}
