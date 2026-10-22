import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
  selector: 'app-epub-book-decoration',
  template: `
    <div class="epub-book-edge epub-book-edge-left" [style.width.px]="leftEdge()"></div>
    @if (twoPages()) { <div class="epub-book-spine"></div> }
    <div class="epub-book-edge epub-book-edge-right" [style.width.px]="rightEdge()"></div>
  `,
  styleUrl: './epub-book-decoration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'aria-hidden': 'true', '[class.epub-book-dark]': 'dark()'},
})
export class EpubBookDecorationComponent {
  readonly twoPages = input(false);
  readonly page = input(1);
  readonly pages = input(1);
  readonly rightToLeft = input(false);
  readonly dark = input(false);

  private readonly fraction = computed(() => this.pages() <= 1 ? 0
    : Math.max(0, Math.min(1, (this.page() - 1) / (this.pages() - 1))));
  readonly leftEdge = computed(() => 1 + 8 * (this.rightToLeft() ? 1 - this.fraction() : this.fraction()));
  readonly rightEdge = computed(() => 10 - this.leftEdge());
}
