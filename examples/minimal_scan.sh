#!/usr/bin/env bash
# Minimal example script for Thunderbird Antivirus
# Usage: ./minimal_scan.sh /path/to/scan

TARGET=${1:-.}
CMD="./thunderbird-antivirus --scan \"${TARGET}\" --output report.json"

echo "Running: $CMD"
eval $CMD

echo "Done. Report: report.json"
