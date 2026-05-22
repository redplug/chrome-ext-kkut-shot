# GitHub Publishing Guide

This repository should be pushed to GitHub so `data/answers.json` can be fetched by the Chrome extension.

## 1. Create the GitHub Repository

Create an empty GitHub repository, for example:

```text
https://github.com/<owner>/chrome-ext-kkut-shot
```

Do not initialize it with a README if this local repository already has one.

## 2. Push From the Development Mac

From this repository:

```bash
git init
git add .
git commit -m "Initial Kkut Shot prototype"
git branch -M main
git remote add origin git@github.com:<owner>/chrome-ext-kkut-shot.git
git push -u origin main
```

If you use HTTPS instead of SSH, replace the remote URL with:

```bash
https://github.com/<owner>/chrome-ext-kkut-shot.git
```

## 3. Choose the Data URL

The easiest URL for the extension is the raw GitHub file:

```text
https://raw.githubusercontent.com/<owner>/chrome-ext-kkut-shot/main/data/answers.json
```

You can also enable GitHub Pages and use:

```text
https://<owner>.github.io/chrome-ext-kkut-shot/data/answers.json
```

Enter this URL in the extension popup on each browser that uses Kkut Shot.
