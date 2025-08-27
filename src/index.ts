import { defineExtension } from 'reactive-vscode'
import { window } from 'vscode'

const { activate, deactivate } = defineExtension(() => {
  window.showInformationMessage("opening the pod bay doors...")
})

export { activate, deactivate }
