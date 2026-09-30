#!/bin/bash
set -euo pipefail
# Merged tasks can change package manifests without updating the shared lockfile.
# Reconcile development dependencies here; production builds remain frozen.
pnpm install --no-frozen-lockfile
pnpm --filter db push
