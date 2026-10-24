declare module 'codecontext_core' {
  const init: (module_or_path?: any) => Promise<any>;
  export default init;

  export function compress_whitespace_wasm(text: string): string;
  export function sanitize_secrets_wasm(text: string): string;
  export function strip_comments_wasm(
    text: string,
    extension: string,
    rules_json?: string | null
  ): string;
  export function count_tokens_wasm(text: string): number;
  export function is_ignored_wasm(
    rel_path: string,
    is_dir: boolean,
    options_json: string
  ): boolean;
  export function trace_dependencies_wasm(
    root_dir: string,
    target_rel_path: string,
    content: string,
    all_known_paths_json?: string | null
  ): string[];
  export function build_payload_wasm(
    root_name: string,
    root_node_json: string,
    files_json: string,
    selected_paths_json: string,
    options_json: string
  ): string;
}
