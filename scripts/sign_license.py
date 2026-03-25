import json
import base64
import sys
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# -------------------------
# Eingaben
# -------------------------
in_path  = Path(sys.argv[1])
out_path = Path(sys.argv[2])

# Lade Lizenzdaten
with in_path.open("r", encoding="utf-8") as f:
    daten = json.load(f)

# Lade privaten Schlüssel aus Environment
priv_b64 = sys.argv[3] if len(sys.argv) > 3 else None
if not priv_b64:
    import os
    priv_b64 = os.environ.get("PRIVATE_KEY_B64")
    if not priv_b64:
        raise RuntimeError("PRIVATE_KEY_B64 nicht gesetzt!")

priv_bytes = base64.b64decode(priv_b64)
private_key = Ed25519PrivateKey.from_private_bytes(priv_bytes)

# Signiere Lizenz
nachricht = json.dumps(daten, sort_keys=True).encode()
sig_bytes = private_key.sign(nachricht)
daten["signatur"] = base64.b64encode(sig_bytes).decode()

# Speichere signierte Lizenz
with out_path.open("w", encoding="utf-8") as f:
    json.dump(daten, f, indent=2, ensure_ascii=False)

print(f"✅ Lizenz signiert: {out_path}")
