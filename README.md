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
dedicated, low-balance wallet, and start on Testnet.

## Configure
Copy `.env.example` and fill it in — see that file for every variable. The payer
mnemonic must come from your environment; never commit it.

Spend guards (defaults): `MAX_SPEND_USDC_PER_RUN=5.00`, `MAX_PER_CALL_USDC=0.02`,
`MAX_CALLS_PER_MIN=10`, plus idempotency (identical manifest within the TTL is not
charged twice). Optionally pin `CONSENSA_EXPECTED_PAYTO` so the server refuses to
pay any other address.

## Run (from the cloned repo)
```
npm install
# env below is only needed for the PAID tool; preview/receipt need no wallet.
$env:CONSENSA_NETWORK="testnet"; $env:CONSENSA_MCP_PAYER_MNEMONIC="<25 words>"
npm run dev          # tsx src/index.ts   (or: npm run build && npm start)
```
The server speaks MCP over stdio.

## Use from an MCP client (e.g. Claude Desktop)
```json
{
  "mcpServers": {
    "consensa": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/consensa-mcp",
      "env": {
        "CONSENSA_NETWORK": "testnet",
        "CONSENSA_ENDPOINT": "https://consensa-endpoint-production.up.railway.app",
        "CONSENSA_MCP_PAYER_MNEMONIC": "<your 25-word mnemonic>",
        "MAX_SPEND_USDC_PER_RUN": "5.00"
      }
    }
  }
}
```

## Status
v0.1 MVP, validated end-to-end on Algorand MainNet: payment
BADUNG7YO263XRACSVHASSRJ5MIHXQRKDKUYKIRU42BAQEQCRXMA (10,000 microUSDC)
settled by GYVS26OZABS4E6FQEH5C5YQBIV5ULG4VBMBVOYXCX4HG3FJ7UWGA, whose
on-chain receipt records the split as 8,000 / 1,100 / 700 / 200 —
summing exactly to the payment.
Bring-your-own-wallet; start on Testnet.
