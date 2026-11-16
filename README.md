<p align="right">
  <b>English</b> | <a href="README.ru.md">Русский</a>
</p>

# CodeContext Web

Web application for preparing codebases for Large Language Models (GPT-4o, Claude, DeepSeek, Gemini). Indexes project files, cleans source code of comments and secrets, filters build artifacts, and packages selected sources into structured XML or TXT with accurate token counts.

👉 **[Open Live Web App](https://cognidevs.github.io/codecontext-web/)**

Operates entirely client-side: files are never uploaded to an external server. Parsing and AST analysis run locally in the browser via a WebAssembly engine compiled from Rust.

---

## Features

- **Project Scanning**: Open folders via File System Access API or Drag & Drop while preserving directory hierarchy.
- **.gitignore Integration**: Parses `.gitignore` patterns with interactive toggling for individual rules.
- **Artifact Filtering**: Automatically excludes binary files (images, archives, executables) and lock files (`package-lock.json`, `Cargo.lock`).
- **AST Skeletonization**: Replaces function and method bodies with `...` while preserving interfaces, type signatures, and docstrings (via Tree-sitter).
- **Comment Stripping**: Removes single-line and multi-line comments without damaging string literals or templates.
- **Secret Sanitization**: Detects and redacts API keys, tokens, private keys, passwords, and connection strings with Shannon entropy analysis.
- **Accurate Token Counting**: BPE tokenization based on the `cl100k_base` vocabulary (`tiktoken`) executed client-side.
- **Import Tracing**: Analyzes and selects local dependencies for chosen source files (Python, TypeScript, JavaScript, C/C++, Rust).
- **Export Options**: Copy context to clipboard, save to file (`.xml` / `.txt`), or export standalone ASCII folder structure.
- **System Prompt Templates**: Custom skill roles and generation guidance formatted with structured XML tags.

---

## Operating Modes

1. **Web (Serverless)**: Runs in browser on GitHub Pages. Computational workload executed by WebAssembly (`codecontext-core`).
2. **Desktop (paired with `codecontext-desktop`)**: Automatically connects to local Rust backend (`/api/*`) when hosted inside desktop webview, gaining unconstrained filesystem access and Git diffing.

---

## Local Development

### Requirements
- Node.js 22+
- npm 10+

### Setup & Run
```bash
# Install dependencies
npm ci

# Start development server (http://localhost:4200)
npm start

# Build production bundle
npm run build
```
