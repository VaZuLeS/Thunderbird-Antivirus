# N06: Reale Abnahme und prüfbare Nachweise

Ausgangsprüfung: 14. Oktober 2026. Aktualisiert: 15. Oktober 2026. N06 wurde autonom auf Ausführbarkeit geprüft. **Die produktive Umsetzung und Abnahme bleiben blockiert:** aktuell sind keine Unternehmensidentitäten, Cloud-/IdP-/MDM-Zugänge oder freigegebenen Unternehmensendpunkte bereitgestellt. Bei der Ausgangsprüfung war kein Thunderbird im PATH vorhanden. Inzwischen wurde eine separate Thunderbird-140.17.0-Laufzeit für eine [echte Linux-Teilabnahme](THUNDERBIRD_LINUX_ABNAHME.md) bereitgestellt; Windows-/macOS-Testsysteme fehlen weiterhin. Außerdem fehlen weiterhin der produktive SEALED-Evidenzcommit, OIDC-BFF, OS-Verteilung und zentrale Rollenintegration im Code. Diese Lücken werden nicht durch Unterlagen oder synthetische Tests geschlossen.

Implementiert ist eine ausführbare, lokale Nachweisprüfung. Sie bindet Prüfererklärungen an Organisation, ausgewählte Profile, Region, Extensionversion, vollständige Prüfliste und Dateien mit Inhalts-Hash. Sie autorisiert weder eine Produktivaktivierung noch SEALED.

## Tatsächlich beobachtete Umgebung

[Lokaler Probe vom 14. Oktober 2026](enterprise/n06-runtime-observation.json): Linux/x64, Thunderbird-Binary nicht gefunden, keine Live-Abnahme ausgeführt. Zusätzlich meldete der Cloud-Laufzeitdienst in dieser Aufgabe mit aktuellen Beobachtungen: Netzwerkpolicy `enforced`, keine Secrets, Laufzeitvariablen oder Outbound-Identitäten und keine Infrastruktur-Capabilities. GitHub-Zugriff für das Repository ersetzt keine Unternehmenszugänge. Diese Beobachtung gilt für diese Umgebung und diesen Zeitpunkt.

```sh
npm run enterprise:acceptance -- probe --out /srv/review/runtime-probe.json
```

Der CLI prüft lediglich das lokale Betriebssystem und die Verfügbarkeit eines Thunderbird-Binary im PATH. Er führt Thunderbird nicht aus, liest keine Credentials und kann die Cloud-/SSO-Zugänge nicht selbst bestätigen. Ergebnisse werden mit `not_inspected` bzw. `false` gekennzeichnet.

Am 15. Oktober 2026 wurde die fehlende lokale Client-Laufzeit aufgelöst: tatsächliche Linux-GUI, Wizard in sechs Sprachen, Link-Abbruch/Audit, natives Popup und Themes erfolgreich geprüft. Dies ist kein signierter Operator-/Prüfernachweis und deckt die vollständige Check-ID `thunderbird-live-six-languages` nicht ab. Der historische Probebericht bleibt unverändert; er sucht nur im PATH und beschreibt den damaligen Zustand.

## Acht erforderliche Live-Nachweise

Jeder Punkt benötigt eine signierte Erklärung eines Operators und eines **anderen** zuständigen Prüfers. Beide müssen dieselben Nachweisdateien referenzieren. Signaturen beweisen nur die Herkunft der Erklärung; die Inhalte müssen fachlich geprüft werden.

| Check-ID | Pakete | Reale Prüfung und Nachweis | Unabhängige Prüferrolle |
|---|---|---|---|
| `operator-region` | F01 | Betreiber, Anbieter-/Tenant-/Projektidentität, tatsächliche Region und Netzwerk-/Betriebsgrenzen | `security-reviewer` |
| `data-retention-rules` | F02/F04 | Autorisierter Datenumfang, Domain-only-Regeln, Aufbewahrung, Ausfallmodus und Öffnungsregeln | `privacy-approver` |
| `cloud-lock-iam-kms-restore` | E02/E03 | Versionsgebundener Readback, verweigerte vorzeitige Löschung/Verkürzung, minimale IAM-Rechte, KMS-Zuordnung/Rotation und Restore über echte unabhängige Identitäten | `security-reviewer` |
| `sealed-evidence-commit` | E01 | Implementierter Evidenzcommit, unabhängiger Verifier, manipulierte/fremde/veraltete Quittungen ablehnen; Broker-Retirement nur nach bestätigtem Commit | `security-reviewer` |
| `sso-session-mfa-logout` | A01 | Echter IdP, PKCE/Issuer/Audience/Nonce, Session/CSRF/MFA und Logout-/Widerrufsfälle | `identity-reviewer` |
| `roles-org-export-denials` | A02/A03 | Organisations-/Objekt-/Exportrechte und negative Zugriffe; Reveal/Identity Resolve/Break Glass mit Zugriffsaudit | `identity-reviewer` |
| `native-broker-os-deployment` | F03/Q02 | Signierte OS-Pakete, MDM-Verteilung, OS-Schlüsselschutz, Native-Messaging-Origin-/IPC-Prüfung und Recovery auf Windows/macOS/Linux | `platform-reviewer` |
| `thunderbird-live-six-languages` | Q01/Q02 | 140 ESR und aktuelle Thunderbirdversion; Erstinstallation, Update, Link öffnen/abbrechen, Consent, Wizard und Adminprüfung in EN/DE/FR/ES/IT/PL auf freigegebenen Zielsystemen | `platform-reviewer` |

Details zur Extension: [Live-Prüfliste 1.22.0](live_test_1_22_0.md). Die vorhandenen Chromium-/Unit-Tests ersetzen diese Nachweise nicht.

## Ausführbarer Abnahmeplan

```sh
npm run enterprise:acceptance -- draft \
  --organization-id ECHTE_ORGANISATIONS_UUID --region FREIGEGEBENE_REGION \
  --bundle microsoft --out /srv/review/acceptance-plan.json
```

Verfügbare Bundles: `local`, `microsoft`, `openSource`, `cloud`; die Profile bleiben Optionen. Ein Draft aktiviert nichts. Für Mischkonfigurationen kann die vollständige `selection` mit bestehenden Profil-IDs geändert werden, bevor der Plan gepinnt/signiert wird. Bei lokalen oder fehlenden SSO-/Geräteprofilen wird keine Bereitschaft zur produktiven manuellen Abnahme ausgewiesen.

Plan und Prüfliste müssen vor Tests feststehen. `planHash` ist der SHA-256 des JCS-kanonisierten Plans (`hash(plan)` aus `enterprise/ledger.cjs`). Eine Änderung von Organisation, Region, Version, Profilen oder Prüfliste macht alte Erklärungen unpassend.

## Trust, Erklärungen und Artefakte

Die Authority-Datei ist eine vom Unternehmen **unabhängig verteilte und geschützte Trustwurzel**, kein Teil der untrusted Testlieferung. JSON-Array:

```json
[
  {
    "keyId": "security-reviewer-1",
    "organizationId": "11111111-1111-4111-8111-111111111111",
    "role": "security-reviewer",
    "principalId": "reviewer-1",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n"
  }
]
```

Die Vorlage enthält absichtlich keinen gültigen Schlüssel. Ed25519-Public-PEMs und eindeutige Principal-IDs sind erforderlich. Derselbe öffentliche Schlüssel darf auch mit abweichender PEM-Formatierung nicht als zweite Person auftreten. Rollen aus unbestätigten IdP-Claims oder aus dem Browser werden nicht gelesen. Das ist eine Offlineprüfung gegen vorgegebene Prüferwurzeln, keine implementierte SSO-Rollenintegration. Trustverteilung, OS-Schutz, Rotation/Widerruf und reale Personenprüfung fehlen weiterhin.

Die Attestations-Datei enthält ein Array signierter Envelopes `{keyId,payload,signature}`. Signiert wird JCS `{keyId,payload}` nach dem bestehenden Ledgervertrag. Payload:

```json
{
  "schemaVersion": 1,
  "kind": "thundy-acceptance-attestation",
  "planHash": "64stelliger_sha256",
  "checkId": "operator-region",
  "result": "pass",
  "environment": "live",
  "observedAt": "2026-10-14T20:00:00.000Z",
  "artifactHashes": ["64stelliger_sha256"]
}
```

Platzhalter müssen durch tatsächliche Hashes ersetzt werden. Nachweisdateien liegen ausschließlich als `HASH.evidence` im angegebenen Verzeichnis. Externe URLs werden nicht geladen. Maximal 100 Erklärungen/Authorities, zehn Artefakte je Erklärung, acht MiB pro Artefakt, höchstens 100 eindeutige Artefakte / 64 MiB insgesamt. Identische Hashes werden einmal pro Prüfung gelesen und geprüft. Hashes binden die Bytes; Dateiinhalte werden nicht in den minimierten Report kopiert. Betreiber müssen Rohbelege selbst minimieren und schützen.

```sh
npm run enterprise:acceptance -- check \
  --input /srv/review/acceptance-plan.json \
  --attestations /srv/review/attestations.json \
  --authorities /srv/trust/acceptance-authorities.json \
  --evidence-directory /srv/review/evidence \
  --out /srv/review/acceptance-readiness.json
```

Der Check prüft Signaturen, Organisation/Plan, erlaubte Rollen, eindeutige Erklärungen, unabhängige Principals/Public Keys, frische Live-Zeitangaben und exakt passende Dateien. Standardmaximalalter: 30 Tage. Falsche Signaturen, Simulationserklärungen, künftige/veraltete Zeiten, unbekannte Checks und abweichende Artefakte führen zum Fehler. Die Liste der acht Checks lässt sich nicht verkürzen.

Exitcodes: **0** Unterlagen vollständig zur manuellen Prüfung bzw. Draft/Probe erstellt; **2** Unterlagen fehlen oder ein Check ist gescheitert; **1** ungültige Eingabe/IO-/Signaturfehler. Ausgabe ist eine neue private Datei (0600); kein Überschreiben.

Auch bei Exit 0 bleiben `productionAccepted`, `sealed` und `extensionActivation` ausdrücklich falsch. `readyForManualReview` bedeutet nur vollständige, signierte Unterlagen. Der Checker führt keine Live-Probes, fachliche Prüfung, Infrastrukturänderung oder SEALED-Transition aus.

## Fortsetzung ohne fingierte Abnahme

1. Unternehmenskontext und freigegebene Region/Datengrenzen bereitstellen; gewünschte Profile bleiben frei kombinierbar.
2. Produktiven SEALED-/OIDC-/Rollen-/OS-Pfad implementieren und an konkrete Systeme anbinden, ohne lokale Testerfolge als Cloudannahme zu behandeln.
3. Die acht Checks tatsächlich mit getrennten Identitäten auf den Zielsystemen durchführen, Rohbelege hashen und unabhängig prüfen lassen.
4. Offline-Nachweisprüfung ausführen; anschließend erst die fachliche Abnahme und Pilotfreigabe festhalten.

Die autonome Arbeit hat N03–N05 lokal umgesetzt und für N06 diese prüfbare Vorbereitung geschaffen. N06 wird ausdrücklich **nicht als abgeschlossen** markiert.

## Erweiterter lokaler Teilnachweis

[Sechs native Sprachprofile, temporäres Paketupgrade und isolierter OS-Empfänger](THUNDERBIRD_LINUX_ABNAHME.md#fortsetzung-sprachen-upgrade-und-os-übergabe) wurden am 15. Oktober 2026 erfolgreich geprüft. Der stille HTTPS-Protokollsperrfall begrenzt die Aussage von `OPENED` auf die Annahme der Öffnungsanforderung durch Thunderbird. Dies ersetzt weiterhin weder vollständige OS-/Standardbrowser-Abnahme noch unabhängige signierte Operator-/Prüfererklärungen.
