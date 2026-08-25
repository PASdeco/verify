# VERIFY

**Know what you're buying.**

VERIFY is a consumer-facing barcode verification app powered by a **GenLayer Intelligent Contract** deployed on **GenLayer StudioNet**.

Scan a product barcode → the backend relayer submits it to an Intelligent Contract → GenLayer validators independently investigate publicly available product information → consensus produces a verdict with evidence:

- **CONSISTENT** — the barcode and available product information agree across credible sources.
- **SUSPICIOUS** — meaningful conflicts exist in public product records.
- **INCONCLUSIVE** — insufficient reliable information to determine anything.

> VERIFY checks **information consistency and product identity**, not physical authenticity. A barcode is an identifier, not cryptographic proof that a physical item is genuine.

---

## Architecture

```
Phone camera / manual entry
        │
   Next.js frontend (web/)
        │  POST /api/verify  { barcode }
        ▼
Backend verification API (Next.js server routes)
  ├── input validation + GTIN check
  ├── rate limiting (relayer abuse protection)
  └── genlayer-js client + funded relayer wallet (server-only)
        │
        ▼
ProductVerifier Intelligent Contract (contracts/product_verifier.py)
  ├── fetches Open Food/Products/Beauty Facts catalogues (gl.nondet.web)
  ├── three independent judge perspectives evaluate the same evidence
  ├── a moderator step deliberates and produces the final verdict
  └── gl.vm.run_nondet_unsafe: independent validators re-run the whole
      pipeline and must agree on stable verdict fields before the result
      is accepted and stored
        │
        ▼
Structured result { verdict, product, sources[], judges{}, explanation }
        │
        ▼
Result screen + Evidence screen + local scan history
```

Key security property: **the user's browser never holds or controls the relayer wallet.** The frontend can only ask the backend to run one specific operation on one specific contract. It can never specify contract address, method, calldata, or gas.

## Why GenLayer

Ordinary smart contracts can't investigate off-chain information. GenLayer Intelligent Contracts run on validators equipped with LLMs and web access: each validator independently fetches evidence from public product catalogues, evaluates it through judge perspectives, and consensus (the equivalence principle) only accepts results where independent re-runs broadly agree. Narrative text is never compared — only stable verdict fields.

## Repository layout

```
verify/
├── contracts/
│   └── product_verifier.py     # The GenLayer Intelligent Contract
├── tests/direct/               # Executable contract tests (gltest direct mode)
├── scripts/
│   ├── deploy-contract.mjs     # Deploy to studionet via the relayer wallet
│   └── lint_contract.py        # genskill-mcp contract linter
├── web/                        # Next.js app (frontend + backend API)
│   └── src/
│       ├── app/                # Home, Scan, Verifying, Result, Evidence,
│       │                       # History, Settings + /api/verify, /api/config
│       ├── components/         # Bottom nav, theme picker, providers
│       ├── lib/                # api-client, history (localStorage), utils, GTIN
│       ├── server/             # genlayer-verifier (relayer), demo-verifier, rate-limit
│       └── types/              # Shared verification types
├── .env.example                # Placeholder env template (copy to .env)
└── README.md
```

## Running locally

```bash
# 1. Install web dependencies
cd web
npm install

# 2. Configure environment (repo root)
cd ..
cp .env.example .env
# edit .env — see below

# 3. Start the app (demo mode works out of the box)
cd web
npm run build
npm run start
# open http://localhost:3000
```

Demo mode (`VERIFY_MODE=DEVELOPMENT_DEMO`) returns clearly-labelled simulated results so you can exercise the full UI without StudioNet. Every demo response carries `mode: "DEVELOPMENT_DEMO"` and the UI shows an explicit "Development demo" banner.

## Environment variables (.env)

| Variable | Purpose |
|---|---|
| `GENLAYER_NETWORK` | `studionet` (default) |
| `GENLAYER_RPC` | Optional RPC override |
| `RELAYER_PRIVATE_KEY` | Funded backend wallet key. **Server-side only. Never commit. Never log.** |
| `GENLAYER_CONTRACT_ADDRESS` | Filled after deployment |
| `VERIFY_MODE` | `DEVELOPMENT_DEMO` or `REAL_STUDIONET` |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## Configuring the funded relayer wallet

1. Generate a **dedicated** wallet for VERIFY (never reuse a personal one).
2. Fund it with GEN on StudioNet.
3. Put the private key in `.env` as `RELAYER_PRIVATE_KEY=0x...`.
4. Per project policy, every wallet address/key used in this project must be **personally confirmed by the owner** before being placed into any file.

The key exists only in `.env` (git-ignored), is loaded by `next.config.ts` at server start, and is referenced exclusively inside `src/server/genlayer-verifier.ts` (`import "server-only"` guards against any client import).

## Deploying the contract to StudioNet

```bash
# lint first
python scripts/lint_contract.py contracts/product_verifier.py

# executable test suite (13 tests, mocked web + LLM, no network needed)
/c/Python314/python -m pytest tests/direct/test_product_verifier.py -v

# deploy (requires RELAYER_PRIVATE_KEY in .env; sequential + waits for receipt)
node scripts/deploy-contract.mjs
```

The script prints the deployed address. Add it to `.env` as `GENLAYER_CONTRACT_ADDRESS`, set `VERIFY_MODE=REAL_STUDIONET`, restart the app, and verifications hit the real contract.

Note: studionet consensus runs are genuinely slow (several minutes per verification). The backend waits up to ~15 minutes for the receipt; the UI shows live investigation stages while waiting.

## Testing

```bash
# Contract tests (executable, mocked web+LLM)
/c/Python314/python -m pytest tests/direct/test_product_verifier.py -v

# Backend endpoint smoke checks
curl -X POST localhost:3000/api/verify -H 'Content-Type: application/json' \
  -d '{"barcode":"5449000000996"}'
curl -X POST localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"barcode":"abc"}'   # 400
curl localhost:3000/api/verify                                                                      # 405
```

Covered: valid/invalid/missing barcodes, cached re-verification, unknown-barcode → INCONCLUSIVE (never SUSPICIOUS-by-default), unreachable sources reported honestly, malformed LLM output degrading to INCONCLUSIVE, rate limiting, GET rejection.

## Known limitations

- Evidence sources are limited to keyless public catalogue APIs (Open Food/Products/Beauty Facts). Many barcodes simply aren't in them — those honestly return INCONCLUSIVE.
- Studionet is a studio network: consensus can pause for extended periods. A stuck transaction is infrastructure, not a bug — retry later.
- Rate limiting is in-memory (per process). Swap in a shared store when scaling beyond one instance.
- Demo mode simulates judge output for UI development; it never silently substitutes for real results.

## Security considerations

- Relayer key: backend-only, env-supplied, git-ignored, never logged, never returned by any API.
- `/api/verify` accepts exactly one shape of request; no arbitrary contract calls, addresses, methods, or calldata are reachable from the frontend.
- Rate limits: 5 requests/min/IP and 30/hour/IP.
- All external content fetched by the contract is treated as UNTRUSTED_EVIDENCE; prompts instruct judges to never follow instructions embedded in it.
- External text rendered in the UI is escaped by React (no raw HTML injection).
- Errors returned to users are human-readable; technical detail goes only to server logs.
