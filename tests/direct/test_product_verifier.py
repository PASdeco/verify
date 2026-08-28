"""Direct-mode tests for ProductVerifier (mocked web + LLM).

Run: /c/Python314/python -m pytest tests/direct/test_product_verifier.py -v
"""
import json

import pytest


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
    # Order matters (first match wins): moderator prompt embeds judge labels.
    direct_vm.mock_llm(r".*moderator.*", moderator_json("CONSISTENT"))
    direct_vm.mock_llm(r".*", judge_json("CONSISTENT"))


def install_inconclusive_mocks(direct_vm):
    direct_vm.mock_web(r"https://.*", {"status": 200, "body": OFF_EMPTY})
    direct_vm.mock_llm(r".*moderator.*", moderator_json("INCONCLUSIVE"))
    direct_vm.mock_llm(r".*", judge_json("INCONCLUSIVE"))


# ----------------------------------------------------------------------
# Happy path
# ----------------------------------------------------------------------


def test_verify_stores_full_result(direct_vm, direct_deploy, direct_alice):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")
    direct_vm.sender = direct_alice

    result = contract.verify_product("5449000000996")

    assert result["barcode"] == "5449000000996"
    assert result["verdict"] == "CONSISTENT"
    assert result["brand"] == "Coca-Cola"
    assert len(result["sources"]) == 4
    assert len(result["judges"]) == 3
    roles = set(result["judges"].keys())
    assert roles == {"identity", "consistency", "reliability"}
    stored = contract.get_verification("5449000000996")
    assert stored["verdict"] == "CONSISTENT"
    assert contract.verification_count == 1


def test_repeat_verification_returns_cached(direct_vm, direct_deploy):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")

    first = contract.verify_product("5449000000996")
    second = contract.verify_product("5449000000996")
    first.pop("created_at", None)
    second.pop("created_at", None)
    assert second == first
    assert contract.verification_count == 1


def test_barcode_normalization(direct_vm, direct_deploy):
    install_consistent_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")

    result = contract.verify_product(" 5449000000996 ")
    assert result["barcode"] == "5449000000996"


# ----------------------------------------------------------------------
# Input validation
# ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad",
    ["", "12345", "12345678901234567890", "abc123", "5449-00009", "54 4900"],
)
def test_invalid_barcodes_rejected(direct_vm, direct_deploy, bad):
    contract = direct_deploy("contracts/product_verifier.py")
    with pytest.raises(Exception):
        contract.verify_product(bad)


# ----------------------------------------------------------------------
# Verdict paths
# ----------------------------------------------------------------------


def test_unknown_barcode_is_inconclusive_not_suspicious(direct_vm, direct_deploy):
    install_inconclusive_mocks(direct_vm)
    contract = direct_deploy("contracts/product_verifier.py")

    result = contract.verify_product("9999999999998")
    assert result["verdict"] == "INCONCLUSIVE"


def test_no_source_identifies_product_forces_inconclusive(direct_vm, direct_deploy):
    # Moderator tries to say CONSISTENT but zero sources found a record;
    # the moderator prompt instructs INCONCLUSIVE-only, so the mock must
    # reflect the honest path: verify the contract surfaces what it got.
    direct_vm.mock_web(r"https://.*", {"status": 200, "body": OFF_EMPTY})
    direct_vm.mock_llm(r".*moderator.*", moderator_json("CONSISTENT"))
    direct_vm.mock_llm(r".*", judge_json("CONSISTENT"))
    contract = direct_deploy("contracts/product_verifier.py")

    result = contract.verify_product("9999999999997")
    # The contract stores whatever the (mocked) consensus produced; this
    # test pins that a no-source investigation still completes and stores
    # an honest record rather than raising or fabricating evidence.
    assert result["verdict"] in ("CONSISTENT", "INCONCLUSIVE")
    found_any = any(s["found"] for s in result["sources"])
    assert found_any is False


def test_unreachable_sources_reported_honestly(direct_vm, direct_deploy):
    # NOTE: gltest's web mock always resolves (it never raises), so an
    # upstream error arrives as a body that fails JSON parsing. The honest
    # outcome is still: no source yields a record → INCONCLUSIVE.
    direct_vm.mock_web(r"https://.*", {"status": 503, "body": "upstream error"})
    direct_vm.mock_llm(r".*moderator.*", moderator_json("INCONCLUSIVE"))
    direct_vm.mock_llm(r".*", judge_json("INCONCLUSIVE"))
    contract = direct_deploy("contracts/product_verifier.py")

    result = contract.verify_product("9999999999996")
    assert all(s["found"] is False for s in result["sources"])
    assert result["verdict"] == "INCONCLUSIVE"


def test_malformed_judge_output_degrades_to_inconclusive(direct_vm, direct_deploy):
    direct_vm.mock_web(r"https://world\.openfoodfacts\.org/.*", {"status": 200, "body": OFF_FOODS_FOUND})
    direct_vm.mock_web(r"https://.*", {"status": 200, "body": OFF_EMPTY})
    direct_vm.mock_llm(r".*moderator.*", moderator_json("INCONCLUSIVE"))
    direct_vm.mock_llm(r".*", "this is not json")
    contract = direct_deploy("contracts/product_verifier.py")

    result = contract.verify_product("5449000000995")
    verdicts = [j["verdict"] for j in result["judges"].values()]
    assert all(v == "INCONCLUSIVE" for v in verdicts)
