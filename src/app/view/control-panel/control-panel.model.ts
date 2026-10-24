export interface BudgetOption {
  readonly label: string;
  readonly value: number | null;
}

export type BooleanTransformOption =
  | 'xml_format'
  | 'strip_comments'
  | 'compress_whitespace'
  | 'sanitize_secrets'
  | 'skeleton_mode'
  | 'auto_watch'
  | 'git_diff_mode';
