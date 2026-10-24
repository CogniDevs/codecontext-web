import { FilePayloadItem } from '@models/tree.model';
import { ScanOptions, TransformOptions } from '@models/settings.model';

export interface ScanRequest {
  readonly root_dir: string;
  readonly options?: ScanOptions | null;
}

export interface PayloadRequest {
  readonly root_dir: string;
  readonly root_node?: Record<string, unknown> | null;
  readonly selected_paths: string[];
  readonly options: TransformOptions;
  readonly custom_files?: FilePayloadItem[] | null;
}

export interface PayloadResponse {
  readonly payload: string;
  readonly token_count: number;
  readonly files_count: number;
  readonly size_kb: number;
}

export interface StandaloneTreeRequest {
  readonly root_name: string;
  readonly root_node?: Record<string, unknown> | null;
  readonly selected_paths: string[];
  readonly xml_format: boolean;
}

export interface StandaloneTreeResponse {
  readonly tree_text: string;
}

export interface DependenciesRequest {
  readonly root_dir: string;
  readonly target_rel_path: string;
  readonly content?: string | null;
}

export interface DependenciesResponse {
  readonly dependencies: string[];
}

export interface TokenCountRequest {
  readonly text: string;
}

export interface TokenCountResponse {
  readonly token_count: number;
}

export interface SaveFileRequest {
  readonly file_path: string;
  readonly content: string;
}

export interface SaveFileResponse {
  readonly success: boolean;
  readonly message: string;
}

export interface ServiceStatus {
  readonly status: string;
  readonly desktop_bridge: boolean;
  readonly rust_engine_available: boolean;
  readonly current_version: string;
  readonly system_platform: string;
}

export interface WatcherEvent {
  readonly type: string;
  readonly path: string;
  readonly timestamp: number;
}

export interface SelectPathResponse {
  readonly success: boolean;
  readonly path: string;
}

export interface OperationStatusResponse {
  readonly status: string;
}
