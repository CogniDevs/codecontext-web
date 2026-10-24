export interface FileNode {
  readonly name: string;
  readonly full_path: string;
  readonly rel_path: string;
  readonly is_dir: boolean;
  readonly size: number;
  readonly children: FileNode[];
  readonly fileHandle?: FileSystemFileHandle;
  readonly rawFile?: File;
  readonly git_status?: 'modified' | 'added' | 'untracked' | 'deleted';
}

export interface FilePayloadItem {
  readonly rel_path: string;
  readonly content: string;
}

export interface DirectoryScanResult {
  readonly rootNode: FileNode | null;
  readonly gitignoreRules: string[];
}

export function cleanNodeForWasm(node: FileNode): Record<string, unknown> {
  return {
    name: node.name,
    full_path: node.full_path,
    rel_path: node.rel_path,
    is_dir: node.is_dir,
    size: node.size,
    children: node.children.map((child) => cleanNodeForWasm(child)),
  };
}
