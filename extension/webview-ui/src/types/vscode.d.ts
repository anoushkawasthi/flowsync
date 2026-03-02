/**
 * Type definitions for VS Code Webview API
 */

interface VSCodeApi<T = unknown> {
  postMessage(message: T): void;
  getState(): T | undefined;
  setState(state: T): void;
}

/**
 * Function injected by VS Code into webview context
 */
declare function acquireVsCodeApi(): VSCodeApi;