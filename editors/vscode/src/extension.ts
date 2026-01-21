import * as vscode from 'vscode';
import { IceTypeCompletionProvider, triggerCharacters } from './completions';

/**
 * IceType VS Code Extension
 *
 * Provides syntax highlighting, autocomplete, and language support for
 * IceType schema files and embedded IceType schemas in TypeScript/JavaScript.
 */

export function activate(context: vscode.ExtensionContext): void {
  console.log('IceType extension activated');

  // Register completion provider for IceType files
  const iceTypeCompletionProvider = new IceTypeCompletionProvider();

  // Register for .ice and .icetype files
  const iceTypeSelector: vscode.DocumentSelector = [
    { language: 'icetype', scheme: 'file' },
    { language: 'icetype', scheme: 'untitled' },
  ];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      iceTypeSelector,
      iceTypeCompletionProvider,
      ...triggerCharacters
    )
  );

  // Also register for TypeScript/JavaScript for embedded IceType schemas
  const embeddedSelector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
  ];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      embeddedSelector,
      iceTypeCompletionProvider,
      ...triggerCharacters
    )
  );

  console.log('IceType completion providers registered');

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
