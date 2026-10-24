export type Theme = 'dark' | 'light';

export interface ScanOptions {
  readonly use_gitignore: boolean;
  readonly ignore_binary: boolean;
  readonly ignore_lockfiles: boolean;
  readonly whitelist_extensions: string[];
  readonly manual_excludes: string[];
  readonly gitignore_disabled_rules: string[];
  readonly binary_extensions: string[];
  readonly lockfiles_excludes: string[];
  readonly output_file_path?: string | null;
  readonly auto_watch?: boolean;
}

export interface TransformOptions {
  readonly strip_comments: boolean;
  readonly compress_whitespace: boolean;
  readonly sanitize_secrets: boolean;
  readonly skeleton_mode: boolean;
  readonly xml_format: boolean;
  readonly always_send_full_tree: boolean;
  readonly system_prompt: string;
  readonly comment_rules_json?: string | null;
  readonly max_token_budget?: number | null;
  readonly git_diff_mode: boolean;
  readonly git_diff_context_lines: number;
  readonly git_diff_text?: string | null;
  readonly auto_watch?: boolean;
}

export interface ContextProjectConfig {
  readonly max_token_budget?: number;
  readonly xml_format: boolean;
  readonly git_diff_mode: boolean;
  readonly strip_comments?: boolean;
  readonly compress_whitespace?: boolean;
  readonly sanitize_secrets?: boolean;
  readonly skeleton_mode?: boolean;
  readonly always_send_full_tree?: boolean;
}

export interface DefaultSettingsConfig {
  readonly xml_format?: boolean;
  readonly strip_comments?: boolean;
  readonly compress_whitespace?: boolean;
  readonly sanitize_secrets?: boolean;
  readonly skeleton_mode?: boolean;
  readonly use_gitignore?: boolean;
  readonly ignore_binary?: boolean;
  readonly ignore_lockfiles?: boolean;
  readonly auto_check_updates?: boolean;
  readonly auto_watch?: boolean;
  readonly always_send_full_tree?: boolean;
  readonly theme?: Theme;
  readonly selected_preset?: string;
  readonly global_excludes?: string[];
  readonly binary_extensions?: string[];
  readonly lockfiles_excludes?: string[];
  readonly active_extensions?: string[];
  readonly all_known_extensions?: string[];
  readonly presets?: Record<string, string[]>;
}

export interface CommentRuleDefinition {
  readonly extensions: string[];
  readonly pattern?: string;
  readonly hash_pattern?: string;
  readonly docstring_pattern?: string;
}

export interface CommentRulesConfig {
  readonly rules: Record<string, CommentRuleDefinition>;
}
