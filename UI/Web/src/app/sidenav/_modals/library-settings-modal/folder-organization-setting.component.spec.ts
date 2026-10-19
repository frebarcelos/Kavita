import {TestBed} from '@angular/core/testing';
import {describe, expect, it} from 'vitest';
import {FolderOrganizationSettingComponent} from './folder-organization-setting.component';

describe('Folder organization setting', () => {
  function create(enabled = false, locked = false) {
    const fixture = TestBed.createComponent(FolderOrganizationSettingComponent);
    fixture.componentRef.setInput('label', 'Organizar por pastas');
    fixture.componentRef.setInput('description', 'Usar pastas e ignorar metadados internos.');
    fixture.componentRef.setInput('enabled', enabled);
    fixture.componentRef.setInput('locked', locked);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the saved choice with an accessible label', () => {
    const fixture = create(true);
    const checkbox = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
    expect(fixture.nativeElement.querySelector('label').textContent).toContain('Organizar por pastas');
  });

  it('lets a new library opt in and publishes the selected value', () => {
    const fixture = create();
    const values: boolean[] = [];
    fixture.componentInstance.enabled.subscribe(value => values.push(value));
    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    checkbox.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.enabled()).toBe(true);
    expect(values).toEqual([true]);
  });

  it('keeps organization locked for an existing catalog', () => {
    const fixture = create(true, true);
    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.disabled).toBe(true);
    checkbox.click();
    expect(fixture.componentInstance.enabled()).toBe(true);
  });
});
