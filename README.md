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
```

## Backend (development)

1. Install dependencies

```bash
cd backend
npm install
```

2. Run in development with nodemon

```bash
npm run dev
```

3. Or run production server

```bash
npm start
```

The backend expects `server.js` at `backend/server.js`. If it's missing, create a simple Express server:

```js
// backend/server.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({status: 'ok'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
```

⭐️FEATURES
- 🔤 Random word selection
- ⌨️ On-screen / keyboard guessing
- ❌ Wrong-guess counter
- 🎨 Basic hangman drawing logic
- 🏆 Win/loss detection

🚀 Future Improvements 
- 🔧 Difficulty modes
- 🧮 High score / stats tracking
- 🌍 Backend-connected word lists
- 🎵 Sound effects
- 🖥️ UI redesign

🙏 Author 
Developed by Jordan Tisdol
