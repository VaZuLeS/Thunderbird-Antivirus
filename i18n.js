// Bundled English fallback: no remote translation loading.
const ThundyI18n = (() => {
    const fallback = {
  "extensionName": {
    "message": "Thundy AV – Email Scanner for Thunderbird",
    "description": "Name of the add-on as shown in the add-on manager and on the store listing."
  },
  "extensionDescription": {
    "message": "Optional, opt-in scanner for email attachments and links. Nothing leaves your computer without your explicit consent.",
    "description": "Short description of the add-on (max. 132 characters)."
  },
  "actionTitle": {
    "message": "Thundy AV – scan status for this message",
    "description": "Tooltip of the message display action button."
  },
  "bannerScanOnce": {
    "message": "Scan this message once"
  },
  "bannerScanSender": {
    "message": "Always scan this sender"
  },
  "bannerTitleOptIn": {
    "message": "Thundy AV: real-time scanning is not enabled for this message."
  },
  "bannerNoteOptIn": {
    "message": "Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you give your consent. See the add-on options."
  },
  "bannerScanRunning": {
    "message": "Scanning…"
  },
  "bannerScanDone": {
    "message": "Scan finished"
  },
  "bannerScanFailed": {
    "message": "Scan failed"
  },
  "bannerPermissionDenied": {
    "message": "Required host permission was denied"
  },
  "bannerConsentMissing": {
    "message": "External analysis is disabled in the options – nothing was transmitted."
  },
  "bannerThreatTitle": {
    "message": "Thundy AV warning"
  },
  "bannerThreatScore": {
    "message": "Risk score: $SCORE$ of 100",
    "placeholders": {
      "score": {
        "content": "$1"
      }
    }
  },
  "bannerSenderOptIn": {
    "message": "This sender is now scanned automatically."
  },
  "notificationScanStarted": {
    "message": "Scan started for: $URL$",
    "placeholders": {
      "url": {
        "content": "$1"
      }
    }
  },
  "notificationScanSubmitted": {
    "message": "Scan submitted successfully. Job ID: $JOBID$",
    "placeholders": {
      "jobid": {
        "content": "$1"
      }
    }
  },
  "notificationScanError": {
    "message": "Scan error: $ERROR$",
    "placeholders": {
      "error": {
        "content": "$1"
      }
    }
  },
  "notificationTitle": {
    "message": "Thundy AV Scanner"
  },
  "notificationTitleError": {
    "message": "Thundy AV Scanner error"
  },
  "bannerAuthPass": {
    "message": "Trusted server reports SPF/DKIM/DMARC passed"
  },
  "bannerOpenOptions": {
    "message": "Open options"
  },
  "menuScanLink": {
    "message": "Scan link with Thundy AV"
  },
  "menuScanMessageLinks": {
    "message": "Scan all links of this message"
  },
  "notificationNoLinks": {
    "message": "No links found in this message."
  },
  "bannerPermissionDeniedHint": {
    "message": "The host permission for the analysis service is missing. Please grant it in the add-on options."
  },
  "errorHostPermissionMissing": {
    "message": "Host permission for the analysis service is missing. Please grant it in the add-on options."
  },
  "errorTierUploadBlocked": {
    "message": "Uploading attachments is disabled in the privacy tier \"Strict\". Switch to \"Balanced\" or \"Maximum\" in the add-on options."
  },
  "errorTierUrlScanBlocked": {
    "message": "Submitting URLs is only allowed in the privacy tier \"Maximum\". Change the tier in the add-on options."
  },
  "notificationInjectionFailed": {
    "message": "The banner could not be inserted into the message view. Please report this with your Thunderbird version."
  },
  "bannerTierBlocked": {
    "message": "This action is not allowed by the current privacy tier. See the add-on options."
  },
  "ui_001": {
    "message": "Warning:"
  },
  "ui_002": {
    "message": " No Hybrid Analysis API key configured. You can use local checks or configure a provider in settings."
  },
  "ui_003": {
    "message": "Open settings"
  },
  "ui_004": {
    "message": "Select an email to inspect it."
  },
  "ui_005": {
    "message": "Loading analysis results…"
  },
  "ui_006": {
    "message": "External analysis is disabled: no hashes, files or links are sent to analysis services."
  },
  "ui_007": {
    "message": "No attachments or URLs found in this email."
  },
  "ui_008": {
    "message": "No analysis results available for this email."
  },
  "ui_009": {
    "message": "Unexpected error while loading analysis results."
  },
  "ui_010": {
    "message": "Status:"
  },
  "ui_011": {
    "message": " Analysis is still in progress. Please try again later."
  },
  "ui_012": {
    "message": "SHA-256: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_013": {
    "message": "Threat score:"
  },
  "ui_014": {
    "message": "Verdict:"
  },
  "ui_015": {
    "message": "Malware family:"
  },
  "ui_016": {
    "message": "Multiscan result: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_017": {
    "message": "Additional information:"
  },
  "ui_018": {
    "message": "Analysis started: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_019": {
    "message": "Tags: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_020": {
    "message": "VirusTotal results:"
  },
  "ui_021": {
    "message": "Malicious: $P1$$P2$",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_022": {
    "message": "Undetected: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_023": {
    "message": "Suspicious: $P1$$P2$",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_024": {
    "message": "Harmless: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_025": {
    "message": "Scanner: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_026": {
    "message": "Status: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_027": {
    "message": "Antivirus results:"
  },
  "ui_028": {
    "message": "AV: $P1$ – verdict: $P2$",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_029": {
    "message": "No scanner results available."
  },
  "ui_030": {
    "message": "SHA-256 hash: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_031": {
    "message": "Last file name: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_032": {
    "message": "Size: $P1$ bytes",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_033": {
    "message": "Type: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_034": {
    "message": "Scan again"
  },
  "ui_035": {
    "message": "Sanitize and download (local)"
  },
  "ui_036": {
    "message": "Checked item: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_037": {
    "message": "Local result: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_038": {
    "message": "SHA-256: $P1$ – external analysis is disabled.",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_039": {
    "message": "No external lookup because external analysis is disabled."
  },
  "ui_040": {
    "message": "external-analysis-disabled"
  },
  "ui_041": {
    "message": "Submitting scan…"
  },
  "ui_042": {
    "message": "Uploading file for a new scan…"
  },
  "ui_043": {
    "message": "Scan submitted. Reloading results…"
  },
  "ui_044": {
    "message": "Successful"
  },
  "ui_045": {
    "message": "Scan failed: "
  },
  "ui_046": {
    "message": "Unknown error"
  },
  "ui_047": {
    "message": "Try again"
  },
  "ui_048": {
    "message": "Communication error: "
  },
  "ui_049": {
    "message": "Sanitizing…"
  },
  "ui_050": {
    "message": "Sanitizing HTML locally…"
  },
  "ui_051": {
    "message": "Download started."
  },
  "ui_052": {
    "message": "Sanitized"
  },
  "ui_053": {
    "message": "Download failed: "
  },
  "ui_054": {
    "message": "API error: $P1$ for item $P2$",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_055": {
    "message": " (The API key may be invalid or missing.)"
  },
  "ui_056": {
    "message": "Network error: $P1$ for item $P2$",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_057": {
    "message": "Submitting URL…"
  },
  "ui_058": {
    "message": "Sending URL to Hybrid Analysis…"
  },
  "ui_059": {
    "message": "Scan submitted. Loading results…"
  },
  "ui_060": {
    "message": "Upload failed: "
  },
  "ui_061": {
    "message": "URL: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_062": {
    "message": "This URL was found in the email. To protect your privacy, it was "
  },
  "ui_063": {
    "message": "not uploaded automatically"
  },
  "ui_064": {
    "message": "Scan URL now"
  },
  "ui_065": {
    "message": "Uploading…"
  },
  "ui_066": {
    "message": "Sending file to Hybrid Analysis…"
  },
  "ui_067": {
    "message": "Upload completed. Loading results…"
  },
  "ui_068": {
    "message": "Scan file now (upload)"
  },
  "ui_069": {
    "message": "Attachment: $P1$",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_070": {
    "message": "No external report is available for this file. To protect your privacy, it was "
  },
  "ui_071": {
    "message": "Automatic uploads are disabled; the privacy tier still applies to manual scans."
  },
  "ui_072": {
    "message": "Link protection remains available alongside automatic scanning."
  },
  "ui_073": {
    "message": "Saving…"
  },
  "ui_074": {
    "message": "Settings saved."
  },
  "ui_075": {
    "message": "Save"
  },
  "ui_076": {
    "message": "Permission to transmit data was not granted. Nothing will be sent."
  },
  "ui_077": {
    "message": "Host permission was not granted for: "
  },
  "ui_078": {
    "message": ". Checks for these providers are unavailable without permission."
  },
  "ui_079": {
    "message": "Could not save settings."
  },
  "ui_080": {
    "message": "Clear the cache? This removes all locally stored analysis results."
  },
  "ui_081": {
    "message": "Clearing…"
  },
  "ui_082": {
    "message": "Cache cleared."
  },
  "ui_083": {
    "message": "No database exists yet, or it is already empty."
  },
  "ui_084": {
    "message": "Could not clear the cache."
  },
  "ui_085": {
    "message": "Clear cache"
  },
  "ui_086": {
    "message": "API key missing."
  },
  "ui_087": {
    "message": "SPF check failed (possible spoofing)."
  },
  "ui_088": {
    "message": "DKIM signature is invalid (possible spoofing)."
  },
  "ui_089": {
    "message": "DMARC check failed (possible spoofing)."
  },
  "ui_090": {
    "message": "URLhaus lists domain ($P1$) as malicious.",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_091": {
    "message": "Reply-To domain ($P1$) differs from sender domain ($P2$).",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_092": {
    "message": "Possible business email compromise: first contact with this sender and urgency keywords found ($P1$).",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_093": {
    "message": "Urgency keywords found ($P1$). Check this request carefully.",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_094": {
    "message": "This is your first communication with this sender."
  },
  "ui_095": {
    "message": "Sender domain ($P1$) resembles the known brand $P2$.",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_096": {
    "message": "Link domain ($P1$) resembles the known brand $P2$.",
    "placeholders": {
      "p1": {
        "content": "$1"
      },
      "p2": {
        "content": "$2"
      }
    }
  },
  "ui_097": {
    "message": "None of the links in the text point to the sender domain ($P1$).",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "ui_098": {
    "message": "CLEAN"
  },
  "ui_099": {
    "message": "URL scan failed: "
  },
  "ui_100": {
    "message": "Could not start urlscan.io scan: "
  },
  "ui_101": {
    "message": "urlscan.io did not return a scan ID."
  },
  "ui_102": {
    "message": "urlscan.io identified the URL as malicious."
  },
  "ui_103": {
    "message": "Visual detection: the page impersonates "
  },
  "ui_104": {
    "message": " (suspected phishing)."
  },
  "ui_105": {
    "message": "Could not retrieve urlscan.io results: "
  },
  "ui_106": {
    "message": "Thundy AV – Email Scanner"
  },
  "ui_107": {
    "message": "View all Hybrid Analysis submissions"
  },
  "ui_108": {
    "message": "View all Hybrid Analysis submissions (opens a new tab)"
  },
  "ui_109": {
    "message": "Subject:"
  },
  "ui_110": {
    "message": "From:"
  },
  "ui_111": {
    "message": "Message ID:"
  },
  "ui_112": {
    "message": "Thundy AV settings"
  },
  "ui_113": {
    "message": "Hybrid Analysis is a malware analysis service. You can submit files for static and dynamic analysis."
  },
  "ui_114": {
    "message": "Hybrid Analysis uses CrowdStrike Falcon Sandbox to investigate unknown threats."
  },
  "ui_115": {
    "message": "Provider accounts and service terms apply to external analysis. Local checks do not require an account."
  },
  "ui_116": {
    "message": "Thundy AV settings"
  },
  "ui_117": {
    "message": "What is Hybrid Analysis?"
  },
  "ui_118": {
    "message": "For external file analysis, obtain an API key from"
  },
  "ui_119": {
    "message": "After signing in, go to your profile and find the API KEY section."
  },
  "ui_120": {
    "message": "Paste the API key here. Local checks work without it."
  },
  "ui_121": {
    "message": "API key setup"
  },
  "ui_122": {
    "message": "hybrid-analysis.com"
  },
  "ui_123": {
    "message": "hybrid-analysis.com (opens a new tab)"
  },
  "ui_124": {
    "message": "Allow external analysis (send data to third-party providers)"
  },
  "ui_125": {
    "message": "Without this consent,"
  },
  "ui_126": {
    "message": " hashes, files, links or IP addresses are sent to external services. After consent, authorized scans may send attachment and link data to Hybrid Analysis, VirusTotal, urlscan.io, URLhaus or AbuseIPDB, depending on the privacy tier. Turn this option off to withdraw consent. Details:"
  },
  "ui_127": {
    "message": "no"
  },
  "ui_128": {
    "message": "Privacy policy"
  },
  "ui_129": {
    "message": "Privacy policy (opens a new tab)"
  },
  "ui_130": {
    "message": "Hybrid Analysis API key (optional):"
  },
  "ui_131": {
    "message": "e.g. abcdef123456…"
  },
  "ui_132": {
    "message": "URLhaus API key (optional domain reputation):"
  },
  "ui_133": {
    "message": "You can obtain an API key at"
  },
  "ui_134": {
    "message": "."
  },
  "ui_135": {
    "message": "urlhaus.abuse.ch"
  },
  "ui_136": {
    "message": "urlhaus.abuse.ch (opens a new tab)"
  },
  "ui_137": {
    "message": "urlscan.io API key (optional URL analysis):"
  },
  "ui_138": {
    "message": "You can obtain an API key at"
  },
  "ui_139": {
    "message": "urlscan.io"
  },
  "ui_140": {
    "message": "urlscan.io (opens a new tab)"
  },
  "ui_141": {
    "message": "VirusTotal API key (optional file reputation):"
  },
  "ui_142": {
    "message": "virustotal.com"
  },
  "ui_143": {
    "message": "virustotal.com (opens a new tab)"
  },
  "ui_144": {
    "message": "Privacy tier:"
  },
  "ui_145": {
    "message": "Strict (default: hashes and domains only, no uploads)"
  },
  "ui_146": {
    "message": "Balanced (upload unknown files, no complete URLs)"
  },
  "ui_147": {
    "message": "Maximum analysis (upload unknown files and complete URLs)"
  },
  "ui_148": {
    "message": "Limits the data sent to analysis providers. Applies only when external analysis is enabled."
  },
  "ui_149": {
    "message": "IP reputation (check Received headers):"
  },
  "ui_150": {
    "message": "Disabled"
  },
  "ui_151": {
    "message": "VirusTotal (requires a VirusTotal API key)"
  },
  "ui_152": {
    "message": "AbuseIPDB (requires an AbuseIPDB API key)"
  },
  "ui_153": {
    "message": "IP reputation API key:"
  },
  "ui_154": {
    "message": "Sends public IP addresses from the email's Received headers to the selected provider. Requires external analysis consent and a scan authorization."
  },
  "ui_155": {
    "message": "Allowlist (comma-separated domains or email addresses):"
  },
  "ui_156": {
    "message": "e.g. example.com, test@example.com"
  },
  "ui_157": {
    "message": "Trusted sender entries suppress local sender warnings. They do not authorize external scans."
  },
  "ui_158": {
    "message": "Blocklist (comma-separated domains or email addresses):"
  },
  "ui_159": {
    "message": "Enter blocked domains or email addresses."
  },
  "ui_160": {
    "message": "Always scan manually (no automatic uploads)"
  },
  "ui_161": {
    "message": "Prevents automatic external scans. Explicit manual actions still require consent and the appropriate privacy tier."
  },
  "ui_162": {
    "message": "Scan email links when opening an authorized message"
  },
  "ui_163": {
    "message": "Link checks require consent, a scan authorization and the appropriate privacy tier."
  },
  "ui_164": {
    "message": "Check links before opening them"
  },
  "ui_165": {
    "message": "Pauses navigation to show the result. Unchecked links and errors are clearly identified. Full URL analysis requires the Maximum tier."
  },
  "ui_166": {
    "message": "Remember to save your settings."
  },
  "ui_167": {
    "message": "Data management"
  },
  "ui_168": {
    "message": "Clear locally stored results and reputation caches."
  },
  "linkChecking": {
    "message": "Checking link…"
  },
  "linkWarning": {
    "message": "This link was reported as suspicious or malicious."
  },
  "linkUnknown": {
    "message": "This link could not be checked. Opening it may be risky."
  },
  "linkNoDetection": {
    "message": "No threat detected by the provider. This is not a guarantee of safety."
  },
  "linkProceed": {
    "message": "Open link anyway"
  },
  "linkCancel": {
    "message": "Cancel"
  },
  "localMode": {
    "message": "Local checks work without API keys. External scans require your consent and a message or sender authorization."
  },
  "statusNormal": {
    "message": " (No detection)"
  },
  "statusSuspicious": {
    "message": " (Suspicious)"
  },
  "statusCritical": {
    "message": " (Critical)"
  },
  "noSubject": {
    "message": "(No subject)"
  },
  "noSender": {
    "message": "(Unknown sender)"
  },
  "noId": {
    "message": "(No ID)"
  },
  "unknownAttachment": {
    "message": "Unknown"
  },
  "statusDangerous": {
    "message": " (Dangerous)"
  },
  "sizeLimit": {
    "message": "Attachment exceeds the 25 MiB local size limit and was not read or uploaded."
  },
  "trustedAuthLabel": {
    "message": "Trusted authentication servers (comma-separated)"
  },
  "trustedAuthHelp": {
    "message": "Only list recipient mail servers you administer or explicitly trust. Unconfigured header reports remain unverified."
  },
  "consentHelp": {
    "message": "Without consent, nothing is sent externally. After consent, only explicitly authorized messages or senders are scanned. Hashes, domains and public IPs may be sent in Strict; Balanced also permits unknown file uploads; Maximum also permits complete URL uploads. Turn this option off to stop new transfers and cancel pending requests. Previously transmitted data cannot be recalled."
  },
  "visualImpersonation": {
    "message": "Visual detection: the page impersonates $BRANDS$ (suspected phishing).",
    "placeholders": {
      "brands": {
        "content": "$1"
      }
    }
  },
  "reasonBlockedEmail": {
    "message": "Sender email ($P1$) is on the blocklist.",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "reasonBlockedDomain": {
    "message": "Sender domain ($P1$) is on the blocklist ($P2$).",
    "placeholders": {
      "p2": {
        "content": "$2"
      },
      "p1": {
        "content": "$1"
      }
    }
  },
  "reasonAllowedEmail": {
    "message": "Sender email ($P1$) is on the allowlist.",
    "placeholders": {
      "p1": {
        "content": "$1"
      }
    }
  },
  "reasonAllowedDomain": {
    "message": "Sender domain ($P1$) is on the allowlist ($P2$).",
    "placeholders": {
      "p2": {
        "content": "$2"
      },
      "p1": {
        "content": "$1"
      }
    }
  },
  "urlscanVisibility": {
    "message": "urlscan.io submissions are unlisted, not private. A complete URL can contain personal data or access tokens. Submit only URLs you are allowed to share."
  },
  "notificationScanCount": {
    "message": "Submitted scans: $COUNT$",
    "placeholders": {
      "count": {
        "content": "$1"
      }
    }
  },
  "gatewayRequestTimeout": {
    "message": "The provider request was cancelled or timed out."
  },
  "gatewayInvalidJson": {
    "message": "The provider returned an unreadable response."
  },
  "gatewayNetworkError": {
    "message": "The provider could not be reached."
  },
  "noMessageFound": {
    "message": "No displayed message found."
  },
  "providerNoDetection": {
    "message": "No threat detected"
  },
  "providerMalicious": {
    "message": "Malicious"
  },
  "providerSuspicious": {
    "message": "Suspicious"
  },
  "providerPending": {
    "message": "Analysis pending"
  },
  "privacyLocalData": {
    "message": "Thundy AV reads the displayed message, its sender, subject, headers, text and attachments to perform local checks. Local checks work without API keys. There is no telemetry and no developer analysis server."
  },
  "privacyProviders": {
    "message": "Authorized external requests go directly to configured providers: Hybrid Analysis for file hashes and uploads, VirusTotal for file hashes or IP reputation, URLhaus for domains, urlscan.io for complete URLs and AbuseIPDB for public IPs. Hashes can identify known files. Provider terms and privacy policies apply; submitted data may be shared by the provider."
  },
  "privacyRetention": {
    "message": "Settings, consent, sender authorizations and API keys are stored in your Thunderbird profile. API keys are not encrypted there. Local scan records can include subjects, sender addresses, complete links and attachment metadata. The cache retains up to 1,000 message records for 30 days and is cleaned on database startup. In-memory reputation results expire after 15 minutes."
  },
  "privacyControl": {
    "message": "Turn off external analysis to stop new requests and cancel pending requests. Already transmitted data cannot be recalled. Use Clear cache to delete stored analysis results and reputation caches. Individual sender authorizations can be removed in settings."
  },
  "privacyDetailed": {
    "message": "Detailed privacy policy (English/German)"
  },
  "senderAuthorizationsLabel": {
    "message": "Authorized senders (one email address per line)"
  },
  "senderAuthorizationsHelp": {
    "message": "These senders may be scanned automatically when external analysis is enabled. Remove an address to stop automatic scans for future messages. This list does not bypass the privacy tier or manual mode."
  },
  "invalidSenderAddress": {
    "message": "Enter plain email addresses, one per line."
  }
};
    function get(key, params = []) {
        const values = Array.isArray(params) ? params.map(String) : [String(params)];
        try { const text = browser.i18n.getMessage(key, values); if (text) return text; } catch (e) {}
        const item = fallback[key];
        if (!item) return key;
        return item.message.replace(/\$([A-Z0-9_]+)\$/g, (all, name) => {
            const placeholder = item.placeholders && item.placeholders[name.toLowerCase()];
            if (!placeholder) return all;
            return placeholder.content.replace(/\$(\d+)/g, (_, index) => values[Number(index) - 1] ?? '');
        });
    }
    function initialize(root = document) {
        let language = 'en';
        try { language = browser.i18n.getUILanguage() || 'en'; } catch (e) {}
        language = language.toLowerCase().split('-')[0];
        if (!['en', 'de', 'fr', 'es', 'it', 'pl'].includes(language)) language = 'en';
        if (root.documentElement) root.documentElement.lang = language;
        for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = get(el.dataset.i18n);
        for (const attr of ['title', 'placeholder', 'aria-label']) {
            for (const el of root.querySelectorAll('[data-i18n-' + attr + ']')) el.setAttribute(attr, get(el.getAttribute('data-i18n-' + attr)));
        }
    }
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => initialize());
    function locale() {
        try { return browser.i18n.getUILanguage() || 'en'; } catch (e) { return 'en'; }
    }
    function number(value) {
        return typeof value === 'number' ? new Intl.NumberFormat(locale()).format(value) : value;
    }
    function date(value) {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : value;
    }
    return { get, initialize, number, date };
})();
