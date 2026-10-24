import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from '@angular/core';

import { FileNode } from '@models/tree.model';
import { StateService } from '@services/state.service';
import { FileIconComponent } from '@shared/components/file-icon/file-icon.component';

@Component({
  selector: 'app-tree-node',
  templateUrl: './tree-node.component.html',
  styleUrl: './tree-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FileIconComponent, forwardRef(() => TreeNodeComponent)],
})
export class TreeNodeComponent {
  protected readonly state = inject(StateService);

  readonly node = input.required<FileNode>();
  readonly depth = input<number>(0);
  readonly searchQuery = input<string>('');

  readonly isExpanded = computed<boolean>(() => {
    return this.state.isPathExpanded(this.node().rel_path);
  });

  readonly isFocused = computed<boolean>(() => {
    return (
      !this.node().is_dir && this.state.focusedPath() === this.node().rel_path
    );
  });

  readonly selectionState = computed<{
    readonly checked: boolean;
    readonly indeterminate: boolean;
  }>(() => {
    return this.computeSelectionState(this.node(), this.state.selectedPaths());
  });

  readonly isVisible = computed<boolean>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return true;
    }
    return this.checkNodeVisible(this.node(), query);
  });

  readonly formattedSize = computed<string>(
    () => `${(this.node().size / 1024).toFixed(1)} KB`,
  );

  readonly paddingLeft = computed<number>(() => this.depth() * 16);

  protected toggleExpand(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.node().is_dir) {
      this.state.togglePathExpansion(this.node().rel_path);
    }
  }

  protected onRowClick(): void {
    const current = this.node();
    if (current.is_dir) {
      this.toggleExpand();
    } else {
      this.state.setFocusedPath(current.rel_path);
    }
  }

  protected onCheckboxChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.toggleNodeRecursive(this.node(), event.target.checked);
    }
  }

  private computeSelectionState(
    node: FileNode,
    selectedSet: ReadonlySet<string>,
  ): { readonly checked: boolean; readonly indeterminate: boolean } {
    if (selectedSet.size === 0) {
      return { checked: false, indeterminate: false };
    }

    if (!node.is_dir) {
      return { checked: selectedSet.has(node.rel_path), indeterminate: false };
    }

    let total = 0;
    let selected = 0;

    const traverse = (item: FileNode): void => {
      for (const child of item.children) {
        if (!child.is_dir) {
          total += 1;
          if (selectedSet.has(child.rel_path)) {
            selected += 1;
          }
        } else {
          traverse(child);
        }
      }
    };

    traverse(node);

    if (total === 0) {
      return { checked: false, indeterminate: false };
    }
    if (selected === total) {
      return { checked: true, indeterminate: false };
    }
    if (selected > 0) {
      return { checked: false, indeterminate: true };
    }
    return { checked: false, indeterminate: false };
  }

  private checkNodeVisible(node: FileNode, query: string): boolean {
    if (node.name.toLowerCase().includes(query)) {
      return true;
    }
    if (node.is_dir) {
      for (const child of node.children) {
        if (this.checkNodeVisible(child, query)) {
          return true;
        }
      }
    }
    return false;
  }

  private toggleNodeRecursive(node: FileNode, check: boolean): void {
    if (!node.is_dir) {
      this.state.togglePathSelection(node.rel_path, check);
    } else {
      for (const child of node.children) {
        this.toggleNodeRecursive(child, check);
      }
    }
  }
}
