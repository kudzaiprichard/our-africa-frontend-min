// src/app/theme/layout/components/nav-history/nav-history.component.ts

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageInfo } from '../../models/navigation.model';

@Component({
  selector: 'app-nav-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-history.component.html',
  styleUrls: ['./nav-history.component.scss']
})
export class NavHistoryComponent implements OnInit {
  @Input() canGoBack: boolean = false;
  @Input() canGoForward: boolean = false;
  @Input() currentPage: PageInfo | null = null;

  @Output() back = new EventEmitter<void>();
  @Output() forward = new EventEmitter<void>();

  ngOnInit(): void {
    // Initialize with default page if none provided
    if (!this.currentPage) {
      this.currentPage = {
        page: 'dashboard',
        icon: 'fa-home',
        label: 'Dashboard'
      };
    }
  }

  onBack(): void {
    if (this.canGoBack) {
      this.back.emit();
    }
  }

  onForward(): void {
    if (this.canGoForward) {
      this.forward.emit();
    }
  }
}
