import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/'); // reset any #hash a test navigated to
  vi.unstubAllGlobals();
});
