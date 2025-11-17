# Hangman

Simple Hangman web game with a frontend and a small Node.js backend.

## Project structure

- `index.html` — frontend single page  
- `style.css` — frontend styles  
- `script.js` — frontend logic  
- `backend/` — small Express backend  
  - `package.json` — backend metadata and scripts  
  - `server.js` — backend server entrypoint  

## Prerequisites

- Node.js (v16+ recommended)
- npm (or yarn)

Optional tools:
- Homebrew or SDKMAN for managing Java if you need to work with Java projects

---

## Frontend (quick run)

Open `index.html` in your browser, or serve it with a static server (e.g., `npx http-server`):

```bash
# from project root
npx http-server -c-1 .
# then open http://localhost:8080
