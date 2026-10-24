export interface PromptPreset {
  readonly key: string;
  readonly title: string;
  readonly prompt: string;
  readonly custom?: boolean;
}

export interface RuleItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rule_text: string;
  readonly active: boolean;
}

export interface CustomRuleRequest {
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly rule_text: string;
}

export interface CompilePromptRequest {
  readonly selected_rules: Record<string, string[]>;
}

export interface CompilePromptResponse {
  readonly compiled_prompt: string;
}

export interface PromptMutationResponse {
  readonly status: string;
  readonly prompt: PromptPreset;
}

export interface RuleMutationResponse {
  readonly status: string;
  readonly rule: RuleItem;
}
