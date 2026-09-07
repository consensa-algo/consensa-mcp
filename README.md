# consensa-mcp

An MCP server that lets an AI agent record a **consented, attributed, paid-for**
receipt for the open-source dependencies it consumes — settled per call in USDC on
Algorand via Consensa. Each call splits payment on-chain: provider 80%, upstream
maintainers' escrow 11% (per-dependency attribution), commons 7%, protocol 2%.

## Tools
- `consensa_attribution_preview(manifest)` — free. Which upstream deps would be
  attributed on-chain, plus the split and price. No payment.
- `consensa_clearance(manifest)` — **paid**. Pays USDC from the configured wallet
  and returns the on-chain receipt (`paymentTxId`, `settleTxId`, split, upstream).
- `consensa_receipt(paymentTxId)` — free. Look up a prior receipt.

## Bring-your-own-wallet
You run this server with **your own** funded Algorand spend wallet
(`CONSENSA_MCP_PAYER_MNEMONIC`). Consensa never holds or spends your funds. Use a
dedicated, low-balance wallet.

## Try it free — no wallet, no keys, right now

Two of the three tools are **plain HTTP against the live endpoint**. They need no
mnemonic, no funded account, and no configuration beyond the defaults:

- `consensa_attribution_preview(manifest)` — hand it a `package.json` and see exactly
  which upstream packages a paid call would attribute on-chain, the four-way split,
  and the price. **Nothing is paid and nothing is written to any chain.**
- `consensa_receipt(paymentTxId)` — look up any receipt this endpoint has issued.

Run the server with no env at all and ask your agent to preview a manifest. This is
the honest "$0 trial": the preview is the same computation the paid call performs,
from the same endpoint, over the same terms — it simply stops before paying.

**No MCP client either? Same trial, one `curl`:**

```bash
curl -s -X POST https://consensa-endpoint-production.up.railway.app/v1/quote \
  -H "Content-Type: application/json" \
  -d '{"manifest":{"type":"package.json","content":{"dependencies":{"left-pad":"^1.3.0"}}}}'
```

This is the exact HTTP call `consensa_attribution_preview` makes underneath — free,
unauthenticated, no signature, no chain write. Swap `left-pad` for any package name.

## Configure
Copy `.env.example` and fill it in — see that file for every variable. The payer
mnemonic must come from your environment; never commit it.

**`CONSENSA_NETWORK` has no default and must match the endpoint you point at.** The
server asks the endpoint which network it serves and refuses on conflict rather than
guessing. Against a mainnet endpoint it also refuses to pay until you have written
`mainnet` yourself — spending real USDC should be something you said, not something a
default decided.

Spend guards (defaults): `MAX_SPEND_USDC_PER_RUN=5.00`, `MAX_PER_CALL_USDC=0.02`,
`MAX_CALLS_PER_MIN=10`, plus idempotency (identical manifest within the TTL is not
charged twice). Optionally pin `CONSENSA_EXPECTED_PAYTO` so the server refuses to
pay any other address.

## Run (from the cloned repo)
```
npm install
npm run dev          # tsx src/index.ts   (or: npm run build && npm start)
```
The server speaks MCP over stdio. With no env set it serves the two free tools.
For the paid tool, add the wallet and network:
```
$env:CONSENSA_NETWORK="mainnet"; $env:CONSENSA_MCP_PAYER_MNEMONIC="<25 words>"
```

## Use it on Mainnet — from an MCP client (e.g. Claude Desktop)

**Finding the config file on Windows:** the standard location is
`%APPDATA%\Claude\claude_desktop_config.json`. If you installed Claude Desktop from the
**Microsoft Store**, that file does not exist there — Windows redirects it to
`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
instead (the package hash is consistent across installs but not guaranteed forever). If
neither path has the file yet, or you are unsure which install type you have, open Claude
Desktop → Settings → Developer → Edit Config — it opens (and creates, if needed) the file
at whichever path your install actually uses, so you do not have to guess.

```json
{
  "mcpServers": {
    "consensa": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "C:/Users/you/consensa-mcp",
      "env": {
        "CONSENSA_NETWORK": "mainnet",
        "CONSENSA_ENDPOINT": "https://consensa-endpoint-production.up.railway.app",
        "CONSENSA_EXPECTED_PAYTO": "PJOXFIBKVKGYGMCW3346P5N4OATMODZYM3VQOXDAEUTIGAOGRYGTIO3NME",
        "CONSENSA_MCP_PAYER_MNEMONIC": "<your 25-word mnemonic>",
        "MAX_SPEND_USDC_PER_RUN": "1.00"
      }
    }
  }
}
```

**`cwd` must be an absolute path with forward slashes, even on Windows.**

- Use: `C:/Users/you/consensa-mcp`
- Do not use: `C:\Users\you\consensa-mcp` (backslashes) or `./consensa-mcp` (a relative path)

A relative or backslash-escaped path does not raise an error. The server just fails to
start, silently. The example above is a working entry, not a placeholder. Copy its shape,
and change only the path.

## Status
v0.2, validated end-to-end on Algorand MainNet: payment
BADUNG7YO263XRACSVHASSRJ5MIHXQRKDKUYKIRU42BAQEQCRXMA (10,000 microUSDC)
settled by GYVS26OZABS4E6FQEH5C5YQBIV5ULG4VBMBVOYXCX4HG3FJ7UWGA, whose
on-chain receipt records the split as 8,000 / 1,100 / 700 / 200 —
summing exactly to the payment.
Bring-your-own-wallet. Start with the free tools above — they cost nothing and show
you exactly what a paid call would record.
