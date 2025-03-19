#!/bin/bash
# Usage: create-environment-variables.sh <prefix> <variables-file>

set -eu

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <prefix> <variables-file>" >&2
    exit 1
fi

PREFIX=$1
VARS_FILE=$2

if [ ! -f "$VARS_FILE" ]; then
    echo "Error: Variables file $VARS_FILE does not exist" >&2
    exit 1
fi

VARS=($(grep -v '^#' "$VARS_FILE" | grep -v '^$'))

for ci_var in "${VARS[@]}"; do
    if [ -z "${!ci_var+x}" ]; then
        echo "Error: CI variable ${ci_var} is not set" >&2
        exit 1
    fi
    if [ -z "${!ci_var}" ]; then
        echo "Error: CI variable ${ci_var} is empty" >&2
        exit 1
    fi
    
    var=${ci_var#${PREFIX}_}
    echo "${var}=\"${!ci_var}\""
done