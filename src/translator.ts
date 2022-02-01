import * as vscode from 'vscode';
import { ChromiumBrowser, Page } from 'playwright-core';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

type TranslatorMode = 'deepl' | 'google';

type TranslatorModeProperty = {
  [key in TranslatorMode]: string;
};

const names: TranslatorModeProperty = {
  "deepl": "DeepL Translator",
  "google": "Google Translate",
};

export default class Translator {

  page: Page | undefined;
  editorUri: vscode.Uri | undefined;
  panel: vscode.WebviewPanel | undefined;
  mode: TranslatorMode;
  uuid: string;

  constructor(mode: string) {
    this.mode = <TranslatorMode>mode;
    this.uuid = uuidv4();
  }

  async setup(context: vscode.ExtensionContext, browser: ChromiumBrowser, editor: vscode.TextEditor, reportProgress: Function, closeListener: Function) {
    const t = this;
    reportProgress('Creating new instance...');
    //Create Webview Panel
    t.panel = vscode.window.createWebviewPanel(
      'translate',
      `Translon (${names[t.mode]})`,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    //Load HTML File
    const htmlUri = vscode.Uri.file(context.extensionPath+'/src/webview.html');
    t.panel.webview.html = fs.readFileSync(htmlUri.fsPath, 'utf8');

    //Set Icons
    const lightIconUri = vscode.Uri.file(context.extensionPath+'/icons/light.svg');
    const darkIconUri = vscode.Uri.file(context.extensionPath+'/icons/dark.svg'); 
    t.panel.iconPath = { light: lightIconUri, dark: darkIconUri }; 

    //Create New Page
    reportProgress('Creating new tab...');
    t.page = await browser.newPage();
    t.editorUri = editor?.document.uri;
    //Set Events
    t.panel?.onDidDispose(() => {
      t.destroy(closeListener);
    });
    t.page.on('close',() => {
      t.destroy(closeListener);
    });
    t.panel?.onDidChangeViewState(()=>{
      if (editor && t.page && t.panel) {
        t.setIntialContent(editor, t.page, t.panel);
      } else {
        t.destroy(closeListener);
      }
    });

    //Load Website
    reportProgress('Loading website...');
    let url = t.getUrl(t.mode);
    await t.page.goto(url);

    //Set Observers
    t.setTargetObserver(t.page, t.panel);
    t.setSourceObserver(t.page, context);

    //Set Initial Content
    t.setIntialContent(editor, t.page, t.panel);

    return t;
  }

  private getUrl(mode: TranslatorMode) {
    switch (mode) {
      case 'deepl':
        return 'https://www.deepl.com/translator';
      case 'google':
        return 'https://translate.google.com/';
    }
  }

  private async setTargetObserver(page: Page, panel: vscode.WebviewPanel) {
    const targetListener = (content: string) => {
      panel.webview.postMessage({ key: 'setContent', content });
    };
    page.exposeFunction('targetListener', targetListener);
    switch (this.mode) {
      case 'deepl': {
        const target = page.locator('#target-dummydiv');
        await target.evaluate((target) => {
          // @ts-ignore
          const observer = new MutationObserver(() => {
            // @ts-ignore
            const textarea = document.getElementsByClassName('lmt__target_textarea')[0];
            // @ts-ignore
            window.targetListener(textarea.value);
          });
          observer.observe(
            target,
            { childList: true },
          );
        });
        break;
      }
      case 'google': //NOT WORKING!!
        //const target = page.locator('.J0lOec');
        // @ts-ignore
        await page.evaluate(() =>{
          // @ts-ignore
          const target = page.getElementsByClassName('.J0lOec')[0];
          console.log(target);
          // @ts-ignore
          const observer = new MutationObserver(() => {
            console.log('he');
            // @ts-ignore
            const textarea = document.querySelector('.KHxj8b.tL9Q4c');
            // @ts-ignore
            window.targetListener(textarea.value);
            /*for (const mutation in mutations) {
              // @ts-ignore
              window.targetListener(mutation.target.innerText);
              // @ts-ignore
              console.log(mutation.target.innerText);
            }*/
          });
          observer.observe(
            target,
            { childList: true, subtree: true },
          );
        });
        break;
    }
  }

  private setSourceObserver(page: Page, context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      let activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        const text = event.document.getText();
        this.setText(page, text);
      }
    }, null, context.subscriptions);
  }

  private async setText(page: Page, text: string) {
    console.log(text);
    switch (this.mode) {
      case 'deepl':
        await page.fill('.lmt__source_textarea', text);
        break;
      case 'google':
        await page.fill('.er8xn', text);
        break;
    }
  }

  private setIntialContent(editor: vscode.TextEditor, page: Page, panel: vscode.WebviewPanel) {
    //Set Mode to Panel
    panel.webview.postMessage({ key: 'setMode', mode: <string>this.mode, name: names[this.mode] });
    const text = editor?.document.getText();
    this.setText(page, text);
  }

  private destroy(closeListener: Function) {
    this.page?.close();
    this.panel?.dispose();
    closeListener(this.uuid);
  }
} 