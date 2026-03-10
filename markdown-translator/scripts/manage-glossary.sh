#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../output}"

PROJECT_ID="${PROJECT_ID:-docs-349708}"
LOCATION="${LOCATION:-us-central1}"
GLOSSARY_ID="${GLOSSARY_ID:-docs-en-to-ja-glossary}"

resolve_path() {
  local raw_path="$1"
  local base_dir="$2"

  case "${raw_path}" in
    /*)
      printf '%s\n' "${raw_path}"
      ;;
    *)
      if [ -e "${raw_path}" ]; then
        printf '%s\n' "${raw_path}"
      else
        printf '%s\n' "${base_dir}/${raw_path#./}"
      fi
      ;;
  esac
}

GOOGLE_APPLICATION_CREDENTIALS="$(resolve_path "${GOOGLE_APPLICATION_CREDENTIALS:-./gcp_translateAPI_key.json}" "${OUTPUT_DIR}")"
REQUEST_FILE="$(resolve_path "${REQUEST_FILE:-./request.json}" "${OUTPUT_DIR}")"
export GOOGLE_APPLICATION_CREDENTIALS

BASE_URL="https://translation.googleapis.com/v3/projects/${PROJECT_ID}/locations/${LOCATION}/glossaries"
GLOSSARY_URL="${BASE_URL}/${GLOSSARY_ID}"
ACTION="${1:-recreate}"

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

require_file() {
  local file_path="$1"
  if [ ! -f "${file_path}" ]; then
    echo "Missing required file: ${file_path}" >&2
    exit 1
  fi
}

print_step() {
  local message="$1"
  printf '\n==> %s\n' "${message}"
}

fetch_access_token() {
  gcloud auth application-default print-access-token
}

delete_glossary() {
  print_step "Deleting glossary ${GLOSSARY_ID}"
  curl -sS -X DELETE \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${GLOSSARY_URL}"
  printf '\n'
}

create_glossary() {
  print_step "Creating glossary ${GLOSSARY_ID}"
  curl -sS -X POST \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "@${REQUEST_FILE}" \
    "${BASE_URL}"
  printf '\n'
}

list_glossaries() {
  print_step "Listing glossaries"
  curl -sS -X GET \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${BASE_URL}"
  printf '\n'
}

usage() {
  cat <<EOF
Usage: ./manage-glossary.sh [recreate|delete|create|list]

Defaults:
  OUTPUT_DIR=${OUTPUT_DIR}
  GOOGLE_APPLICATION_CREDENTIALS=${OUTPUT_DIR}/gcp_translateAPI_key.json
  REQUEST_FILE=${OUTPUT_DIR}/request.json
  PROJECT_ID=${PROJECT_ID}
  LOCATION=${LOCATION}
  GLOSSARY_ID=${GLOSSARY_ID}
EOF
}

case "${ACTION}" in
  -h|--help|help)
    usage
    exit 0
    ;;
esac

require_command gcloud
require_command curl
require_file "${GOOGLE_APPLICATION_CREDENTIALS}"

ACCESS_TOKEN="$(fetch_access_token)"

case "${ACTION}" in
  recreate)
    require_file "${REQUEST_FILE}"
    delete_glossary
    create_glossary
    list_glossaries
    ;;
  delete)
    delete_glossary
    ;;
  create)
    require_file "${REQUEST_FILE}"
    create_glossary
    ;;
  list)
    list_glossaries
    ;;
  *)
    echo "Unknown action: ${ACTION}" >&2
    usage
    exit 1
    ;;
esac
