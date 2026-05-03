// ════════════════════════════════════════════════════
//  WUMPUS LOGIC AGENT  —  app.js
//  Knowledge Base + CNF Resolution + UI
// ════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────
let ROWS = 4, COLS = 4, NUM_PITS = 3;
let grid = [];
let agentRow, agentCol;
let visited    = new Set();
let safeCells  = new Set();
let frontier   = new Set();
let KB         = [];
let inferenceSteps = 0;
let gameOver   = false;
let autoTimer  = null;
let wumpusPos  = null;

// ── Helpers ───────────────────────────────────────────
const key   = (r,c) => `${r},${c}`;
const unkey = k => k.split(',').map(Number);

function neighbors(r, c) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr,nc]) => nr>=0 && nr<ROWS && nc>=0 && nc<COLS);
}

// ── Grid Initialisation ───────────────────────────────
function initWorld() {
  ROWS     = parseInt(document.getElementById('rowsInput').value);
  COLS     = parseInt(document.getElementById('colsInput').value);
  NUM_PITS = parseInt(document.getElementById('pitsInput').value);

  grid       = Array.from({length:ROWS}, () => Array(COLS).fill('empty'));
  visited    = new Set();
  safeCells  = new Set();
  frontier   = new Set();
  KB         = [];
  inferenceSteps = 0;
  gameOver   = false;
  wumpusPos  = null;
  clearInterval(autoTimer);
  autoTimer  = null;

  // Place Wumpus (not at 0,0)
  let wr, wc;
  do { wr = randInt(ROWS); wc = randInt(COLS); }
  while (wr===0 && wc===0);
  grid[wr][wc] = 'wumpus';
  wumpusPos = [wr, wc];

  // Place Pits
  let placed = 0;
  while (placed < NUM_PITS) {
    const pr = randInt(ROWS), pc = randInt(COLS);
    if ((pr===0&&pc===0) || grid[pr][pc]!=='empty') continue;
    grid[pr][pc] = 'pit';
    placed++;
  }

  // Agent starts at (0,0)
  agentRow = 0; agentCol = 0;
  safeCells.add(key(0,0));
  visited.add(key(0,0));

  document.getElementById('stepBtn').disabled = false;
  document.getElementById('autoBtn').disabled = false;
  document.getElementById('autoBtn').textContent = '▶️ Auto Run';
  setHeaderStatus('RUNNING', true);
  setAgentStatus('🟢 Active', 'green');

  log('World initialised. Agent at (0,0).', 'info');
  perceiveAndUpdate();
  renderGrid();
  updateMetrics();
}

function randInt(n) { return Math.floor(Math.random() * n); }

// ── Percept Logic ─────────────────────────────────────
function getPercepts(r, c) {
  const p = [];
  for (const [nr,nc] of neighbors(r,c)) {
    if (grid[nr][nc] === 'pit')    p.push('Breeze');
    if (grid[nr][nc] === 'wumpus') p.push('Stench');
  }
  return [...new Set(p)];
}

// ── KNOWLEDGE BASE ────────────────────────────────────
function tellKB(r, c, percepts) {
  const nbrs = neighbors(r, c);

  if (!percepts.includes('Breeze')) {
    for (const [nr,nc] of nbrs) addClause([`NOT_P_${nr}_${nc}`]);
  } else {
    addClause(nbrs.map(([nr,nc]) => `P_${nr}_${nc}`));
  }

  if (!percepts.includes('Stench')) {
    for (const [nr,nc] of nbrs) addClause([`NOT_W_${nr}_${nc}`]);
  } else {
    addClause(nbrs.map(([nr,nc]) => `W_${nr}_${nc}`));
  }

  addClause([`NOT_P_${r}_${c}`]);
  addClause([`NOT_W_${r}_${c}`]);
}

function addClause(clause) {
  const str = JSON.stringify(clause.slice().sort());
  if (!KB.find(c => JSON.stringify(c.slice().sort()) === str)) {
    KB.push(clause);
  }
}

// ── RESOLUTION REFUTATION ─────────────────────────────
function resolve(literal) {
  const negated = negateLit(literal);
  const clauses = KB.map(c => [...c]);
  clauses.push([negated]);
  inferenceSteps++;

  let changed = true;
  while (changed) {
    changed = false;
    const n = clauses.length;
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const resolvents = resolvePair(clauses[i], clauses[j]);
        for (const r of resolvents) {
          inferenceSteps++;
          if (r.length === 0) return true;
          if (!clauseExists(clauses, r)) {
            clauses.push(r);
            changed = true;
          }
        }
      }
    }
  }
  return false;
}

function negateLit(lit) {
  return lit.startsWith('NOT_') ? lit.slice(4) : 'NOT_' + lit;
}

function resolvePair(c1, c2) {
  const results = [];
  for (const lit of c1) {
    const neg = negateLit(lit);
    if (c2.includes(neg)) {
      const resolvent = [...new Set([
        ...c1.filter(l => l !== lit),
        ...c2.filter(l => l !== neg)
      ])];
      results.push(resolvent);
    }
  }
  return results;
}

function clauseExists(clauses, clause) {
  const str = JSON.stringify(clause.slice().sort());
  return clauses.some(c => JSON.stringify(c.slice().sort()) === str);
}

function isSafe(r, c) {
  return resolve(`NOT_P_${r}_${c}`) && resolve(`NOT_W_${r}_${c}`);
}

// ── Perceive + Update ─────────────────────────────────
function perceiveAndUpdate() {
  const percepts = getPercepts(agentRow, agentCol);
  tellKB(agentRow, agentCol, percepts);

  // Percept display — styled tags
  const pb = document.getElementById('perceptBox');
  if (percepts.length === 0) {
    pb.innerHTML = '<span style="color:var(--text-muted);font-size:0.68rem">None — All clear!</span>';
  } else {
    pb.innerHTML = percepts.map(p => {
      const icon = p === 'Breeze' ? '💨' : '🤢';
      return `<span class="percept-tag">${icon} ${p}</span>`;
    }).join('');
  }

  // KB display
  const kbBox = document.getElementById('kbBox');
  if (KB.length === 0) {
    kbBox.textContent = '— Empty —';
  } else {
    kbBox.textContent = KB.map(c => '[' + c.join(' ∨ ') + ']').join('\n');
  }

  // Infer safe frontier neighbors
  for (const [nr,nc] of neighbors(agentRow, agentCol)) {
    const k = key(nr,nc);
    if (!visited.has(k)) {
      if (isSafe(nr, nc)) {
        safeCells.add(k);
        frontier.add(k);
        log(`Proved safe: (${nr},${nc})`, 'info');
      }
    }
  }
}

// ── Agent Step ────────────────────────────────────────
function stepAgent() {
  if (gameOver) return;

  const cell = grid[agentRow][agentCol];
  if (cell === 'pit') {
    log(`Fell into pit at (${agentRow},${agentCol})!`, 'error');
    gameOver = true;
    setAgentStatus('💀 Dead (Pit)', 'red');
    setHeaderStatus('DEAD', false);
    document.getElementById('status-bar').textContent = '💀 Agent fell into a pit! Game Over.';
    clearInterval(autoTimer);
    renderGrid(); updateMetrics(); return;
  }
  if (cell === 'wumpus') {
    log(`Eaten by Wumpus at (${agentRow},${agentCol})!`, 'error');
    gameOver = true;
    setAgentStatus('💀 Dead (Wumpus)', 'red');
    setHeaderStatus('DEAD', false);
    document.getElementById('status-bar').textContent = '💀 Eaten by the Wumpus! Game Over.';
    clearInterval(autoTimer);
    renderGrid(); updateMetrics(); return;
  }

  const safeMoves   = [];
  const unknownMoves = [];

  for (const [nr,nc] of neighbors(agentRow, agentCol)) {
    const k = key(nr,nc);
    if (visited.has(k)) continue;
    if (safeCells.has(k)) safeMoves.push([nr,nc]);
    else unknownMoves.push([nr,nc]);
  }

  let nextR, nextC;
  if (safeMoves.length > 0) {
    [nextR, nextC] = safeMoves[0];
    log(`Moving safely → (${nextR},${nextC})`, 'info');
  } else if (unknownMoves.length > 0) {
    const newlySafe = unknownMoves.filter(([r,c]) => isSafe(r,c));
    if (newlySafe.length > 0) {
      [nextR, nextC] = newlySafe[0];
      safeCells.add(key(nextR,nextC));
      log(`Inferred safe on demand: (${nextR},${nextC})`, 'info');
    } else {
      [nextR, nextC] = unknownMoves[Math.floor(Math.random()*unknownMoves.length)];
      log(`⚠ No safe move — risking (${nextR},${nextC})`, 'warn');
    }
  } else {
    const back = neighbors(agentRow, agentCol).filter(([r,c]) => visited.has(key(r,c)));
    if (back.length > 0) {
      [nextR, nextC] = back[0];
      log(`Backtracking → (${nextR},${nextC})`, 'warn');
    } else {
      log('No moves available. Stuck.', 'warn');
      gameOver = true;
      clearInterval(autoTimer);
      return;
    }
  }

  agentRow = nextR; agentCol = nextC;
  const k = key(nextR, nextC);
  visited.add(k);
  frontier.delete(k);
  safeCells.add(k);

  perceiveAndUpdate();
  renderGrid();
  updateMetrics();

  const p = getPercepts(agentRow, agentCol);
  document.getElementById('status-bar').textContent =
    `Agent at (${agentRow},${agentCol}) · Percepts: ${p.join(', ') || 'None'} · Steps: ${inferenceSteps}`;
}

// ── Auto Run ──────────────────────────────────────────
function toggleAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    document.getElementById('autoBtn').textContent = '▶️ Auto Run';
  } else {
    document.getElementById('autoBtn').textContent = '⏸ Pause';
    autoTimer = setInterval(() => {
      if (gameOver) { clearInterval(autoTimer); return; }
      stepAgent();
    }, 650);
  }
}

// ── Render Grid ───────────────────────────────────────
function renderGrid() {
  const container = document.getElementById('grid-container');
  container.style.gridTemplateColumns = `repeat(${COLS}, 84px)`;
  container.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const k = key(r,c);

      const coord = document.createElement('span');
      coord.className = 'coord';
      coord.textContent = `${r},${c}`;
      cell.appendChild(coord);

      let emoji = '';

      if (r===agentRow && c===agentCol) {
        cell.classList.add('agent');
        emoji = '🤖';
      } else if (visited.has(k)) {
        cell.classList.add('visited');
        if (grid[r][c]==='pit')    { cell.classList.add('pit');    emoji='🕳️'; }
        if (grid[r][c]==='wumpus') { cell.classList.add('wumpus'); emoji='👹'; }
      } else if (safeCells.has(k)) {
        cell.classList.add('safe');
        emoji = '✅';
      } else if (frontier.has(k)) {
        cell.classList.add('frontier');
        emoji = '❓';
      } else {
        cell.classList.add('unknown');
      }

      // Reveal all hazards on game over
      if (gameOver) {
        if (grid[r][c]==='pit' && r!==agentRow || c!==agentCol) {
          cell.className = 'cell pit'; emoji = '🕳️';
        }
        if (grid[r][c]==='wumpus' && (r!==agentRow || c!==agentCol)) {
          cell.className = 'cell wumpus'; emoji = '👹';
        }
      }

      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = emoji;
      cell.appendChild(emojiSpan);

      // Percept icons on visited cells
      if (visited.has(k)) {
        const p = getPercepts(r,c);
        if (p.length) {
          const pi = document.createElement('span');
          pi.className = 'percept-icons';
          pi.textContent = p.map(x => x==='Breeze'?'💨':'🤢').join('');
          cell.appendChild(pi);
        }
      }

      container.appendChild(cell);
    }
  }
}

// ── Metrics ───────────────────────────────────────────
function updateMetrics() {
  document.getElementById('inferenceCount').textContent = inferenceSteps;
  document.getElementById('visitedCount').textContent   = visited.size;
  document.getElementById('safeCount').textContent      = safeCells.size;
  document.getElementById('kbCount').textContent        = KB.length;
}

function setAgentStatus(text, color) {
  document.getElementById('agentStatus').textContent = text;
  const box = document.getElementById('statusBox');
  box.className = `metric-box full ${color}`;
}

function setHeaderStatus(text, alive) {
  document.getElementById('headerStatus').textContent = text;
  const pulse = document.getElementById('statusPulse');
  pulse.style.background = alive ? 'var(--accent-green)' : 'var(--accent-red)';
  pulse.style.boxShadow  = alive
    ? '0 0 8px var(--accent-green)'
    : '0 0 8px var(--accent-red)';
}

// ── Log ───────────────────────────────────────────────
function log(msg, type='') {
  const box = document.getElementById('logBox');
  const entry = document.createElement('div');
  entry.className = `log-entry${type ? ' log-'+type : ''}`;
  entry.textContent = `› ${msg}`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

// ── Button Wiring ─────────────────────────────────────
document.getElementById('initBtn').addEventListener('click', initWorld);
document.getElementById('stepBtn').addEventListener('click', stepAgent);
document.getElementById('autoBtn').addEventListener('click', toggleAuto);
document.getElementById('resetBtn').addEventListener('click', () => {
  clearInterval(autoTimer);
  autoTimer = null;
  document.getElementById('grid-container').innerHTML = '';
  document.getElementById('status-bar').textContent   = '🟡 Set parameters and click Initialize World to begin.';
  document.getElementById('perceptBox').innerHTML     = '<span style="color:var(--text-muted);font-size:0.68rem">None detected</span>';
  document.getElementById('kbBox').textContent        = '— Empty —';
  document.getElementById('logBox').innerHTML         = '';
  document.getElementById('inferenceCount').textContent = '0';
  document.getElementById('visitedCount').textContent   = '0';
  document.getElementById('safeCount').textContent      = '0';
  document.getElementById('kbCount').textContent        = '0';
  document.getElementById('stepBtn').disabled = true;
  document.getElementById('autoBtn').disabled = true;
  document.getElementById('autoBtn').textContent = '▶️ Auto Run';
  setAgentStatus('Idle', 'red');
  setHeaderStatus('IDLE', true);
});