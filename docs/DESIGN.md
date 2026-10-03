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
- Push-Meldungen haben ein eigenes Bild: `push/icon.png` 512 × 512 aus
  `docs/brand/push.svg` (dieselben Pfade, `viewBox="-4 -4 264 264"`, also
  rund 20 % Rand). iOS schneidet es in ein abgerundetes Quadrat, Android oft
  rund; das Brand-Icon selbst bleibt knapp zugeschnitten.

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
- Toasts für Bestätigungen, Fehler im Dialog selbst, nicht als Toast. In
  einem offenen Dialog auch die Bestätigung im Dialog (Einstellungen:
  "Gespeichert" in Grün neben den Knöpfen, seit 0.15.0); ein Toast läge
  hinter dem modalen Dialog.
- Alles mit Tastatur bedienbar, `aria-label` auf Symbolknöpfen.
- Filter-Chips (seit 0.17.0): Zahl = Zeilen nach dem Antippen (mit Suche
  und übrigen Filtern), Chip mit 0 bleibt stehen und ist gedämpft
  (`.chip.zero`, Deckkraft 0.55), zweiter Tipp auf einen aktiven Chip wählt
  ihn ab. Seit 0.25.0 (Wunsch des Nutzers) hebt "Alle" alle Filter auf
  (Bereich, Verbindungsart, "Nur Probleme", Hinweise; die Suche bleibt),
  ist nur ohne Filter hervorgehoben und zählt alle Geräte. Suchfeld mit eigenem X (`.search-clear`, nur mit Eingabe; das X
  des Browsers ist ausgeblendet, iOS zeigt keines).
- Ansicht (seit 0.19.0, `docs/mockups/view-v1/`): Desktop Knopf "Spalten"
  (Pille mit Symbol) öffnet seit 0.26.0 den Dialog "Anpassen" wie in HA
  (`docs/mockups/customize-v1/`, A; vorher ein Popover): Kopf mit Symbol,
  Titel und Kurzzeile, Hinweis zu Auge und Griff, Zeile "Gerät · immer
  sichtbar" mit grauem Auge, darunter die Spalten mit Griff, Name und Auge
  (ausgeblendet: Name grau, Auge durchgestrichen, ohne Griff), unten
  "Standard wiederherstellen" als Textknopf links und "Fertig" rechts.
  Klick auf den Hintergrund oder Escape schliesst. Spaltenkopf als Knopf: Sortiersymbol erscheint beim
  Darüberfahren, die sortierte Spalte in Primärfarbe mit Pfeil.
  "Gruppen | Liste" als Segment rechts in der Chip-Zeile. Handy: runder
  Knopf neben der Suche, Zeile "Sortiert nach" unter den Chips, Blatt
  "Ansicht" (Sortier-Pillen, Richtung, Darstellung, Angaben mit Griff und
  Auge, "Standard wiederherstellen" und "Fertig" wie im Dialog).
- Kopf-Kacheln gleich hoch, auch auf dem Handy (Zeile mit `stretch`); der
  Ring bleibt fest und steht in seiner Kachel mittig.
- Tabellen mit mehreren Schaltern pro Zeile (seit 0.20.0, Integrationen:
  "Anzeigen", "Push", "Anhaltend"): Spalten fester Breite (`.ex-col`,
  72 px, Handy 52 px), Kopf in Grossbuchstaben, darunter "Alle umschalten"
  je Spalte; ausgeblendete Zeile sperrt die übrigen Schalter (gedämpft).
- Verlauf als Kurs (seit 0.22.0, Fenster "Batterie"): Fläche und Linie in
  Primärfarbe, Gitter bei 0/50/100 %, Schwelle rot gestrichelt mit Text
  links, Wechsel grau gestrichelt mit Text oben, Punkt mit Hof am Ende
  ("jetzt"). Gleicher Rahmen wie "Verfügbarkeit" (Zeitraum oben, Kennzahl
  gross, Liste unten, Quelle als Kurzzeile).
- Markierung "Neu" (seit 0.21.0): kleines Etikett beim Namen in Grün
  (`--dp-success`, wie "online"), damit es sich von den blauen Symbolen der
  eigenen Einstellungen abhebt; Chip "Neu" mit Funkel-Symbol in Grün.
- Vorschau einer Meldung (seit 0.20.0, "Inhalt der Meldung"): Karte wie
  eine Benachrichtigung auf dem Handy (App-Zeile mit Logo, Titel fett,
  Text, Knöpfe in Primärfarbe), darunter eine Kurzzeile. Schalter des
  Inhalts in zwei Spalten, auf dem Handy in einer.
- Filter "Bereich" (seit 0.23.0, `docs/mockups/area-v1/`, A): Chip mit
  Haus-Symbol am Anfang der Chip-Zeile, danach ein Trennstrich. Ohne Wahl
  "Bereich" mit Pfeil nach unten; aktiv in Primärfarbe mit Name (Etage,
  ein oder zwei Bereiche, sonst "3 Bereiche"), Zahl der Zeilen und rundem
  × zum Aufheben. Desktop: Popover unter dem Chip (330 px, höchstens bis
  12 px über den unteren Rand), Handy: Blatt wie "Ansicht" mit "Alle
  zeigen" und "Fertig". Etage als Überschrift in Grossbuchstaben mit
  Kästchen (voll, halb mit Strich, leer), Bereiche eingerückt mit Zahl
  rechts; die ganze Zeile ist der Knopf (`role="checkbox"`).
- Batterie (seit 0.24.0): Symbol mit Füllstand (Innenraum des Umrisses)
  in den vier Farben des Empfangs: grün über 50 %, gelbgrün bis 50 %,
  orange bis 30 %, rot (`--dp-error`, wie der Text) bei "schwach" nach der
  Batterie-Warnung. Ohne Prozent rot oder grün. Text bleibt neutral, ausser
  bei "schwach".
- Empfangsverlauf (seit 0.24.0): Rahmen wie "Batterie" (Kennzahl gross mit
  Balken, Fakten Median/schlechtester/bester, Kurs, Ticks, Quelle als
  Kurzzeile). Achse nur Zahlen (dBm -100 bis -40, weiter bei Bedarf; LQI
  0–255), Schwelle der Empfang-Warnung rot gestrichelt mit Text auf
  hinterlegtem Feld. Aus der eigenen Aufzeichnung zusätzlich die Spanne als
  helle Fläche mit Legende und Lücken; aus dem Verlauf des Recorders eine
  Treppe (Zustände gelten bis zum nächsten Wechsel).
- Puls-Fenster (seit 0.26.0, `docs/mockups/pulse-v1/`, A): Kachel
  "Ausfall-Puls" mit Unterbrüchen antippbar (Pfeil rechts im Titel,
  Zusammenfassung als Link). Fenster wie "Verfügbarkeit" (560 px, Handy
  als Blatt): Titel "Unterbrüche in 24 Std.", Kurzzeile mit Anzahl,
  Geräten und Dauer, Puls gross (130 px, Handy 96 px) mit Abschnitten zum
  Antippen (gewählter Abschnitt hinterlegt, darüber eine Pille mit × zum
  Aufheben), darunter die Geräte als Zeilen (Symbol, Name, "ausgefallen"
  als kleine rote Pille, Bereich · Integration; rechts Anzahl fett, Dauer
  und Streifen über 24 Std.).
- Fixierter Kopf auf dem Handy (seit 0.28.0, `docs/mockups/fixed-v1/`, C,
  Wunsch des Nutzers: nur die Liste scrollt): Sind die Kacheln unter der
  Zeile weggescrollt, steht oben eine Zeile (44 px, `.hstrip`/`.hs-in`:
  "N von M online", rot "N ausgefallen" oder grün "Alles online", Bereich,
  Pfeil nach oben; Tipp scrollt zurück), darunter die Chips (48 px) und die
  Sortierung, beide `position: sticky` mit deckendem Hintergrund. Ein
  `IntersectionObserver` auf `.hero` (Rand oben 44 px) setzt `hs-on` am
  `.content`. Die Höhen sind fest, weil die Versätze der Sticky-Elemente
  davon abhängen. Desktop unverändert.
- Kopf mit Filter "Bereich" (seit 0.26.0): Name der Auswahl hinter dem
  Titel jeder Kachel ("· Küche") in Primärfarbe, gekürzt mit "…". In der
  Ring-Kachel (schmale Textspalte) rutscht er unter den Titel, wenn er
  daneben keinen Platz hat.
- Ausblenden (seit 0.23.0, `docs/mockups/hide-v1/`, A): im Geräte-Popup
  unten zwei gleich breite Knöpfe "Gerät ausblenden" (seit 0.27.0, vorher
  "Ausblenden"; Auge durchgestrichen) und
  "Schliessen". Danach Hinweis unten mit Text und Aktion "Rückgängig"
  (helles Blau auf dunkel, 8 s statt 3,5 s). Fehler im Popup selbst.
- Reihenfolge per Ziehen (seit 0.13.0, Chips der Verbindungsart): Griff
  (zwei Reihen Punkte) links in der Zeile, Zeile hebt sich beim Ziehen ab
  (`.lift`, Schatten); Pfeiltasten auf dem Griff verschieben um eine
  Position. Daneben ein Knopf zurück zur Standard-Reihenfolge.

## Vorgehen bei neuen Ansichten

Erst Mockup (HTML, erfundene Daten, Desktop und Handy, 2–4 Varianten mit
Empfehlung), Nutzer wählt, dann umsetzen und mit Screenshots aus dem
HA-Nachbau prüfen.
