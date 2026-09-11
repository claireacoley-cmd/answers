#!/bin/bash
cd "$(dirname "$0")"
git init -b main 2>/dev/null || git init
git add -A
git commit -m "Answers CMS: question bank v2, MVP prioritisation" -q
git remote remove origin 2>/dev/null
git remote add origin https://github.com/claireacoley-cmd/answers.git
echo "When asked: Username = claireacoley-cmd, Password = paste your GitHub token"
git push -u origin main
echo; echo "Done. Press any key to close."; read -n 1
