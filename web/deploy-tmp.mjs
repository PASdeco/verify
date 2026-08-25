/**
 * Deploys the VERIFY ProductVerifier contract to the configured GenLayer
 * network using the relayer wallet from .env.
 *
 * SECURITY: the private key comes from .env (RELAYER_PRIVATE_KEY) and is
 * NEVER printed or logged. Only the deployer ADDRESS is shown.
 *
 * Run: node scripts/deploy-contract.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createAccount, createClient } from "genlayer-js";

// Load repo-root .env manually (scripts run from web/ for node_modules).
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

import {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury,
} from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const chainMap = { localnet, studionet, testnetAsimov, testnetBradbury };

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

const chainName = process.env.GENLAYER_NETWORK || "studionet";
const chain = chainMap[chainName] ?? studionet;
const account = createAccount(requireEnv("RELAYER_PRIVATE_KEY"));

const client = createClient({ chain, account });

console.log(`network: ${chainName}`);
console.log(`deployer: ${account.address}`);
if (!process.env.GENLAYER_CONTRACT_ADDRESS) {
  console.log("(contract address will be printed after deploy — add it to .env)");
} else {
  console.log(
    "NOTE: GENLAYER_CONTRACT_ADDRESS already set; deploying a NEW contract anyway."
  );
}

const code = readFileSync(resolve(__dirname, "../contracts/product_verifier.py"), "utf8");
console.log("\ndeploying ProductVerifier…");

const txHash = await client.deployContract({ code });
console.log(`deploy tx: ${txHash}`);

const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  status: TransactionStatus.ACCEPTED,
  interval: 3000,
  retries: 300,
});

if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
  console.error("deploy FAILED:", receipt.revert_reason ?? receipt);
  process.exit(1);
}

const address =
  receipt?.data?.contract_address ?? receipt?.contract_address ?? null;
console.log(`\nProductVerifier deployed: ${address}`);
console.log(`status: ${receipt.txExecutionResultName ?? "unknown"}`);

if (!address) {
  console.error("full receipt:", JSON.stringify(receipt, null, 2).slice(0, 2000));
  process.exit(1);
}

console.log("\n=== ADD THIS TO .env ===");
console.log(`GENLAYER_CONTRACT_ADDRESS=${address}`);
