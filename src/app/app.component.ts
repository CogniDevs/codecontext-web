import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLayoutComponent } from '@layouts/workspace-layout/workspace-layout.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [WorkspaceLayoutComponent],
})
export class AppComponent {}
