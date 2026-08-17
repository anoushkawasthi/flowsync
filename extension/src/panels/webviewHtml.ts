import * as vscode from "vscode";

/**
 * Shared webview shell for both surfaces: the full editor panel and the
 * activity-bar sidebar view. Both load the same React bundle, so keeping one
 * HTML builder means the CSP, the nonce handling and the injected globals can
 * only ever be defined once.
 *
 * CSP notes:
 * - `font-src ${cspSource}` means fonts must ship inside the extension. The
 *   webview build emits Archivo and JetBrains Mono into webview-ui/build/assets
 *   next to index.css, and vite's `base: './'` keeps their URLs relative so they
 *   resolve inside localResourceRoots.
 * - `default-src 'none'` — nothing remote loads at all.
 */
export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const buildUri = vscode.Uri.joinPath(extensionUri, "webview-ui", "build");

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(buildUri, "assets", "index.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(buildUri, "assets", "index.css")
  );
  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "assets", "logo.png")
  );

  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';
               connect-src ${webview.cspSource};
               font-src ${webview.cspSource};
               img-src ${webview.cspSource} data:;">
    <link rel="stylesheet" href="${styleUri}">
    <script nonce="${nonce}">window.__FLOWSYNC_LOGO__ = "${logoUri}";</script>
    <title>FlowSync</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

/** Resource roots both surfaces need. */
export function webviewResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
  return [
    vscode.Uri.joinPath(extensionUri, "webview-ui", "build"),
    vscode.Uri.joinPath(extensionUri, "assets"),
  ];
}

export function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
