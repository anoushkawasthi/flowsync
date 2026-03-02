/**
 * Wrapper around the VS Code webview API.
 * Provides typed postMessage, getState, setState for React components.
 */

type VsCodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

class VSCodeAPIWrapper {
  private readonly vsCodeApi: VsCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === "function") {
      this.vsCodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: unknown): void {
    if (this.vsCodeApi) {
      this.vsCodeApi.postMessage(message);
    } else {
      console.log("[vscode-webview] postMessage (dev mode):", message);
    }
  }

  public getState(): unknown {
    return this.vsCodeApi?.getState();
  }

  public setState<T>(state: T): T {
    this.vsCodeApi?.setState(state);
    return state;
  }
}

export const vscode = new VSCodeAPIWrapper();
