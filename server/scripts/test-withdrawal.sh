#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# MTN/Airtel withdrawal curl test
# ---------------------------------------------------------------------------
# Required env:
#   WITHDRAW_PHONE_NUMBER
#
# Auth options:
#   1) WITHDRAW_AUTH_TOKEN (or AUTH_TOKEN)
#   2) WITHDRAW_TEST_EMAIL + WITHDRAW_TEST_PASSWORD (or ADMIN_EMAIL + ADMIN_PASSWORD)
#
# Optional env:
#   API_BASE_URL                (default: http://localhost:3000)
#   WITHDRAW_PROVIDER           (default: MTN)
#   WITHDRAW_TYPE               (default: CASH)
#   WITHDRAW_CASH_VALUE         (default: 5000)
#   WITHDRAW_POINTS_TO_REDEEM   (optional)
#   WITHDRAW_IDEMPOTENCY_KEY    (default: withdraw-<timestamp>)
# ---------------------------------------------------------------------------

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_BASE_URL="${API_BASE_URL%/}"

WITHDRAW_PROVIDER="$(echo "${WITHDRAW_PROVIDER:-MTN}" | tr '[:lower:]' '[:upper:]')"
WITHDRAW_TYPE="$(echo "${WITHDRAW_TYPE:-CASH}" | tr '[:lower:]' '[:upper:]')"
WITHDRAW_PHONE_NUMBER="${WITHDRAW_PHONE_NUMBER:-}"
WITHDRAW_CASH_VALUE="${WITHDRAW_CASH_VALUE:-5000}"
WITHDRAW_POINTS_TO_REDEEM="${WITHDRAW_POINTS_TO_REDEEM:-}"
WITHDRAW_IDEMPOTENCY_KEY="${WITHDRAW_IDEMPOTENCY_KEY:-withdraw-$(date +%s)}"

AUTH_TOKEN="${WITHDRAW_AUTH_TOKEN:-${AUTH_TOKEN:-}}"
LOGIN_EMAIL="${WITHDRAW_TEST_EMAIL:-${ADMIN_EMAIL:-}}"
LOGIN_PASSWORD="${WITHDRAW_TEST_PASSWORD:-${ADMIN_PASSWORD:-}}"

if [ -z "${WITHDRAW_PHONE_NUMBER}" ]; then
  echo "Missing WITHDRAW_PHONE_NUMBER env var." >&2
  exit 1
fi

if [ "${WITHDRAW_PROVIDER}" != "MTN" ] && [ "${WITHDRAW_PROVIDER}" != "AIRTEL" ]; then
  echo "WITHDRAW_PROVIDER must be MTN or AIRTEL." >&2
  exit 1
fi

if [ "${WITHDRAW_TYPE}" != "CASH" ] && [ "${WITHDRAW_TYPE}" != "AIRTIME" ]; then
  echo "WITHDRAW_TYPE must be CASH or AIRTIME." >&2
  exit 1
fi

extract_token() {
  local json_input="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "${json_input}" | jq -r '.token // .accessToken // .data.token // empty'
    return
  fi

  if command -v node >/dev/null 2>&1; then
    node -e '
      const payload = process.argv[1];
      try {
        const data = JSON.parse(payload);
        const token = data?.token || data?.accessToken || data?.data?.token || "";
        process.stdout.write(token);
      } catch (_) {
        process.stdout.write("");
      }
    ' "${json_input}"
    return
  fi

  echo ""
}

if [ -z "${AUTH_TOKEN}" ]; then
  if [ -z "${LOGIN_EMAIL}" ] || [ -z "${LOGIN_PASSWORD}" ]; then
    echo "Set WITHDRAW_AUTH_TOKEN (or AUTH_TOKEN), or provide WITHDRAW_TEST_EMAIL + WITHDRAW_TEST_PASSWORD." >&2
    exit 1
  fi

  echo "No auth token found. Logging in at ${API_BASE_URL}/api/auth/signin..."
  LOGIN_RESPONSE=$(curl -sS -X POST "${API_BASE_URL}/api/auth/signin" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}")

  AUTH_TOKEN="$(extract_token "${LOGIN_RESPONSE}")"

  if [ -z "${AUTH_TOKEN}" ]; then
    echo "Failed to get auth token from login response." >&2
    echo "${LOGIN_RESPONSE}" >&2
    exit 1
  fi
fi

if [ -n "${WITHDRAW_POINTS_TO_REDEEM}" ]; then
  REQUEST_BODY=$(cat <<JSON
{"cashValue":${WITHDRAW_CASH_VALUE},"pointsToRedeem":${WITHDRAW_POINTS_TO_REDEEM},"provider":"${WITHDRAW_PROVIDER}","phoneNumber":"${WITHDRAW_PHONE_NUMBER}","type":"${WITHDRAW_TYPE}","idempotencyKey":"${WITHDRAW_IDEMPOTENCY_KEY}"}
JSON
)
else
  REQUEST_BODY=$(cat <<JSON
{"cashValue":${WITHDRAW_CASH_VALUE},"provider":"${WITHDRAW_PROVIDER}","phoneNumber":"${WITHDRAW_PHONE_NUMBER}","type":"${WITHDRAW_TYPE}","idempotencyKey":"${WITHDRAW_IDEMPOTENCY_KEY}"}
JSON
)
fi

echo "Testing withdrawal endpoint: ${API_BASE_URL}/api/payments/withdraw"
echo "Provider=${WITHDRAW_PROVIDER} Type=${WITHDRAW_TYPE} CashValue=${WITHDRAW_CASH_VALUE} Phone=${WITHDRAW_PHONE_NUMBER}"

TMP_BODY_FILE="$(mktemp)"
trap 'rm -f "${TMP_BODY_FILE}"' EXIT

HTTP_CODE=$(curl -sS \
  -o "${TMP_BODY_FILE}" \
  -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/payments/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "${REQUEST_BODY}")

echo "HTTP ${HTTP_CODE}"
if command -v jq >/dev/null 2>&1; then
  jq . "${TMP_BODY_FILE}" || cat "${TMP_BODY_FILE}"
else
  cat "${TMP_BODY_FILE}"
  echo
fi

if [ "${HTTP_CODE}" -lt 200 ] || [ "${HTTP_CODE}" -ge 300 ]; then
  exit 1
fi

