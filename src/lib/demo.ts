import { Language } from '../types';
const copy = {
  "en": {
    "notice": "Web demo — synthetic decisions; no Thunderbird connection and no external analysis. Do not enter real API keys or confidential messages.",
    "proceed": "Simulate opening request",
    "cancel": "Simulate cancellation",
    "opened": "Simulated opening request recorded — no link opened",
    "aborted": "Simulated cancellation recorded",
    "data": "Simulation data only",
    "noProviders": "No external analysis is available in this demo."
  },
  "de": {
    "notice": "Webdemo — simulierte Entscheidungen; keine Thunderbird-Verbindung und keine externe Analyse. Keine echten API-Schlüssel oder vertraulichen Nachrichten eingeben.",
    "proceed": "Öffnungsanforderung simulieren",
    "cancel": "Abbruch simulieren",
    "opened": "Simulierte Öffnungsanforderung gespeichert — kein Link geöffnet",
    "aborted": "Simulierter Abbruch gespeichert",
    "data": "Nur Simulationsdaten",
    "noProviders": "In dieser Demo steht keine externe Analyse zur Verfügung."
  },
  "fr": {
    "notice": "Démo web — décisions simulées ; aucune connexion à Thunderbird ni analyse externe. Ne saisissez pas de clés API réelles ni de messages confidentiels.",
    "proceed": "Simuler une demande d’ouverture",
    "cancel": "Simuler une annulation",
    "opened": "Demande d’ouverture simulée enregistrée — aucun lien ouvert",
    "aborted": "Annulation simulée enregistrée",
    "data": "Données de simulation uniquement",
    "noProviders": "Aucune analyse externe n’est disponible dans cette démo."
  },
  "es": {
    "notice": "Demo web — decisiones simuladas; sin conexión a Thunderbird ni análisis externo. No introduzca claves API reales ni mensajes confidenciales.",
    "proceed": "Simular solicitud de apertura",
    "cancel": "Simular cancelación",
    "opened": "Solicitud de apertura simulada registrada — no se abrió ningún enlace",
    "aborted": "Cancelación simulada registrada",
    "data": "Solo datos de simulación",
    "noProviders": "Esta demo no ofrece análisis externo."
  },
  "it": {
    "notice": "Demo web — decisioni simulate; nessun collegamento a Thunderbird né analisi esterna. Non inserire chiavi API reali o messaggi riservati.",
    "proceed": "Simula richiesta di apertura",
    "cancel": "Simula annullamento",
    "opened": "Richiesta di apertura simulata registrata — nessun link aperto",
    "aborted": "Annullamento simulato registrato",
    "data": "Solo dati di simulazione",
    "noProviders": "L’analisi esterna non è disponibile in questa demo."
  },
  "pl": {
    "notice": "Demo internetowe — symulowane decyzje; bez połączenia z Thunderbirdem i analizy zewnętrznej. Nie wpisuj prawdziwych kluczy API ani poufnych wiadomości.",
    "proceed": "Symuluj żądanie otwarcia",
    "cancel": "Symuluj anulowanie",
    "opened": "Zapisano symulowane żądanie otwarcia — nie otwarto łącza",
    "aborted": "Zapisano symulowane anulowanie",
    "data": "Wyłącznie dane symulowane",
    "noProviders": "Analiza zewnętrzna nie jest dostępna w tym demo."
  }
};
export const demoText = (lang: Language, key: keyof typeof copy.en): string => copy[lang][key];
