// Prints the deployer address derived from RELAYER_PRIVATE_KEY (never the key).
import { readFileSync } from "node:fs";
import { createAccount } from "genlayer-js";

for (const line of readFileSync("../.env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const acct = createAccount(process.env.RELAYER_PRIVATE_KEY);
console.log("deployer address:", acct.address);
