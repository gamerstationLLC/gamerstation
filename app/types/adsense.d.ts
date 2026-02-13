export {};

declare global {
  interface Window {
    adsbygoogle?: any[];
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  }
}
