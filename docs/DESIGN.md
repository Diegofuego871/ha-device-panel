# Design

Gleiche Gestaltung wie "UniFi Dynamic Clients": ruhig, HA-nah, hell und
dunkel über die Theme-Variablen von Home Assistant. Referenz zum Anschauen:
die Screenshots in Diegofuego871/unifi_dynamic (`docs/`).

## Farben (CSS-Variablen, Präfix `--dp-`)

```css
:host {
  --dp-card: var(--card-background-color, #fff);
  --dp-text: var(--primary-text-color, #212121);
  --dp-text2: var(--secondary-text-color, #727272);
  --dp-text3: var(--disabled-text-color, #9e9e9e);
  --dp-divider: var(--divider-color, rgba(0,0,0,0.12));
  --dp-primary: var(--primary-color, #03a9f4);
  --dp-success: var(--success-color, #43a047);
  --dp-warning: var(--warning-color, #ff9800);
  --dp-error: var(--error-color, #db4437);
  --dp-hover: color-mix(in srgb, var(--dp-text) 5%, var(--dp-card));
  --dp-subtle: color-mix(in srgb, var(--dp-text) 4%, var(--dp-card));
  --dp-sec-open: color-mix(in srgb, var(--dp-text) 4.5%, var(--dp-card));
  --dp-sec-head: color-mix(in srgb, var(--dp-text) 9.5%, var(--dp-card));
  --dp-primary-soft: color-mix(in srgb, var(--dp-primary) 14%, transparent);
  --dp-success-soft: color-mix(in srgb, var(--dp-success) 16%, transparent);
  --dp-warning-soft: color-mix(in srgb, var(--dp-warning) 16%, transparent);
  --dp-input: var(--primary-background-color, #fff);
  --dp-shadow: 0 10px 30px rgba(0,0,0,0.25);
  /* Stufen (gut -> schlecht), wie Ping/WLAN in unifi_dynamic */
  --dp-tier5: #4caf50;
  --dp-tier4: #8bc34a;
  --dp-tier3: #eba43f;
  --dp-tier2: #a37fe0;
  --dp-tier1: #e5625f;
}
```

Status: online = `--dp-success` (Punkt + Pill "Verbunden"), ausgefallen =
`--dp-error`, keine Daten = `--dp-text3`, Unterbruch im Zeitstrahl orange
(`--dp-warning`).

## Formen und Abstände

- Karten/Dialoge: Radius 16–22 px, Schatten `--dp-shadow`, Innenabstand
  20 px (Handy 12–16 px).
- Tabelle als Karte: `border-collapse: separate`, Radius 16 px, Kopfzeile
  38 px, Kopftexte 12 px, Grossbuchstaben, `letter-spacing: 0.03em`,
  Farbe `--dp-text2`.
- Knöpfe: Pill-Form, 36 px rund für Symbolknöpfe (X, Zahnrad).
- Segment-Schalter (Zeitraum, Tabs): Hintergrund `--dp-subtle`, aktives
  Segment Karte mit leichtem Schatten.
- Einstellungen, aufgeklappter Abschnitt (seit 0.9.0, Wunsch des Nutzers):
  Kopf `--dp-sec-head`, Titel fett, Inhalt `--dp-sec-open`, Rand kräftiger;
  getönte Flächen darin (Info, "Alle umschalten", Typ-Symbol) eine Stufe
  dunkler (`--dp-sec-head`). Felder bleiben in der Kartenfarbe.
- Einstellung pro Gerät (seit 0.10.0): kleine Marke `.ovr` beim Namen,
  Hintergrund `--dp-primary-soft`, Symbol und Text `--dp-primary` (wie
  "geändert"), je Art ein Symbol: Batterie mit Wert, Batterie
  durchgestrichen, Glocke durchgestrichen. In den Einstellungen Liste
  `.ovr-list` wie die Schwellen pro Integration, markierte Zeilen mit
  durchgestrichenem Wert "→ global" und Rückgängig-Symbol.
- Kacheln: Titel 12 px `--dp-text2`, Wert 20–24 px, Untertitel 12 px,
  Chevron unten rechts, wenn antippbar.
- Kopf von Dialogen: Avatar 44–52 px (Radius 13–15 px, `--dp-primary-soft`,
  Symbol in `--dp-primary`), Titel 21 px, Untertitel 13 px, X rechts.
- Symbole: Material Design Icons als SVG-Pfade im Code (kein ha-icon im
  iframe).

## Icon und Logo

- Variante "D mit Puls": Buchstabe D mit Herzschlag, gleiches Prinzip wie das
  U mit WLAN-Bögen bei UniFi Dynamic Clients. Verlauf `#7ADFFD` → `#22A9F9`
  → `#1C7DF9` von oben links nach unten rechts, transparenter Hintergrund.
- Logo: Icon oben, darunter "Device" (Montserrat 700, Verlauf `#5BD6FC` →
  `#1C7DF9`) und "Panel" (Montserrat 500, `#4A5569`).
- Quellen: `docs/brand/icon.svg`, `docs/brand/logo.svg` (das Logo braucht
  die Schrift Montserrat, OFL). Daraus `brand/icon.png` 256 × 256,
  `icon@2x.png` 512 × 512, `logo.png` 256 × 295, `logo@2x.png` 512 × 590,
  gerendert mit Chromium (transparenter Hintergrund). `tests/test_brand.py`
  prüft Masse und Alphakanal.
- `brand/icon.png` ist zugleich das Bild der Push-Meldungen.

## Layout

- Werkzeugleiste: Logo, Suchfeld ("In allen Spalten suchen…"), Filter,
  Spalten, Zahnrad. Darunter Zähler-Leiste als Segment (Alle / online /
  ausgefallen).
- Breite < 600 px: Werkzeugleiste kompakt, Dialoge als Blatt von unten (86 %
  Höhe), Tabs mit Kurzbeschriftung, Spalten-/Filterwahl als Blatt.
- Erste Spalte (Name) bleibt beim horizontalen Scrollen stehen.

## Interaktion

- Tipp auf Zeile → Geräteansicht. Tipp auf Kachel → Statistik-Fenster mit
  Tabs und Zeitraum (gemeinsam, pro Benutzer gemerkt).
- Ladeanimationen (Loader) wählbar, mit gemeinsamem Takt, damit Neuaufbau
  sie nicht neu startet.
- Toasts für Bestätigungen, Fehler im Dialog selbst, nicht als Toast.
- Alles mit Tastatur bedienbar, `aria-label` auf Symbolknöpfen.
- Reihenfolge per Ziehen (seit 0.13.0, Chips der Verbindungsart): Griff
  (zwei Reihen Punkte) links in der Zeile, Zeile hebt sich beim Ziehen ab
  (`.lift`, Schatten); Pfeiltasten auf dem Griff verschieben um eine
  Position. Daneben ein Knopf zurück zur Standard-Reihenfolge.

## Vorgehen bei neuen Ansichten

Erst Mockup (HTML, erfundene Daten, Desktop und Handy, 2–4 Varianten mit
Empfehlung), Nutzer wählt, dann umsetzen und mit Screenshots aus dem
HA-Nachbau prüfen.
