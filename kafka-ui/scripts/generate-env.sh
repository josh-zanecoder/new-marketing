#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${1:-$(cd "${DIR}/../.." && pwd)/.env.production}"
OUTPUT="${2:-${DIR}/../.env.production}"
exec node "${DIR}/generate-env.mjs" "${SOURCE}" "${OUTPUT}"
