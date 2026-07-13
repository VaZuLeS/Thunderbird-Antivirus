#!/usr/bin/env bash
# Minimal example script for Thunderbird Antivirus
# Usage: ./minimal_scan.sh /path/to/scan

TARGET=${1:-.}

echo "Running: ./thunderbird-antivirus --scan \"$TARGET\" --output report.json"
./thunderbird-antivirus --scan "$TARGET" --output report.json

echo "Done. Report: report.json"
