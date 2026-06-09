import base64
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
STORAGE_SERVICE_DIR = SCRIPT_DIR.parent
SERVICES_DIR = STORAGE_SERVICE_DIR.parent
PROJECT_DIR = SERVICES_DIR.parent
WORKSPACE_DIR = PROJECT_DIR.parent
DEFAULT_KEYSTORE_PATH = STORAGE_SERVICE_DIR / "data" / "kpabe_keystore.json"
DEFAULT_CURVE = os.environ.get("MEDCHAIN_KPABE_CURVE", "BN254")
LOCAL_VENDOR_DIR = STORAGE_SERVICE_DIR / "python-vendor"


def normalize_token(value: str) -> str:
    token = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip().upper()).strip("_")
    return token or "UNKNOWN"


def normalize_attribute_name(key: str, value: str) -> str:
    return f"{normalize_token(key)}_{normalize_token(value)}"


def normalize_key_policy_hint(raw_policy: str) -> str:
    text = str(raw_policy or "").strip()
    if not text:
        return ""

    text = re.sub(
        r"([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_.-]+)",
        lambda match: normalize_attribute_name(match.group(1), match.group(2)),
        text,
    )
    text = re.sub(r"\bAND\b", "and", text, flags=re.IGNORECASE)
    text = re.sub(r"\bOR\b", "or", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return ""

    if not text.startswith("("):
        text = f"({text})"

    return text


def build_ciphertext_attributes(record: dict) -> list[str]:
    attributes = {
        "ROLE_DOCTOR",
        f"DOCTOR_{normalize_token(record.get('doctorAddress'))}",
        f"PATIENT_{normalize_token(record.get('patientAddress'))}",
        f"RECORD_{normalize_token(record.get('id'))}",
    }

    policy = str(record.get("policy") or "")
    for key, value in re.findall(r"([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_.-]+)", policy):
        attributes.add(normalize_attribute_name(key, value))

    return sorted(attributes)


def build_suggested_key_policies(record: dict, key_policy_hint: str) -> dict:
    doctor_policy = (
        f"(ROLE_DOCTOR and DOCTOR_{normalize_token(record.get('doctorAddress'))})"
    )
    patient_policy = f"(PATIENT_{normalize_token(record.get('patientAddress'))})"

    suggested = {
        "creatorDoctor": doctor_policy,
        "patient": patient_policy,
    }

    if key_policy_hint:
        suggested["requestedPolicy"] = key_policy_hint

    return suggested


def b64encode_bytes(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def b64decode_text(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def serialize_group_element(group, element) -> str:
    return b64encode_bytes(group.serialize(element))


def deserialize_group_element(group, payload: str):
    return group.deserialize(b64decode_text(payload))


def serialize_mapping(group, mapping: dict) -> dict:
    return {
        key: serialize_group_element(group, value)
        for key, value in mapping.items()
    }


def deserialize_mapping(group, payload: dict) -> dict:
    return {
        key: deserialize_group_element(group, value)
        for key, value in payload.items()
    }


def serialize_ciphertext(group, ciphertext: dict) -> dict:
    c1 = ciphertext["c1"]
    c2 = ciphertext["c2"]
    c2_data = json.loads(c2.decode("utf-8") if isinstance(c2, bytes) else c2)

    return {
        "c1": {
            "E1": serialize_group_element(group, c1["E1"]),
            "E2": serialize_group_element(group, c1["E2"]),
            "E3": {
                attr: serialize_group_element(group, value)
                for attr, value in c1["E3"].items()
            },
            "attributes": list(c1["attributes"]),
        },
        "c2": c2_data,
    }


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def find_charm_src() -> Path:
    explicit = os.environ.get("MEDCHAIN_CHARM_SRC")
    candidates = [
        Path(explicit) if explicit else None,
        LOCAL_VENDOR_DIR / "charm_crypto_framework-0.63-py3.14-linux-x86_64.egg",
        LOCAL_VENDOR_DIR / "charm",
        WORKSPACE_DIR / "btl_project" / "charm",
        WORKSPACE_DIR / "Final_Project" / "btl_project" / "charm",
    ]

    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate

    raise FileNotFoundError(
        "Khong tim thay Charm-Crypto runtime. "
        "Hay kiem tra thu muc python-vendor trong storage-service "
        "hoac dat MEDCHAIN_CHARM_SRC tro den charm runtime hop le."
    )


def ensure_charm_on_path() -> None:
    try:
        import charm  # noqa: F401
        return
    except Exception:
        pass

    charm_src = str(find_charm_src())
    if charm_src not in sys.path:
        sys.path.insert(0, charm_src)


def load_or_create_keystore(group, hybrid):
    keystore_path = Path(
        os.environ.get("MEDCHAIN_KPABE_KEYSTORE_PATH") or DEFAULT_KEYSTORE_PATH
    ).resolve()
    keystore_path.parent.mkdir(parents=True, exist_ok=True)

    if keystore_path.exists():
        stored = json.loads(keystore_path.read_text(encoding="utf-8"))
        if stored.get("curve") != DEFAULT_CURVE:
            raise ValueError(
                f"Keystore curve {stored.get('curve')} khong khop voi {DEFAULT_CURVE}."
            )

        return (
            deserialize_mapping(group, stored["publicKey"]),
            deserialize_mapping(group, stored["masterKey"]),
            stored,
        )

    public_key, master_key = hybrid.setup()
    serialized_public_key = serialize_mapping(group, public_key)
    serialized_master_key = serialize_mapping(group, master_key)
    fingerprint = sha256_hex(
        json.dumps(serialized_public_key, ensure_ascii=True, sort_keys=True)
    )

    stored = {
        "schemaVersion": "1.0",
        "curve": DEFAULT_CURVE,
        "keyVersion": "kpabe-key-v1",
        "publicKeyFingerprint": fingerprint,
        "publicKey": serialized_public_key,
        "masterKey": serialized_master_key,
    }
    keystore_path.write_text(
        json.dumps(stored, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return public_key, master_key, stored


def build_package(record: dict, record_hash: str, encrypted_payload: dict, keystore: dict) -> dict:
    ciphertext_attributes = build_ciphertext_attributes(record)
    key_policy_hint = normalize_key_policy_hint(record.get("policy", ""))

    return {
        "recordId": record.get("id", ""),
        "version": "1.1",
        "encryptionScheme": "KP-ABE-HYBRID",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ownerInfo": {
            "patientAddress": record.get("patientAddress", ""),
            "doctorAddress": record.get("doctorAddress", ""),
        },
        "accessControl": {
            "policyExpression": record.get("policy", ""),
            "keyPolicyHint": key_policy_hint,
            "suggestedKeyPolicies": build_suggested_key_policies(record, key_policy_hint),
            "ciphertextAttributes": ciphertext_attributes,
            "publicKeyFingerprint": keystore["publicKeyFingerprint"],
            "keyVersion": keystore["keyVersion"],
            "pairingCurve": keystore["curve"],
        },
        "integrity": {
            "recordHash": record_hash,
        },
        "encryptedContent": {
            "ciphertextType": "kpabe-hybrid",
            "encryptedPayload": encrypted_payload,
        },
    }


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    record = payload.get("record") or {}
    record_hash = str(payload.get("recordHash") or "")

    if not record_hash:
        raise ValueError("Thieu recordHash de dong goi du lieu.")

    ensure_charm_on_path()

    from charm.adapters.kpabenc_adapt_hybrid import HybridABEnc
    from charm.schemes.abenc.abenc_lsw08 import KPabe
    from charm.toolbox.pairinggroup import PairingGroup

    group = PairingGroup(DEFAULT_CURVE)
    kpabe = KPabe(group)
    hybrid = HybridABEnc(kpabe, group)
    public_key, _, keystore = load_or_create_keystore(group, hybrid)

    plaintext = json.dumps(record, ensure_ascii=False).encode("utf-8")
    attributes = build_ciphertext_attributes(record)
    ciphertext = hybrid.encrypt(public_key, plaintext, attributes)
    encrypted_payload = serialize_ciphertext(group, ciphertext)
    package_json = build_package(record, record_hash, encrypted_payload, keystore)

    sys.stdout.write(json.dumps(package_json, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
