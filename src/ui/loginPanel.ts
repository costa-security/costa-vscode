import * as vscode from 'vscode';

export class LoginPanel implements vscode.Disposable {
  private static current: LoginPanel | undefined;
  private panel: vscode.WebviewPanel;

  static show(context: vscode.ExtensionContext) {
    if (LoginPanel.current) {
      // Already open → just bring it to front
      LoginPanel.current.panel.reveal(vscode.ViewColumn.One);
      return LoginPanel.current;
    }
    LoginPanel.current = new LoginPanel(context);
    return LoginPanel.current;
  }

  static closeIfOpen() {
    LoginPanel.current?.dispose();
  }

  private constructor(_context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      'costaLogin',
      'Sign in to Costa',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.webview.html = this.html();

    // Bridge from webview → extension host
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.command === 'login') {
        // Reuse your existing command instead of coupling to oauth directly
        await vscode.commands.executeCommand('costa.login');
      }
    });

    // When user closes the tab, clear the singleton
    this.panel.onDidDispose(() => {
      LoginPanel.current = undefined;
    });
  }

  dispose() {
    this.panel.dispose();
  }

  private html() {
    return /* html */ `
      <!DOCTYPE html>
      <html>
      <style>
        body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            padding: 1.5rem;
        }

        button {
            background-color: #7c3aed; /* Costa purple */
            color: white;             /* Always white text for contrast */
            border: none;
            border-radius: 6px;
            padding: 8px 14px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out;
        }

        button:hover {
            background-color: #6d28d9; /* Slightly darker hover */
            transform: translateY(-1px);
        }

        button:active {
            transform: translateY(0);
        }
        </style>
        <body style="font-family: system-ui, sans-serif; padding: 16px;">
          <h2>Welcome to 💫 Costa Code</h2>
          <button id="login">Connect with Costa 🚀</button>
          <p>Get live usage statistics, notifications and feedback directly in your editor.</p>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('login').addEventListener('click', () => {
              vscode.postMessage({ command: 'login' });
            });
          </script>
        </body>
      </html>
    `;
  }
}
