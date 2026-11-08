#created 11/08/2026
from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parent
manifest = json.loads((root / "PACKAGE_MANIFEST.json").read_text())
errors = []
for name, expected in manifest["files"].items():
    path = (root / name).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        errors.append(name)
    elif hashlib.sha256(path.read_bytes()).hexdigest() != expected["sha256"]:
        errors.append(name)
if errors:
    raise SystemExit("File verification failed: " + ", ".join(errors))
print("PACKAGE_OK " + str(len(manifest["files"])) + " files")
