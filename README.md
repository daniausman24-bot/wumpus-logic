# Wumpus Logic Agent

A Knowledge-Based Agent navigating a Wumpus World using **Propositional Logic and Resolution Refutation**.

## Links
- **Live Demo:** https://wumpus-logic.vercel.app/
- **GitHub:** https://github.com/daniausman24-bot/wumpus-logic

##  Structure
- `index.html` — Web UI structure
- `style.css` — Dark cyberpunk theme
- `app.js` — Resolution Engine + Game Logic (JavaScript)

##  Run Web App
Open https://wumpus-logic.vercel.app/ directly in any browser.

## How It Works
1. Agent starts at (0,0)
2. Perceives Breeze/Stench from adjacent cells
3. TELLs the Knowledge Base new logical clauses in CNF
4. Uses Resolution Refutation to ASK if neighbors are safe
5. Moves to proven-safe cells first, risks unknown only if stuck

## Tech Stack
- HTML, CSS, JavaScript (Frontend + Inference Engine)
- Deployed on Vercel

