# Entscheidung: Daten-Deklaration und Consent (`data_collection_permissions`)

**Bezug:** Store-Readiness-Befund P0-4 / Aufgabe A-04 + A-14
**Gegenstand:** Wie muss die Datenübermittlung im Manifest deklariert werden, wenn sie ausschließlich nach
Opt-in erfolgt – und wie wird die Zustimmung in Thunderbird eingeholt?

## 1. Ausgangsproblem

`manifest.json` deklarierte ursprünglich:

```json
"data_collection_permissions": { "required": ["personalCommunications"] }
```

`required` bedeutet laut MDN und Extension Workshop: *„the data that the extension requires to be collected
and transmitted for its operation“* – der Nutzer muss zustimmen, um das Add-on nutzen zu können („cannot opt
out“). Thundy AV überträgt dagegen **nichts**, solange „Externe Analyse erlauben“ nicht aktiv ist
(`background.js`, `mayTransmitExternally()`/`assertExternalAnalysisAllowed()`), und alle lokalen Prüfungen
funktionieren ohne jede Übermittlung. Eine Pflicht-Deklaration war damit **nicht akkurat** (Policy 6.2.1:
*„It must accurately state the data collection practices in the extension manifest“*).

## 2. Belege

| Quelle | Aussage |
|---|---|
| `node_modules/addons-linter` (Validator, den AMO **und** ATN verwenden), Regel `NONE_DATA_COLLECTION_IS_EXCLUSIVE` | `if (requiredPermissions.includes('none') && requiredPermissions.length > 1) { addError(...) }` – `"none"` ist nur **innerhalb von `required`** unvereinbar mit anderen Typen. `required: ["none"]` **zusammen mit** `optional: [...]` ist ausdrücklich zulässig (empirisch mit `web-ext lint` in vier Manifest-Varianten geprüft). |
| `addons-linter`, Regel `MISSING_DATA_COLLECTION_PERMISSIONS` | Fehlt der Schlüssel ganz, warnt der Validator (Warning, kein Error). Der Schlüssel muss also vorhanden sein. |
| MDN `browser_specific_settings.gecko.data_collection_permissions` | `required` = zwingend zu akzeptieren (`none` **oder** eine Liste); `optional` = Daten, in die der Nutzer einwilligen **kann** – einzuholen über `permissions.request({ data_collection: [...] })`. |
| Thunderbird-API-Referenz, `permissions`-API (`CommonDataCollectionPermission`) | *„Unlike Firefox, Thunderbird does not use the built-in onboarding flow that prompts users to opt into data collection. In Thunderbird, add-ons must request consent explicitly, for example by adding a checkbox on the options page or by showing a popup. The application does not provide an automatic prompt.“* |
| Mozilla Add-on-Policies 6.2.1/6.2.2.1 | Manifest muss die Praxis akkurat abbilden; personenbezogene Daten dürfen nur nach ausdrücklicher Zustimmung übermittelt werden. |

## 3. Entscheidung

1. **Manifest:** `required: ["none"]`, `optional: ["personalCommunications"]`.
   Begründung: Für den Betrieb ist **keine** Datenübermittlung erforderlich (`none` = „nichts ist
   verpflichtend“), die Übermittlung von Nachrichteninhalten ist ein **Opt-in** und wird deshalb als
   `optional` deklariert. Das ist die einzige Kombination, die „nichts verpflichtend, aber etwas optional“
   abbildet, und sie ist vom Validator zugelassen.
2. **Runtime-Opt-in:** Beim Speichern der Einstellungen mit aktivem Schalter „Externe Analyse erlauben“ ruft
   `options.js` `browser.permissions.request({ data_collection: ['personalCommunications'] })` auf – im
   Klick-Handler des Speichern-Buttons, also in einer Nutzer-Geste. Lehnt der Nutzer den Dialog ab, bleibt
   `externalAnalysisConsent` auf `false` (es wird nichts übertragen). Beim Abschalten wird die Berechtigung
   über `permissions.remove({ data_collection: [...] })` zurückgegeben.
3. **Eigene Zustimmung bleibt maßgeblich:** Da Thunderbird keinen automatischen Prompt zeigt, bleibt der
   eigene Schalter (Default **aus**) die durchsetzende Instanz; die Plattform-Berechtigung ist eine
   zusätzliche, gleichgerichtete Bestätigung. Auf Plattformen ohne `data_collection`-Unterstützung
   (Fehler/`undefined`) läuft der Flow unverändert weiter.
4. **Hausregel angepasst:** `scripts/pre-submit-checks.js` verbot `"none"` + `optional` pauschal. Die Regel
   spiegelt jetzt exakt das Validator-Verhalten (Verbot nur innerhalb von `required`) und erzwingt zusätzlich,
   dass ein deklarierter optionaler Datentyp auch tatsächlich zur Laufzeit angefragt wird.

## 4. Bewusste Grenzen

- Die Deklaration ist eine **Auslegung** der Firefox-Taxonomie für Thunderbird, wo es keinen
  Installations-Prompt gibt. Sollte das ATN-Review `required: ["personalCommunications"]` verlangen (weil die
  Kernfunktion ohne Zustimmung nur eingeschränkt arbeitet), ist die Änderung eine Zeile in `manifest.json`
  plus Anpassung von `options.js` und dieser Datei.
- Die Optionsseiten-Checkbox ist laut Thunderbird-Doku ein **zulässiger** Ort für die Zustimmung. Die
  Mozilla-Policy 6.2.2 verlangt für Add-ons ohne eingebautes Consent-System zusätzlich eine *unmittelbar nach
  der Installation* sichtbare Kontrolle („unmissable“). Thunderbird stellt dafür keinen Mechanismus bereit;
  als Absicherung sind Consent-Status und Widerrufsweg in `options.html` unmittelbar oben platziert und die
  Datenschutzerklärung beschreibt den Ablauf (Abschnitt 3.1). Dieser Punkt bleibt offen für die
  Review-Rückmeldung (siehe Aufgabenplan A-31/A-32).

## 5. Vorbereiteter Text für eine Rückfrage beim ATN-Review

> **Question about `data_collection_permissions` for a Thunderbird add-on with opt-in transmission**
>
> Thundy AV runs all checks locally and transmits data only after the user enables "Allow external analysis"
> (default: off, revocable at any time). The manifest therefore declares
> `"data_collection_permissions": { "required": ["none"], "optional": ["personalCommunications"] }`
> and the options page requests the optional data collection permission
> (`permissions.request({ data_collection: ["personalCommunications"] })`) inside the save handler.
> Two questions:
> 1. Is `required: ["none"]` the correct way to state that no data collection is mandatory, given that
>    personal communications may be transmitted after an explicit opt-in?
> 2. Thunderbird has no built-in data collection onboarding flow (see your `permissions` API reference).
>    Is a consent checkbox on the options page, together with the consent description in the privacy policy,
>    sufficient for policy 6.2.2, or do you expect an additional first-run consent page?

