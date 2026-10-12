import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

/**
 * The landing animation: messy stories go in, a neat edition comes out.
 * Pure CSS keyframes; paused when off-screen or when motion is reduced.
 */
@Component({
  selector: 'app-morning-machine',
  templateUrl: './morning-machine.html',
  styleUrl: './morning-machine.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.paused]': 'paused()' },
})
export class MorningMachine {
  readonly animate = input(true);
  private readonly onScreen = signal(true);
  protected readonly paused = computed(() => !this.animate() || !this.onScreen());

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const io = new IntersectionObserver(([entry]) => this.onScreen.set(entry?.isIntersecting ?? true));
      io.observe(host);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
