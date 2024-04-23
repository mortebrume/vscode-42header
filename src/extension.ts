
      /*#######.
     ########",#:
   #########',##".
  ##'##'## .##',##.
   ## ## ## # ##",#.
    ## ## ## ## ##'
     ## ## ## :##
      ## ## ##*/

import { basename } from 'path'
import vscode = require('vscode')
import dayjs from 'dayjs'

import {
  ExtensionContext, TextEdit, TextEditorEdit, TextDocument, Position, Range
} from 'vscode'

import {
  extractHeader, getHeaderInfo, renderHeader,
  supportsLanguage, HeaderInfo
} from './header'
import { isNullOrUndefined } from 'util'

let headerStatus: vscode.StatusBarItem;
let headerInsertStatus: vscode.StatusBarItem;

let headerStatusState: boolean;

let ignoreSet: string[]

/**
 * Return current user from config or ENV by default
 */
const getCurrentUser = () =>
  vscode.workspace.getConfiguration()
    .get('42header.username') || process.env['USER'] || 'marvin'

/**
 * Return current user mail from config or default value
 */
const getCurrentUserMail = () =>
  vscode.workspace.getConfiguration()
    .get('42header.email') || renderUserMail(getCurrentUser() as string)

const renderUserMail = (user: string) => `${user}@student.42.fr`

/**
 * Update HeaderInfo with last update author and date, and update filename
 * Returns a fresh new HeaderInfo if none was passed
 */
const newHeaderInfo = (document: TextDocument, headerInfo?: HeaderInfo) => {
  const keepAuthor = vscode.workspace.getConfiguration().get('42header.keepAuthor');

  var user = getCurrentUser();
  var mail = getCurrentUserMail();
  if (keepAuthor && !isNullOrUndefined(headerInfo))
  {
    var authorInfo = headerInfo.author.split(' ')
    user = authorInfo[0].trim();
    mail = authorInfo[1].replace('<','').replace('>','');
  }
  return Object.assign({},
    // This will be overwritten if headerInfo is not null
    {
      createdAt: dayjs(),
      createdBy: user
    },
    headerInfo,
    {
      filename: basename(document.fileName),
      author: `${user} <${mail}>`,
      updatedBy: getCurrentUser(),
      updatedAt: dayjs()
    }
  )
}

/**
 * `insertHeader` Command Handler
 */
const insertHeaderHandler = () => {
  const { activeTextEditor } = vscode.window
  if (!activeTextEditor)
    return;
  const { document } = activeTextEditor
  headerInsertStatus.hide();
  if (supportsLanguage(document.languageId))
    activeTextEditor.edit(editor => {
      const currentHeader = extractHeader(document.getText())

      if (currentHeader)
        editor.replace(
          new Range(0, 0, 11, 0),
          renderHeader(
            document.languageId,
            newHeaderInfo(document, getHeaderInfo(currentHeader))
          )
        )
      else
        editor.insert(
          new Position(0, 0),
          renderHeader(
            document.languageId,
            newHeaderInfo(document)
          )
        )
    })
  else
    vscode.window.showInformationMessage(
      `No header support for language ${document.languageId}`
    )
}

/**
 * Start watcher for document save to update current header
 */
const startUpdateOnSaveWatcher = (subscriptions: vscode.Disposable[]) =>
  vscode.workspace.onWillSaveTextDocument(event => {
    const document = event.document
    const currentHeader = extractHeader(document.getText())

    event.waitUntil(
      Promise.resolve(
        headerStatusState && supportsLanguage(document.languageId) && currentHeader ?
          [
            TextEdit.replace(
              new Range(0, 0, 11, 0),
              renderHeader(
                document.languageId,
                newHeaderInfo(document, getHeaderInfo(currentHeader))
              )
            )
          ]
          : [] // No TextEdit to apply
      )
    )
  },
    null, subscriptions
  )


export const activate = (context: vscode.ExtensionContext) => {
  const cmdHeaderUpdate = '42header.toggleAutoUpdate'
  const cmdHeaderInsert = '42header.insertHeader'

  const disposable = vscode.commands
    .registerTextEditorCommand(cmdHeaderInsert, insertHeaderHandler)

	context.subscriptions.push(vscode.commands.registerCommand(cmdHeaderUpdate, () => {
    const activeEditor = vscode.window.activeTextEditor
    headerStatusState = !headerStatusState
    if(activeEditor)
      headerStatus.show()
    else
      headerStatus.hide()
    updateHeaderStatuses()
	}));

  headerStatusState = true

  headerStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  headerStatus.command = cmdHeaderUpdate;
  
  headerInsertStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  headerInsertStatus.command = cmdHeaderInsert
  headerInsertStatus.text = "42 Header: Insert"
  headerInsertStatus.color = new vscode.ThemeColor("terminal.ansiBrightBlue")
  
  updateHeaderStatuses()
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => { 
    updateHeaderStatuses() 
  }));
  context.subscriptions.push(headerStatus)
  context.subscriptions.push(headerInsertStatus)
  context.subscriptions.push(disposable)
  startUpdateOnSaveWatcher(context.subscriptions)
}

function updateHeaderStatus(): void
{
    const enable = headerStatusState
    headerStatus.text = `42 Header: ${enable? "Enabled" : "Disabled"}`
    headerStatus.color = new vscode.ThemeColor(enable ? "terminal.ansiBrightGreen" : "terminal.ansiBrightRed")
}

function updateHeaderStatuses(): void
{
  const activeEditor = vscode.window.activeTextEditor
  if(activeEditor){
    headerStatus.show()
    const currentHeader = extractHeader(activeEditor.document.getText())
    if (supportsLanguage(activeEditor.document.languageId) && !currentHeader)
      headerInsertStatus.show()
    else
      headerInsertStatus.hide()
    updateHeaderStatus()
  }
  else
  {
    headerStatus.hide()
    headerInsertStatus.hide()
  }
}