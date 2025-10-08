// src/app/theme/layout/components/scroll-indicator/scroll-indicator.component.ts

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

@Component({
  selector: 'app-scroll-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-indicator.component.html',
  styleUrls: ['./scroll-indicator.component.scss']
})
export class ScrollIndicatorComponent implements OnInit, OnDestroy {
  @Input() scrollContainer?: HTMLElement;
  @Input() hideThreshold: number = 100; // Hide after scrolling 100px

  isHidden: boolean = false;
  private scrollSubscription?: Subscription;

  ngOnInit(): void {
    this.setupScrollListener();
    this.checkInitialScrollability();
  }

  ngOnDestroy(): void {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }

  private setupScrollListener(): void {
    // Get the scroll container (defaults to window if not provided)
    const scrollElement = this.scrollContainer || window;

    // Listen to scroll events with throttle to improve performance
    this.scrollSubscription = fromEvent(scrollElement, 'scroll')
      .pipe(throttleTime(100))
      .subscribe(() => {
        this.checkScrollPosition();
      });
  }

  private checkScrollPosition(): void {
    let scrollTop: number;

    if (this.scrollContainer) {
      scrollTop = this.scrollContainer.scrollTop;
    } else {
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    }

    this.isHidden = scrollTop > this.hideThreshold;
  }

  private checkInitialScrollability(): void {
    // Check if content is scrollable on load
    setTimeout(() => {
      let isScrollable: boolean;

      if (this.scrollContainer) {
        isScrollable = this.scrollContainer.scrollHeight > this.scrollContainer.clientHeight;
      } else {
        isScrollable = document.documentElement.scrollHeight > window.innerHeight;
      }

      if (!isScrollable) {
        this.isHidden = true;
      }
    }, 100);
  }
}
