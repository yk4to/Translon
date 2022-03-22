import * as vscode from 'vscode';
import { chromium, ChromiumBrowser } from 'playwright-core';
import Translator from './translator';

let browser: ChromiumBrowser;
let isBrowserRunning = false;
let translator: Translator | undefined;

export function activate(context: vscode.ExtensionContext) {
  
	let disposable = vscode.commands.registerCommand('translon.start', () => {
    try {
      let activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        vscode.window.withProgress({location: vscode.ProgressLocation.Window, title: 'Translon:'},
          async progress => {
            progress.report({ message: 'Launching Browser...' });
            //Launch browser if it wasn't launched
            if (!isBrowserRunning) {
              browser = await chromium.launch({
                headless: vscode.workspace.getConfiguration('translon').get<boolean>('useHeadlessBrowser'),
                channel: vscode.workspace.getConfiguration('translon').get('browserDistributionChannel'),
              });
              isBrowserRunning = true;
              //Turn off 'isRunning' flag when browser was closed
              browser.on('disconnected', () => {isBrowserRunning = false;});
            }
            //Create Translator Instance
            const reportProgress = (message: string) => {
              progress.report({ message: message, increment: 0 });
            };
            const closeListener = () => {
              browser.close();
              translator = undefined;
            };
            if (activeEditor) {
              if (translator === undefined) {
                translator = await new Translator().setup(context, browser, activeEditor, reportProgress, closeListener);
              } else {
                vscode.window.showErrorMessage('Translon is used in the other document.');
              }
            } else {
              //Editor was closed while loading translator
              vscode.window.showErrorMessage('No active editor found');
            }
          }
        );
      }else {
        vscode.window.showErrorMessage('No active editor found');
      }
    } catch(err) {
      console.error(err);
      vscode.window.showErrorMessage('Failed to launch browser');
    }
	});
  context.subscriptions.push(disposable);
}

export function deactivate() {
  browser.close();
}