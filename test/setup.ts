import { vi } from 'vitest'

// Mock the vscode module
vi.mock('vscode', () => {
  return {
    env: {
      openExternal: vi.fn().mockResolvedValue(true),
    },
    Uri: {
      parse: vi.fn().mockImplementation((uri: string) => ({
        toString: () => uri,
        query: uri.split('?')[1] || '',
        path: new URL(uri, 'http://localhost').pathname,
      })),
    },
    window: {
      showInformationMessage: vi.fn().mockResolvedValue(undefined),
      showErrorMessage: vi.fn().mockResolvedValue(undefined),
      createOutputChannel: vi.fn().mockReturnValue({
        appendLine: vi.fn(),
        show: vi.fn(),
      }),
      createStatusBarItem: vi.fn().mockReturnValue({
        text: '',
        tooltip: '',
        command: '',
        show: vi.fn(),
        dispose: vi.fn(),
        backgroundColor: undefined,
        color: undefined,
      }),
    },
    commands: {
      registerCommand: vi.fn().mockReturnValue({
        dispose: vi.fn(),
      }),
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
  }
})

// Mock the api module
vi.mock('../src/api', () => ({
  getOutputChannel: () => ({
    appendLine: vi.fn(),
  }),
}))

// Mock the config module
vi.mock('../src/config', () => ({
  config: {
    apiBaseUrl: 'https://ai.costa.app',
    oauth2: {
      clientId: 'test-client-id',
      redirectUri: 'vscode://costa.costa-code/callback',
    },
  },
}))
