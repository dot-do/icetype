import * as vscode from 'vscode';

/**
 * IceType VS Code Extension
 *
 * Provides syntax highlighting for IceType schema files and
 * embedded IceType schemas in TypeScript/JavaScript.
 */

export function activate(context: vscode.ExtensionContext): void {
  console.log('IceType extension activated');

  // Register status bar item to show when editing IceType files
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(file-code) IceType';
  statusBarItem.tooltip = 'IceType Schema File';
  context.subscriptions.push(statusBarItem);

  // Show status bar item when editing IceType files
  const updateStatusBar = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'icetype') {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  // Update on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );

  // Initial update
  updateStatusBar();
}

export function deactivate(): void {
  console.log('IceType extension deactivated');
}
