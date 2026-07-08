# Quickstart — Thunderbird Antivirus

This quickstart shows how to build and run a minimal scan locally.

Prerequisites
- Git
- A C/C++ or Rust toolchain (depending on project language) or Node/Python runtime if applicable

Clone
```bash
git clone https://github.com/VaZuLeS/Thunderbird-Antivirus.git
cd Thunderbird-Antivirus
```

Build (example — adjust for repo language)
```bash
# Example for a typical build; replace with the project's build command
make build
# or
cargo build --release
```

Run a minimal scan
```bash
# Scan current directory
./thunderbird-antivirus --scan .
```

Example output
```
Scanning: 42 files
Detections: 0
Scan time: 1.2s
Report: report.json
```

If build instructions differ, follow the language-specific docs in the repo.
