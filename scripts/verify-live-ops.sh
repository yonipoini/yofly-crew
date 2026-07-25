#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  exit 1
fi

SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL%/}"
ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY}"

check_function() {
  local function_name="$1"
  local payload="$2"
  local status
  local body_file
  body_file="$(mktemp)"

  status="$(curl -sS -o "$body_file" -w '%{http_code}' \
    -X POST "${SUPABASE_URL}/functions/v1/${function_name}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "apikey: ${ANON_KEY}" \
    --data "$payload")"

  echo
  echo "Function: ${function_name}"
  echo "HTTP: ${status}"

  if [[ "$status" == "200" ]]; then
    head -c 600 "$body_file"
    echo
  else
    echo "Function unavailable or misconfigured."
    head -c 600 "$body_file"
    echo
  fi

  rm -f "$body_file"
}

echo "Checking live ops backends against ${SUPABASE_URL}"
check_function "tsa-estimates" '{"airportCode":"JFK"}'
check_function "flight-board" '{"airportCode":"JFK","maxFlights":4}'
check_function "aviation-weather" '{"icao":"KJFK"}'

echo
echo "Expected healthy responses:"
echo "- tsa-estimates returns 200 with a JSON updates array"
echo "- flight-board returns 200 with a JSON flights array"
echo "- aviation-weather returns 200 with official METAR-derived weather"
echo
echo "If tsa-estimates fails:"
echo "- Deploy supabase/functions/tsa-estimates/index.ts"
echo "- Set TSA_ESTIMATE_ENDPOINT and optional TSA_ESTIMATE_* secrets"
echo
echo "If flight-board fails:"
echo "- Deploy supabase/functions/flight-board/index.ts"
echo "- Set FLIGHTAWARE_API_KEY"
echo
echo "If aviation-weather fails:"
echo "- Deploy supabase/functions/aviation-weather/index.ts"
