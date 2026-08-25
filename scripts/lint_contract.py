#!/usr/bin/env python3
"""Lint the VERIFY GenLayer contract through genskill-mcp.

Usage:
  python scripts/lint_contract.py contracts/product_verifier.py
"""
import json
import subprocess
import sys

SERVER = r"C:\Vibecode\genskill-mcp\dist\cli.js"


def rpc(payloads):
    lines = [
        json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "verify-build", "version": "0.1.0"},
            },
        }),
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
    ]
    lines.extend(json.dumps(p) for p in payloads)
    stdin = "\n".join(lines) + "\n"
    proc = subprocess.run(
        ["node", SERVER], input=stdin, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=300,
    )
    out = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(msg.get("id"), int) and msg["id"] >= 2:
            out.append(msg)
    return proc, out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    path = sys.argv[1]
    with open(path, encoding="utf-8") as fh:
        code = fh.read()

    proc, msgs = rpc([{
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {
            "name": "genlayer_lint_contract",
            "arguments": {"code": code},
        },
    }])
    found = False
    for msg in msgs:
        result = msg.get("result", {})
        for item in result.get("content", []):
            if item.get("type") == "text":
                print(item["text"])
                found = True
    if not found:
        print(proc.stderr[-2000:] if proc.stderr else "(no output)")
        print("raw:", json.dumps(msgs)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
