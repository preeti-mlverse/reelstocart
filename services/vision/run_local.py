"""Local dev launcher: load the repo .env into the environment, then run uvicorn.
In Docker/production, env comes from the container — this file is dev-only."""
import os
import pathlib
import uvicorn

# Load ../../.env (repo root) if present. Does not override already-set vars.
root_env = pathlib.Path(__file__).resolve().parents[2] / ".env"
if root_env.exists():
    for line in root_env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

# Default to the hosted Gemini path when a key is present but mode unset.
if os.environ.get("GEMINI_API_KEY") and not os.environ.get("RTC_MODE"):
    os.environ["RTC_MODE"] = "REAL_HOSTED"

if __name__ == "__main__":
    port = int(os.environ.get("VISION_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)
