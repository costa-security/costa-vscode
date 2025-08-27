# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension built with reactive-vscode framework. The extension is currently minimal, containing a basic "Hello" message on activation.

## Codebase Structure

- `src/` - Main source code
  - `index.ts` - Entry point with extension activation/deactivation
  - `config.ts` - Extension configuration using reactive-vscode
  - `utils.ts` - Utility functions with logger
  - `generated/meta.ts` - Auto-generated metadata from package.json
- `test/` - Test files using Vitest
- `res/` - Extension resources (icons)
- `dist/` - Built output files

## Architecture

The extension uses the reactive-vscode framework which provides:
1. Declarative extension definition with `defineExtension()`
2. Reactive configuration system with `defineConfigObject()`
3. Integrated logging with `useLogger()`
4. Automatic metadata generation from package.json

The extension follows a simple architecture where:
- Extension lifecycle is managed by reactive-vscode
- Configuration is defined in a type-safe manner
- Utilities are organized in separate modules

## Development Commands

- `npm run build` - Build the extension using tsdown
- `npm run dev` - Watch mode for development
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest
- `npm run typecheck` - TypeScript type checking
- `npm run update` - Regenerate extension metadata

## Testing

Tests use Vitest framework. Run with `npm run test`. The test setup is minimal with one example test.

## Build Process

Uses tsdown bundler for building. Output is in CommonJS format to `dist/` directory. The build excludes vscode as external dependency.

## Extension Publishing

- `npm run ext:package` - Package extension for VS Code Marketplace
- `npm run ext:publish` - Publish extension to Open VSX Registry
- `npm run release` - Bump version with bumpp
