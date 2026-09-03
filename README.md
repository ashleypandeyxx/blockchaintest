# blockchaintest

Two projects share this repository:

| | |
|---|---|
| **Glimmer** | A Next.js chat app for Claude, where the whole interface re-themes around whichever AI personality you're talking to. `app/` |
| **PredictionMarket** | A parimutuel binary prediction market in Solidity, with Hardhat 3 tests and an Ignition deployment. `contracts/` |

They're independent — neither imports the other.

---

## Glimmer

A pink, floral chat interface backed by the Anthropic Messages API
(`claude-sonnet-5`), streamed over SSE so replies land token by token.

### The cast

Six hand-written personalities, each with her own system prompt, opening line,
suggested prompts, botanical motif and colour palette:

| | | |
|---|---|---|
| **Bijou** | the glam bestie | Hype-woman energy with actual follow-through |
| **Marguerite** | the vintage romantic | Slow, exact, unbothered by your deadline |
| **Pixel** | the y2k cyber-fairy | Lowercase, chaotic, allergic to a boring answer |
| **Dr. Juniper Belle** | the soft scientist | Explains the hard thing until it stops being hard |
| **Velvet** | the chic deadpan | The true thing in the fewest possible words |
| **Sprinkle** | the sugar gremlin | Feral, delighted, weirdly wise |

Switching persona re-tints every surface in the app. Past turns keep the palette
of whoever wrote them, so a mixed thread stays legible. Switching mid-conversation
tells the incoming persona what happened, and she acknowledges the handover in
her own voice.

### Personality Studio

Build your own. Four dials — warmth, humour, structure, length — plus a free-text
note compile into a real system prompt, shown in full before you save. Custom
personalities persist in `localStorage` alongside your conversations, and can be
edited or deleted later.

### Running it

```bash
npm install
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
npm run dev
```

Then open <http://localhost:3000>. Without a key the app still runs — it surfaces
a readable error in the chat instead of a reply.

| Variable | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — |
| `GLIMMER_MODEL` | no | `claude-sonnet-5` |

### How it's built

- `app/api/chat/route.ts` — streaming route handler. Trims history to 40 turns,
  maps typed SDK errors (auth, rate limit, bad request) to messages worth reading,
  and cancels cleanly when the client aborts.
- `app/lib/personalities.ts` — the persona registry, plus `buildSystemPrompt`,
  which turns Studio dials into prose.
- `app/lib/stream.ts` — SSE reader on the client.
- `app/components/Botanicals.tsx` — every flower in the app: roses drawn as real
  spirals, a wreath, vine rules, corner sprays and six persona motifs. All
  hand-authored SVG. No icon font, no clipart, no emoji standing in for
  illustration.
- `app/components/Markdown.tsx` — small markdown renderer that builds React
  elements directly, so model output never touches `dangerouslySetInnerHTML`.

---

## PredictionMarket

`contracts/PredictionMarket.sol` — permissionless binary markets settled
parimutuel. Everyone who backs the winning side gets their stake back plus a
proportional slice of what the other side staked.

Parimutuel rather than an AMM or an order book: there's no liquidity to
bootstrap, no price to quote, and no path where the contract can owe more than
it holds. A fuzz test asserts exactly that.

### Rules

- **Anyone can open a market.** The creator names the oracle; stakers decide for
  themselves whether to trust it.
- **Stake before close.** Any amount, either side, as many times as you like.
- **The oracle reports** between the close time and the resolution deadline —
  `Yes`, `No`, or `Invalid`.
- **Winners claim** their stake plus `stake / winningPool × (losingPool − fee)`.
- **Everyone is refunded** if the market resolves `Invalid`, if the oracle misses
  its deadline (anyone can call `expire`), or if the winning side turns out to
  have no backers at all.
- **The fee comes out of the losing pool only**, so a winner never receives less
  than they put in. It's capped at 5% and snapshotted when the market opens, so
  a later fee change can't alter terms people already entered under.

Payouts are pull-based, guarded against reentrancy, and every state change
happens before ETH moves. Integer division rounds down, leaving at most
`winningPool − 1` wei of dust per market in the contract.

### Working with it

```bash
npx hardhat build            # compile
npx hardhat test             # Solidity + TypeScript tests
npx hardhat test solidity    # unit tests and fuzzing, in the EVM
npx hardhat test nodejs      # end-to-end lifecycle via viem
npx hardhat run scripts/prediction-market-demo.ts   # narrated walkthrough
```

Deploy:

```bash
npx hardhat ignition deploy ignition/modules/PredictionMarket.ts \
  --network hardhatMainnet
```

For a real network, set the treasury and fee in `ignition/parameters.json` and
pass `--parameters ignition/parameters.json --network sepolia`. Sepolia needs
`SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` as Hardhat config variables
(`npx hardhat keystore set SEPOLIA_RPC_URL`).

### Tests

`contracts/PredictionMarket.t.sol` covers each function's edge cases and fuzzes
three invariants: the contract stays solvent under any split, a winner never
loses principal, and an invalidated market refunds every wei.
`test/PredictionMarket.ts` drives the whole lifecycle through viem with real
wallets and balance assertions.
