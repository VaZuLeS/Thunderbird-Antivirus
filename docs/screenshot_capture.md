Screenshot capture guide — Thundy AV (Thunderbird WebExtension)

This guide explains how to capture real screenshots from a running Thunderbird instance for the store listing.

Prerequisites
- Thunderbird (version compatible with manifest strict_min_version)
- web-ext (optional) or the ability to load the extension as a temporary add-on
- A test mailbox with at least one message containing an attachment or link
- Optional: geckodriver + Selenium if automating captures

Manual capture (recommended)
1. Build the extension XPI: npx web-ext build --source-dir . --artifacts-dir ./build
2. Open Thunderbird -> Tools -> Add-ons and Themes -> Debug Add-ons (about:debugging) and "Load Temporary Add-on"; select the manifest.json or built XPI.
3. Open a message that contains an attachment or a link you want to show in the screenshot.
4. If scanning is disabled for that sender, the per-message banner should appear near the top of the message view. Click the button to trigger the scan UI and wait for results (or mock results in a dev build).
5. Use your OS screenshot tool (PrtSc / Snipping Tool on Windows, Screenshot on macOS, or gnome-screenshot on Linux) to capture:
   - Inline banner (wide screenshot, 1200x600 recommended)
   - Warning banner (wide screenshot)
   - Options page (full-page screenshot)
6. Save images to docs/screenshots/ with descriptive filenames: screenshot-1-inline-optin.png, screenshot-2-warning.png, screenshot-3-options.png

Automated capture (advanced)
- Use a Selenium + geckodriver script that launches Thunderbird with the extension installed and takes screenshots of the message view. This requires configuring Thunderbird profile paths and enabling remote debugging.
- Alternatively, run the extension in a debug Firefox profile via web-ext run --target firefox and capture the in-browser UI; note that Thunderbird UI differs from Firefox and in-app screenshots may not fully match.

Best practices for store images
- Provide 3–4 images, 1200px wide, PNG format, with clear annotations explaining the UI action (e.g., "One‑click per‑message scan").
- Avoid including real user data in screenshots — redact sensitive email addresses and message contents.
- Show the Opt‑In banner and a warning banner (if the app reports a threat) and the Options page showing the per-account toggle.

If you'd like, I can:
- Generate example PNGs from the SVG placeholders (quick, but not real captures), or
- Attempt an automated capture using web-ext run + a headless browser (will not match Thunderbird UI perfectly).

--
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>