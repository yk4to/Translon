import * as vscode from 'vscode';
import { ChromiumBrowser, Page } from 'playwright-core';

export default class Translator {

  page: Page | undefined;
  document: vscode.TextDocument | undefined;
  editor: vscode.TextEditor | undefined;

  async setup(context: vscode.ExtensionContext, browser: ChromiumBrowser, editor: vscode.TextEditor, reportProgress: Function, closeListener: Function) {
    const t = this;
    reportProgress('Creating new instance...');
    //Create TextDocument
    vscode.workspace.openTextDocument({ language: editor.document.languageId })
    .then( doc => {
        t.document = doc;
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
        .then( editor => {
          t.editor = editor;
        });
    });

    //Create New Page
    reportProgress('Creating new tab...');
    t.page = await browser.newPage();
    //Set Events
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri === t.document?.uri) {
        t.destroy(closeListener);
      }
    });
    t.page.on('close',() => {
      t.destroy(closeListener);
    });

    //Load Website
    reportProgress('Loading website...');
    let url = 'https://www.deepl.com/translator';
    await t.page.goto(url);

    //Set Observers
    t.setTargetObserver(t.page);
    t.setSourceObserver(t.page, context);

    //Set Initial Content
    t.setIntialContent(editor, t.page);

    return t;
  }

  private async setTargetObserver(page: Page) {
    const targetListener = (content: string) => {
      const e = this.editor;
      if (e) {
        e.edit(editBuilder => {
          var firstLine = e.document.lineAt(0);
          var lastLine = e.document.lineAt(e.document.lineCount - 1);
          var textRange = new vscode.Range(0,
            firstLine.range.start.character,
            e.document.lineCount - 1,
            lastLine.range.end.character
          ); 
          editBuilder.replace(textRange, content);
        });
      }
    };
    page.exposeFunction('targetListener', targetListener);
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
    await page.fill('.lmt__source_textarea', text);
  }

  private setIntialContent(editor: vscode.TextEditor, page: Page) {
    const text = editor?.document.getText();
    this.setText(page, text);
  }

  private destroy(closeListener: Function) {
    this.page?.close();
    closeListener();
  }
} 