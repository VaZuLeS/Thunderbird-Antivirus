# Thunderbird Antivirus

[![CI](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/workflows/ci.yml/badge.svg)](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Releases](https://img.shields.io/github/v/release/VaZuLeS/Thunderbird-Antivirus)](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases)

A focused, open-source antivirus toolkit for Thunderbird-related workflows: fast local scans, configurable rules, and integration hooks for mail clients and automation.

## Table of Contents
- Quickstart
- Key features
- Installation
- Usage
- Development
- Contributing
- Security & License

## Quickstart (2 commands)
```bash
git clone https://github.com/VaZuLeS/Thunderbird-Antivirus.git
cd Thunderbird-Antivirus && ./thunderbird-antivirus --scan sample-data/
```

## Key features
- Fast local scanning with configurable rule sets
- Cross-platform support (Windows, Linux)
- Integration hooks for Thunderbird / mail clients
- Extensible rule engine for custom detections

## Installation
- Option A: Use prebuilt binary (releases)
- Option B: Build from source — see docs/quickstart.md for details

## Usage example
```bash
# basic scan
./thunderbird-antivirus --scan /path/to/maildir

# verbose with report
./thunderbird-antivirus --scan /path/to/maildir --output report.json --verbose
```

## Development
- See docs/quickstart.md to build and run tests.
- Run linters and unit tests before opening PRs.

## Contributing
Please read CONTRIBUTING.md before contributing. Short guide: create an issue, pick a labelled task (good-first-issue), open a branch, add tests, and open a PR.

## Security
Report security issues via the SECURITY.md process (private disclosure channel). Do not open public issues for potential vulnerabilities.

## License
This project is licensed under the MIT License. See LICENSE for details.

## Maintainers & Support
See CODEOWNERS for maintainer contacts. For community discussion, open an issue or use Discussions on the GitHub repo.
