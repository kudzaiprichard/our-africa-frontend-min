import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_BASE_HREF } from '@angular/common';
import { routes } from './app.routes';
import {authInterceptor} from './libs/identity_access/interceptors/token-refresh.interceptor';
import {tokenRefreshInterceptor} from './libs/identity_access/interceptors/auth.interceptor';
import {responseInterceptor} from './libs/core';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_BASE_HREF, useValue: '/' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        tokenRefreshInterceptor,
        responseInterceptor
      ])
    ),
    provideAnimationsAsync()
  ]
};
