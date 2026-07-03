"""Write-guard: code-level enforcement of the read-only contract.

Every file write the pipeline performs goes through ``safe_write`` /
``safe_copy``, which refuse any path outside the allowlisted working
directory. The original legacy file is additionally fingerprinted at
startup so the UI can prove, at any moment, that it has not been
touched. This is enforcement in code, not prose: nothing in the app
holds a writable handle to the legacy tree, and the pipeline never
invokes git.
"""

from __future__ import annotations

import hashlib
import os
import shutil

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ALLOWED_WRITE_ROOT = os.path.join(REPO_ROOT, "workdir")
LEGACY_FILE = os.path.join(REPO_ROOT, "legacy", "sdlt_engine.py")


class GuardViolation(PermissionError):
    pass


def _assert_allowed(path: str) -> str:
    resolved = os.path.realpath(path)
    root = os.path.realpath(ALLOWED_WRITE_ROOT)
    if not (resolved == root or resolved.startswith(root + os.sep)):
        raise GuardViolation(
            f"write blocked: {resolved} is outside the allowlisted working "
            f"directory {root}. The pipeline may only modify files in workdir/."
        )
    return resolved


def safe_write(path: str, content: str) -> str:
    resolved = _assert_allowed(path)
    os.makedirs(os.path.dirname(resolved), exist_ok=True)
    with open(resolved, "w") as f:
        f.write(content)
    return resolved


def safe_copy(src: str, dst: str) -> str:
    resolved = _assert_allowed(dst)
    os.makedirs(os.path.dirname(resolved), exist_ok=True)
    shutil.copyfile(src, resolved)
    return resolved


def file_sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LegacyIntegrity:
    """Fingerprint the legacy file at startup; verify on demand."""

    def __init__(self, path: str = LEGACY_FILE):
        self.path = path
        self.baseline = file_sha256(path)

    def check(self) -> dict:
        current = file_sha256(self.path)
        return {
            "path": os.path.relpath(self.path, REPO_ROOT),
            "sha256": current,
            "untouched": current == self.baseline,
        }
