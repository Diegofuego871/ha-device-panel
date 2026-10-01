/**
 * Texte des Panels, Deutsch und Englisch mit denselben Schlüsseln
 * (tests/test_translations.py prüft das).
 */
export const STRINGS = {
  de: {
    title: "Geräte",
    search: "In allen Spalten suchen…",
    total: "Geräte",
    online: "online",
    offline: "ausgefallen",
    colName: "Gerät",
    colArea: "Bereich",
    colIntegration: "Integration",
    colModel: "Hersteller / Modell",
    colSoftware: "Software",
    colStatus: "Status",
    statusOnline: "Online",
    statusOffline: "Ausgefallen",
    statusUnknown: "Keine Daten",
    loading: "Geräte werden geladen…",
    empty: "Keine Geräte gefunden.",
    error: "Laden fehlgeschlagen:",
  },
  en: {
    title: "Devices",
    search: "Search all columns…",
    total: "devices",
    online: "online",
    offline: "down",
    colName: "Device",
    colArea: "Area",
    colIntegration: "Integration",
    colModel: "Manufacturer / model",
    colSoftware: "Software",
    colStatus: "Status",
    statusOnline: "Online",
    statusOffline: "Down",
    statusUnknown: "No data",
    loading: "Loading devices…",
    empty: "No devices found.",
    error: "Loading failed:",
  },
};

export function pickLang(hass) {
  const lang = String((hass && (hass.locale?.language || hass.language)) || "en").toLowerCase();
  return lang === "de" || lang.startsWith("de-") ? "de" : "en";
}
