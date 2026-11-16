# CodeContext Web

<details open>
<summary><b>English</b></summary>

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
</details>

<details>
<summary><b>Русский</b></summary>

Веб-приложение для подготовки кодовой базы к отправке в LLM (GPT-4o, Claude, DeepSeek и др.). Индексирует проект, очищает код от лишних данных, удаляет мусорные файлы и пакует выбранные исходники в структурированный XML или TXT с подсчётом токенов.

👉 **[Открыть приложение онлайн](https://cognidevs.github.io/codecontext-web/)**

Работает полностью на стороне клиента: файлы не загружаются на сервер, весь парсинг и анализ выполняются локально в браузере через WebAssembly-модуль на Rust.

---

## Функционал

- **Сканирование проектов:** открытие директорий через File System Access API или Drag & Drop, построение дерева файлов с сохранением структуры.
- **Поддержка .gitignore:** парсинг правил `.gitignore` с возможностью интерактивно включать и отключать конкретные паттерны в настройках.
- **Фильтрация мусора:** автоматический пропуск бинарных файлов (изображения, архивы, медиа, бинарники) и лок-файлов (`package-lock.json`, `Cargo.lock` и др.).
- **Скелетонизация кода (AST):** замена тел функций и методов на `...` с сохранением интерфейсов и сигнатур (на базе Tree-sitter).
- **Очистка комментариев:** удаление однострочных и многострочных комментариев без повреждения строковых литералов.
- **Маскирование секретов:** поиск и вырезание API-ключей, токенов, приватных ключей и паролей (включая проверку энтропии по Шеннону).
- **Точный подсчёт токенов:** расчёт BPE-токенов по словарю `cl100k_base` (tiktoken) прямо в браузере.
- **Трассировка импортов:** определение связанных локальных файлов для выбранного исходника (Python, TypeScript, JavaScript, C/C++, Rust).
- **Экспорт:** копирование контекста в буфер обмена или сохранение в файл (`.xml` / `.txt`), а также отдельный экспорт только структуры каталогов (ASCII-дерево).
- **Конструктор системных промптов:** настройка ролей и правил генерации кода с разметкой по XML-тегам.

---

## Режимы работы

1. **Web (Serverless):** работает онлайн на GitHub Pages. Все вычислительные операции выполняет WebAssembly-ядро (`codecontext-core`).
2. **Desktop (в связке с `codecontext-desktop`):** при работе внутри десктопного WebView автоматически переключается на локальный Rust-сервер (`/api/*`), получая доступ к файловой системе без ограничений браузера, нативному выбору папок и Git Diff.

---

## Локальный запуск

### Требования
- Node.js 22+
- npm 10+

### Установка и старт
```bash
# Установка зависимостей
npm ci

# Запуск dev-сервера (http://localhost:4200)
npm start

# Сборка production-версии
npm run build
```

*Примечание:* для работы офлайн-парсинга в веб-режиме файлы `codecontext_core.js` и `codecontext_core_bg.wasm` должны находиться в `public/assets/wasm/` (в CI они подтягиваются автоматически из релизов `codecontext-core`).
</details>
