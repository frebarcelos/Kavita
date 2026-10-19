import {ChangeDetectionStrategy, Component, input, model} from '@angular/core';

@Component({
  selector: 'app-folder-organization-setting',
  template: `
    <label class="form-check form-switch d-block">
      <input type="checkbox" role="switch" class="form-check-input"
             [checked]="enabled()" [disabled]="locked()"
             (change)="change($event)">
      <span class="form-check-label">{{ label() }}</span>
      <small class="d-block text-muted">{{ description() }}</small>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderOrganizationSettingComponent {
  enabled = model(false);
  locked = input(false);
  label = input.required<string>();
  description = input.required<string>();

  protected change(event: Event) {
    if (!this.locked()) this.enabled.set((event.target as HTMLInputElement).checked);
  }
}
