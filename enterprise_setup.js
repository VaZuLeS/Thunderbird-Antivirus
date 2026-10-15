// Local configuration drafts only: no external connection, scan or activation.
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id),
    t = (key) => ThundyI18n.get(key);
  const controls = {
    hosting: "profileHosting",
    sso: "profileSso",
    devices: "profileDevices",
    siem: "profileSiem",
    tickets: "profileTickets",
  };
  let draft,
    persisted,
    loaded = false,
    busy = false;
  for (const [category, id] of Object.entries(controls))
    for (const profile of ThundyEnterpriseProfiles.categories[category]) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent =
        profile.id === "none"
          ? t("profilesNone")
          : profile.id === "local-development"
            ? t("profilesLocal")
            : profile.id === "self-hosted"
              ? t("profilesSelfHosted")
              : profile.label;
      $(id).appendChild(option);
    }
  const categoryLabels = {
    hosting: "profilesHosting",
    sso: "profilesSso",
    devices: "profilesDevices",
    siem: "profilesSiem",
    tickets: "profilesTickets",
  };
  const selection = () =>
    Object.fromEntries(
      Object.entries(controls).map(([category, id]) => [category, $(id).value]),
    );
  const setSelection = (value) => {
    for (const [category, id] of Object.entries(controls))
      $(id).value = value[category];
  };
  const name = (category, value) =>
    [...$(controls[category]).options].find((o) => o.value === value)
      ?.textContent || value;
  function render() {
    try {
      draft = ThundyEnterpriseProfiles.buildDraft(selection());
      $("profilePreview").textContent = JSON.stringify(draft, null, 2);
      $("profileRequirements").replaceChildren();
      const requirements = [
        ...draft.readiness.requiredSettings,
        ...draft.readiness.secretReferences.map(
          (i) => i.category + ": " + i.reference,
        ),
      ];
      if (!requirements.length)
        requirements.push(t("profilesNoExternalSettings"));
      for (const text of requirements) {
        const li = document.createElement("li");
        li.textContent = text;
        $("profileRequirements").appendChild(li);
      }
    } catch (_) {
      draft = null;
      $("profileStatus").textContent = t("profilesFailed");
    }
    const changes = loaded
      ? Object.keys(controls).filter((k) => persisted[k] !== selection()[k])
      : [];
    $("profileDiff").replaceChildren();
    for (const category of changes) {
      const li = document.createElement("li");
      li.textContent =
        t(categoryLabels[category]) +
        ": " +
        name(category, persisted[category]) +
        " → " +
        name(category, selection()[category]);
      $("profileDiff").appendChild(li);
    }
    $("profileChanges").hidden = !changes.length;
    $("profileChangeState").textContent = t(
      !loaded
        ? "profilesNotLoaded"
        : changes.length
          ? "profilesUnsaved"
          : "profilesUnchanged",
    );
    $("profileDiscard").disabled = !changes.length || busy;
    $("profileSave").disabled = !loaded || !draft || busy;
    $("profileReset").disabled = !loaded || busy;
    $("profileLoadRetry").disabled = busy;
    $("profileExport").disabled = !loaded || !draft || busy;
    for (const id of ["profileBundle", ...Object.values(controls)])
      $(id).disabled = !loaded || busy;
  }
  async function load() {
    if (busy) return;
    busy = true;
    loaded = false;
    render();
    try {
      const stored = await browser.storage.local.get(
        "enterpriseProfileSelection",
      );
      persisted = ThundyEnterpriseProfiles.normalizeSelection(
        stored.enterpriseProfileSelection ||
          ThundyEnterpriseProfiles.bundles.local,
      );
      setSelection(persisted);
      $("profileBundle").value = stored.enterpriseProfileSelection
        ? "custom"
        : "local";
      loaded = true;
      $("profileLoadRetry").hidden = true;
      $("profileStatus").textContent = "";
    } catch (_) {
      $("profileStatus").textContent = t("profilesFailed");
      $("profileLoadRetry").hidden = false;
    } finally {
      busy = false;
      render();
    }
  }
  $("profileForm").addEventListener("submit", (e) => e.preventDefault());
  $("profileBundle").addEventListener("change", () => {
    const bundle = ThundyEnterpriseProfiles.bundles[$("profileBundle").value];
    if (bundle) setSelection(bundle);
    render();
  });
  for (const id of Object.values(controls))
    $(id).addEventListener("change", () => {
      $("profileBundle").value = "custom";
      render();
    });
  $("profileSave").addEventListener("click", async () => {
    if (!loaded || !draft || busy) return;
    const current = selection();
    busy = true;
    render();
    $("profileStatus").textContent = t("profilesSaving");
    try {
      await browser.storage.local.set({ enterpriseProfileSelection: current });
      persisted = current;
      $("profileStatus").textContent = t("profilesSaved");
    } catch (_) {
      $("profileStatus").textContent = t("profilesFailed");
    } finally {
      busy = false;
      render();
    }
  });
  $("profileDiscard").addEventListener("click", () => {
    if (!loaded || busy) return;
    setSelection(persisted);
    $("profileBundle").value = "custom";
    render();
  });
  $("profileLoadRetry").addEventListener("click", load);
  $("profileExport").addEventListener("click", async () => {
    if (!draft || busy) return;
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(draft, null, 2)], {
          type: "application/json",
        }),
      );
      try {
        await browser.downloads.download({
          url,
          filename: "thundy-enterprise-profile.json",
          saveAs: true,
        });
      } finally {
        URL.revokeObjectURL(url);
      }
      $("profileStatus").textContent = t("profilesExported");
    } catch (_) {
      $("profileStatus").textContent = t("profilesFailed");
    }
  });
  $("profileReset").addEventListener("click", async () => {
    if (!loaded || busy) return;
    busy = true;
    render();
    try {
      await browser.storage.local.remove("enterpriseProfileSelection");
      persisted = { ...ThundyEnterpriseProfiles.bundles.local };
      setSelection(persisted);
      $("profileBundle").value = "local";
      $("profileStatus").textContent = t("profilesSaved");
    } catch (_) {
      $("profileStatus").textContent = t("profilesFailed");
    } finally {
      busy = false;
      render();
    }
  });
  setSelection(ThundyEnterpriseProfiles.bundles.local);
  await load();
});
