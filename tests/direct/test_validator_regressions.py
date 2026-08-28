"""Regression tests for validator consensus hardening.

Team request: "Please make validators compare the substantive product records
that drive the receipt and prevent CONSISTENT and SUSPICIOUS from being
accepted as equivalent final verdicts. Add regression tests showing that
conflicting source fields and those opposing verdicts are rejected."

These tests use direct_vm.run_validator(...) to prove the new rules:

1. Conflicting source reported fields (brand/product_name) are rejected even
   when reachable/found match.
2. Opposing final verdicts CONSISTENT ↔ SUSPICIOUS are never accepted as
   equivalent, even when judge panels broadly agree.

Run: C:\\Python314\\python.exe -m pytest tests/direct/test_validator_regressions.py -v
"""

import copy
import json

# Reuse catalogue fixtures from sibling test file for deterministic mocks
OFF_FOODS_FOUND = json.dumps(
    {
        "status": 1,
        "product": {
            "product_name": "Coca-Cola Original Taste",
            "brands": "Coca-Cola",
            "quantity": "500 ml",
            "categories": "Beverages, Carbonated drinks",
            "manufacturers": "The Coca-Cola Company",
        },
    }
)

OFF_EMPTY = json.dumps({"status": 0})

PRODUCTS_FOUND = json.dumps(
    {
        "status": 1,
        "product": {
            "product_name": "Coca-Cola Original Taste 500ml",
            "brands": "Coca-Cola",
            "quantity": "500 ml",
            "manufacturers": "The Coca-Cola Company",
        },
    }
)


def judge_json(verdict="CONSISTENT"):
    return json.dumps(
        {
            "verdict": verdict,
            "summary": "One-line judge summary.",
            "reasoning": "Detailed reasoning grounded in the source evidence.",
        }
    )


def moderator_json(verdict="CONSISTENT"):
    return json.dumps(
        {
            "verdict": verdict,
            "product_name": "Coca-Cola Original Taste",
            "brand": "Coca-Cola",
            "manufacturer": "The Coca-Cola Company",
            "attributes": {
                "quantity": "500 ml",
                "category": "Beverages",
                "notes": "",
            },
            "evidence_summary": "Two catalogues returned matching records.",
            "consensus_summary": "All three judges agreed.",
            "explanation": "Public product information is consistent across sources.",
        }
    )


def install_consistent_mocks(direct_vm):
    direct_vm.mock_web(r"https://world\.openfoodfacts\.org/.*", {"status": 200, "body": OFF_FOODS_FOUND})
    direct_vm.mock_web(r"https://world\.openproductsfacts\.org/.*", {"status": 200, "body": PRODUCTS_FOUND})
    direct_vm.mock_web(r"https://world\.openbeautyfacts\.org/.*", {"status": 200, "body": OFF_EMPTY})
    direct_vm.mock_web(
        r"https://api\.upcitemdb\.com/.*",
        {"status": 200, "body": json.dumps({"code": "OK", "total": 1, "items": [{"title": "Coca-Cola Original 500ml", "brand": "Coca-Cola", "category": "Grocery"}]})},
    )
    direct_vm.mock_llm(r".*moderator.*", moderator_json("CONSISTENT"))
    direct_vm.mock_llm(r".*", judge_json("CONSISTENT"))


def _judges_with_verdict(verdict):
    return {
        "identity": {"role": "identity", "label": "Product Identity Judge", "verdict": verdict, "summary": "s", "reasoning": "r"},
        "consistency": {"role": "consistency", "label": "Cross-Source Consistency Judge", "verdict": verdict, "summary": "s", "reasoning": "r"},
        "reliability": {"role": "reliability", "label": "Source Reliability Judge", "verdict": verdict, "summary": "s", "reasoning": "r"},
    }


# ----------------------------------------------------------------------
# Sanity: identical records still accepted
# ----------------------------------------------------------------------


def test_validator_still_accepts_identical_records(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    # baseline is CONSISTENT with Coca-Cola brand; validator's fresh mine will be identical
    assert direct_vm.run_validator(leader_result=copy.deepcopy(baseline)) is True


# ----------------------------------------------------------------------
# Conflicting source fields → rejected (substantive product records)
# ----------------------------------------------------------------------


def test_validator_rejects_conflicting_brand_in_substantive_record(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    # Tamper substantive receipt field: brand differs from validator's fresh investigate
    leader["brand"] = "Pepsi"
    # Also tamper attributes to ensure substantive check catches it even if only one field differs
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_rejects_conflicting_product_name(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    leader["product_name"] = "Pepsi Max 500ml"
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_rejects_conflicting_manufacturer(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    leader["manufacturer"] = "PepsiCo Inc."
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_rejects_conflicting_quantity_attribute(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    leader["attributes"] = dict(baseline["attributes"])
    leader["attributes"]["quantity"] = "1 L"
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_rejects_conflicting_source_reported_field(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    # Tamper the substantive source payload: first found source's reported brands
    # Both leader and validator have reachable=True, found=True — the new
    # _source_agreement now also checks reported dict equality.
    found_idx = -1
    idx = 0
    while idx < len(leader["sources"]):
        s = leader["sources"][idx]
        if s.get("found"):
            found_idx = idx
            break
        idx += 1
    assert found_idx != -1, "baseline must have at least one found source"
    # Mutate reported content to simulate divergent catalogue data
    mutated = dict(leader["sources"][found_idx]["reported"])
    # Change any field that exists — brands or product_name
    if "brands" in mutated:
        mutated["brands"] = "Pepsi"
    elif "product_name" in mutated:
        mutated["product_name"] = "Pepsi Max"
    else:
        mutated["__tamper"] = "conflict"
    leader["sources"][found_idx]["reported"] = mutated
    assert direct_vm.run_validator(leader_result=leader) is False


# ----------------------------------------------------------------------
# Opposing final verdicts CONSISTENT ↔ SUSPICIOUS → always rejected
# ----------------------------------------------------------------------


def test_validator_rejects_consistent_vs_suspicious_final_verdict(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    # baseline is CONSISTENT; craft leader as SUSPICIOUS with internally consistent judges
    leader = copy.deepcopy(baseline)
    leader["verdict"] = "SUSPICIOUS"
    leader["judges"] = _judges_with_verdict("SUSPICIOUS")
    # Substantive fields stay identical — only verdict differs by one step
    # Previous code with distance >1 would have accepted this; new strict rule rejects
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_rejects_suspicious_vs_consistent_final_verdict(direct_vm, direct_deploy, direct_alice):
    # Install SUSPICIOUS mocks for the validator's view — baseline will be SUSPICIOUS
    # Then craft a CONSISTENT leader to prove the opposite direction also rejects
    direct_vm.mock_web(r"https://world\.openfoodfacts\.org/.*", {"status": 200, "body": OFF_FOODS_FOUND})
    direct_vm.mock_web(r"https://world\.openproductsfacts\.org/.*", {"status": 200, "body": PRODUCTS_FOUND})
    direct_vm.mock_web(r"https://world\.openbeautyfacts\.org/.*", {"status": 200, "body": OFF_EMPTY})
    direct_vm.mock_web(
        r"https://api\.upcitemdb\.com/.*",
        {"status": 200, "body": json.dumps({"code": "OK", "total": 1, "items": [{"title": "Coca-Cola Original 500ml", "brand": "Coca-Cola", "category": "Grocery"}]})},
    )
    direct_vm.mock_llm(r".*moderator.*", moderator_json("SUSPICIOUS"))
    direct_vm.mock_llm(r".*", judge_json("SUSPICIOUS"))
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline_suspicious = contract.verify_product("5449000000996")
    assert baseline_suspicious["verdict"] == "SUSPICIOUS"
    # Craft CONSISTENT leader while validator's fresh mine remains SUSPICIOUS
    leader_consistent = copy.deepcopy(baseline_suspicious)
    leader_consistent["verdict"] = "CONSISTENT"
    leader_consistent["judges"] = _judges_with_verdict("CONSISTENT")
    # Keep substantive fields identical so only verdict drives rejection
    assert direct_vm.run_validator(leader_result=leader_consistent) is False


def test_validator_still_rejects_even_when_judges_broadly_agree_but_final_differs(direct_vm, direct_deploy, direct_alice):
    """Even if judges agree (score 6/6), final verdict mismatch must still fail."""
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    # Keep judges identical (all CONSISTENT) so judge score is perfect,
    # but flip only the final moderator verdict to SUSPICIOUS.
    leader["verdict"] = "SUSPICIOUS"
    # judges stay CONSISTENT — this isolates the final-verdict rule
    assert direct_vm.run_validator(leader_result=leader) is False


# ----------------------------------------------------------------------
# Tolerant acceptance: minor LLM variations must still pass
# ----------------------------------------------------------------------


def test_validator_accepts_minor_product_name_variation(direct_vm, direct_deploy, direct_alice):
    """LLM may add quantity to product_name — validators should tolerate substring."""
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    # Validator will produce "Coca-Cola Original Taste", leader adds " 500 ml"
    leader["product_name"] = "Coca-Cola Original Taste 500 ml"
    # brand/manufacturer stay identical, verdict identical
    assert direct_vm.run_validator(leader_result=leader) is True


def test_validator_accepts_hyphen_vs_space_brand_variation(direct_vm, direct_deploy, direct_alice):
    """Hyphen vs space in brand should be considered same after normalization."""
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    leader["brand"] = "Coca Cola"  # baseline is "Coca-Cola"
    assert direct_vm.run_validator(leader_result=leader) is True


def test_validator_accepts_source_hyphen_variation(direct_vm, direct_deploy, direct_alice):
    """Source reported 'Coca-Cola' vs 'Coca Cola' should not trigger conflict."""
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    baseline = contract.verify_product("5449000000996")
    leader = copy.deepcopy(baseline)
    found_idx = -1
    idx = 0
    while idx < len(leader["sources"]):
        s = leader["sources"][idx]
        if s.get("found") and "brands" in s.get("reported", {}):
            found_idx = idx
            break
        idx += 1
    assert found_idx != -1
    mutated = dict(leader["sources"][found_idx]["reported"])
    # Change hyphen to space — should still be considered agreeing
    if "Coca-Cola" in mutated.get("brands", ""):
        mutated["brands"] = "Coca Cola"
    else:
        mutated["brands"] = "Coca Cola"
    leader["sources"][found_idx]["reported"] = mutated
    assert direct_vm.run_validator(leader_result=leader) is True
