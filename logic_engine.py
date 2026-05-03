# ════════════════════════════════════════════════════
#  Wumpus Logic Agent — Python Resolution Engine
#  Run: python logic_engine.py
# ════════════════════════════════════════════════════

import random
import copy

ROWS, COLS = 4, 4
NUM_PITS   = 3

# ── Helpers ───────────────────────────────────────────
def key(r, c): return (r, c)

def neighbors(r, c):
    return [(r+dr, c+dc) for dr,dc in [(-1,0),(1,0),(0,-1),(0,1)]
            if 0<=r+dr<ROWS and 0<=c+dc<COLS]

# ── Knowledge Base ────────────────────────────────────
class WumpusKB:
    def __init__(self):
        self.clauses = []
        self.inference_steps = 0

    def tell(self, clause):
        s = tuple(sorted(clause))
        if s not in [tuple(sorted(c)) for c in self.clauses]:
            self.clauses.append(list(clause))

    def negate(self, lit):
        return lit[4:] if lit.startswith('NOT_') else 'NOT_' + lit

    def resolve_pair(self, c1, c2):
        results = []
        for lit in c1:
            neg = self.negate(lit)
            if neg in c2:
                resolvent = list(set(
                    [l for l in c1 if l != lit] +
                    [l for l in c2 if l != neg]
                ))
                results.append(resolvent)
        return results

    def ask(self, literal):
        """Resolution Refutation: prove literal from KB."""
        negated = self.negate(literal)
        clauses = [list(c) for c in self.clauses]
        clauses.append([negated])
        self.inference_steps += 1

        changed = True
        while changed:
            changed = False
            n = len(clauses)
            for i in range(n):
                for j in range(i+1, n):
                    for r in self.resolve_pair(clauses[i], clauses[j]):
                        self.inference_steps += 1
                        if len(r) == 0:
                            return True   # Contradiction → proved
                        s = tuple(sorted(r))
                        if s not in [tuple(sorted(c)) for c in clauses]:
                            clauses.append(r)
                            changed = True
        return False

    def is_safe(self, r, c):
        return (self.ask(f'NOT_P_{r}_{c}') and
                self.ask(f'NOT_W_{r}_{c}'))

# ── Percept Generator ─────────────────────────────────
def get_percepts(grid, r, c):
    percepts = set()
    for nr, nc in neighbors(r, c):
        if grid[nr][nc] == 'pit':    percepts.add('Breeze')
        if grid[nr][nc] == 'wumpus': percepts.add('Stench')
    return list(percepts)

# ── Tell KB from percepts ─────────────────────────────
def tell_kb(kb, r, c, percepts):
    nbrs = neighbors(r, c)
    if 'Breeze' not in percepts:
        for nr, nc in nbrs:
            kb.tell([f'NOT_P_{nr}_{nc}'])
    else:
        kb.tell([f'P_{nr}_{nc}' for nr, nc in nbrs])

    if 'Stench' not in percepts:
        for nr, nc in nbrs:
            kb.tell([f'NOT_W_{nr}_{nc}'])
    else:
        kb.tell([f'W_{nr}_{nc}' for nr, nc in nbrs])

    kb.tell([f'NOT_P_{r}_{c}'])
    kb.tell([f'NOT_W_{r}_{c}'])

# ── World Setup ───────────────────────────────────────
def init_world():
    grid = [['empty']*COLS for _ in range(ROWS)]
    while True:
        wr, wc = random.randint(0,ROWS-1), random.randint(0,COLS-1)
        if not (wr==0 and wc==0): break
    grid[wr][wc] = 'wumpus'

    placed = 0
    while placed < NUM_PITS:
        pr, pc = random.randint(0,ROWS-1), random.randint(0,COLS-1)
        if (pr==0 and pc==0) or grid[pr][pc] != 'empty': continue
        grid[pr][pc] = 'pit'
        placed += 1
    return grid

# ── Agent ─────────────────────────────────────────────
def run_agent():
    grid    = init_world()
    kb      = WumpusKB()
    visited = set()
    safe    = set()
    ar, ac  = 0, 0
    visited.add((0,0))
    safe.add((0,0))
    steps   = 0

    print("═"*40)
    print("  WUMPUS LOGIC AGENT — Python Demo")
    print("═"*40)

    while True:
        cell = grid[ar][ac]
        percepts = get_percepts(grid, ar, ac)
        tell_kb(kb, ar, ac, percepts)
        steps += 1

        print(f"\nStep {steps} | Agent at ({ar},{ac})")
        print(f"  Percepts : {percepts or ['None']}")
        print(f"  KB size  : {len(kb.clauses)} clauses")
        print(f"  Infer.   : {kb.inference_steps} steps")

        if cell == 'pit':
            print("  ❌ Fell into a pit! GAME OVER.")
            break
        if cell == 'wumpus':
            print("  ❌ Eaten by Wumpus! GAME OVER.")
            break

        # Find next move
        safe_moves   = []
        unknown_moves = []
        for nr, nc in neighbors(ar, ac):
            if (nr,nc) in visited: continue
            if kb.is_safe(nr, nc):
                safe.add((nr,nc))
                safe_moves.append((nr,nc))
            else:
                unknown_moves.append((nr,nc))

        if safe_moves:
            ar, ac = safe_moves[0]
            print(f"  ✅ Moving safely to ({ar},{ac})")
        elif unknown_moves:
            ar, ac = random.choice(unknown_moves)
            print(f"  ⚠️  No safe move — risking ({ar},{ac})")
        else:
            back = [n for n in neighbors(ar,ac) if n in visited]
            if back:
                ar, ac = back[0]
                print(f"  🔙 Backtracking to ({ar},{ac})")
            else:
                print("  🛑 Agent stuck. No moves.")
                break

        visited.add((ar,ac))

        if steps >= ROWS*COLS*2:
            print("\n  🏁 Max steps reached.")
            break

    print(f"\nTotal Inference Steps: {kb.inference_steps}")

if __name__ == '__main__':
    run_agent()