# FlowSync

AI-powered context layer for AI-assisted development teams.

## Features

- **Project Initialization**: Create a new FlowSync project with `FlowSync: Initialize Project` command
- **Team Onboarding**: Share API token with teammates so they can join via `FlowSync: Join Project`
- **Automatic Context Capture**: Post-push git hook captures diffs and sends them to AWS backend
- **AI Extraction**: Nova Pro analyzes commits and extracts features, decisions, risks, and tasks
- **Vector Embeddings**: Titan embeddings generated for RAG queries
- **Multi-Developer Support**: Full team collaboration on the same project across multiple laptops

## How to Use

### For the Team Lead (Initializing a Project)

1. Open a new repo in VS Code
2. Press `Ctrl+Shift+P` and run **FlowSync: Initialize Project**
3. Fill in project details (name, description, languages, branch)
4. Your API token will be displayed — **copy it and share with your team**
5. Commit `.flowsync.json` and `.github/copilot-instructions.md` to the repo
6. Push to GitHub — your first event is captured automatically

### For Team Members (Joining a Project)

1. Clone the repo (it already has `.flowsync.json`)
2. VS Code will prompt you to join FlowSync
3. Run `FlowSync: Join Project` and paste the API token from your team lead
4. Your pushes are now automatically captured and sent to the backend

## Requirements

- VS Code 1.109 or later
- Git repository with `.git/hooks` support
- Network access to `https://86tzell2w9.execute-api.us-east-1.amazonaws.com` (for testing)

## Backend Integration

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
