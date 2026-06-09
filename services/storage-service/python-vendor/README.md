Charm-Crypto runtime for Medchain storage-service lives here.

- `charm_crypto_framework-0.63-py3.14-linux-x86_64.egg` is copied into the project so KP-ABE does not depend on an external workspace path.
- `native/linux-x86_64/libpbc.so.1` is bundled with the project because Charm pairing support depends on this shared library at runtime.
- `kpabe_encrypt.py` loads this runtime first, then falls back to external sources only if needed.
- Keep the runtime version aligned with the active Python version used by `MEDCHAIN_PYTHON_BIN`.
