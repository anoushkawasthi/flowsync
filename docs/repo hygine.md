## 1. Commit Messages (Non-Embarrassing Edition)

**Format**

`<type>: <short summary>`

**Good examples**

- `feat: add user login flow`
- `fix: prevent crash on empty input`
- `refactor: extract auth middleware`
- `docs: update setup instructions`
- `chore: bump eslint version`

**Rules**

- Present tense (“add”, not “added”)
- Be specific
- No emotional updates (`ugh`, `finally`, `pls`)

**If it needs “and” → too big**

---

## 2. Commit Size

**One commit = one logical change**

Good:

- Add feature
- Fix bug
- Refactor module
- Update docs

Bad:

- Feature + refactor + formatting + dependency update

If you can’t explain it in one sentence, split it.

---

## 3. Branch Naming

**Patterns**

`feature/short-description fix/bug-description refactor/module-name`

**Examples**

- `feature/login-form`
- `fix/navbar-overflow`
- `refactor/api-client`

Avoid:

- `test`
- `temp`
- `newnew`
- `final-real`

You are not naming Wi-Fi networks.

---

## 4. README (Minimum Viable Respect)

**Must include**

`# Project Name  Short description of what it does.  ## Tech Stack - Frameworks / languages  ## Setup 1. Clone 2. Install deps 3. Run app  ## Scripts - dev - test - build`

If someone can’t run it in 5 minutes, they won’t.

---

## 5. .gitignore (Stop Oversharing)

**Never commit**

- `node_modules`
- `.env`
- build artifacts
- OS/editor files (`.DS_Store`, `.vscode/`)

Use GitHub’s language-specific templates. They exist to save you from yourself.

---

## 6. History Hygiene

**Before pushing**

- Clean commit messages
- Squash noisy commits
- Reword garbage

**After pushing to shared branches**

- Do NOT rewrite history
- Avoid `--force` unless coordinated

Your teammates deserve stability, not surprises.

---

## 7. General Sanity Rules

- Default branch: `main`
- Keep PRs small
- Remove dead branches
- Tag meaningful releases
- Don’t commit commented-out code “just in case”

Git is not your diary.

---

## Mental Checklist Before Pushing

- Would another dev understand this?
- Does the history tell a clear story?
- Am I about to embarrass myself publicly?

If yes → fix it  
If no → push