# Einrichtung auf GitHub

1. Auf GitHub neues Repository `Diegofuego871/ha-device-panel` anlegen:
   öffentlich (HACS verlangt das), **ohne** README, .gitignore oder Lizenz
   (sind im Kit enthalten).
2. Kit entpacken und ersten Commit pushen:

   ```bash
   unzip ha-device-panel-starter.zip && cd ha-device-panel
   git init -b main
   git add .
   git commit -m "0.1.0: Projektstart"
   git remote add origin https://github.com/Diegofuego871/ha-device-panel.git
   git push -u origin main
   ```

3. Repository-Einstellungen:
   - About → Beschreibung eintragen, Topics `home-assistant`, `hacs`,
     `integration`, `home-assistant-custom` (prüft die HACS-Action).
   - Actions → aktiviert lassen; nach dem Push müssen "Validate" und
     "Tests" grün sein.
   - Issues aktiviert (wird in `manifest.json` verlinkt).
4. Brand-Icon: `custom_components/device_panel/brand/icon.png` (256 × 256)
   und `logo.png` ergänzen. Fehlt es, meldet hassfest/HACS eine Warnung.
5. Erstes Release: Tag `v0.1.0` → GitHub "Create release", Text aus dem
   CHANGELOG.
6. In HA: HACS → Benutzerdefinierte Repositories → URL, Typ "Integration".
7. Claude Code: neue Session auf `Diegofuego871/ha-device-panel` starten
   (claude.ai/code, Repo im GitHub-Zugriff freigeben). Erste Nachricht z. B.:
   "Lies CLAUDE.md und docs/. Wir entscheiden zuerst die offenen Punkte aus
   CONCEPT.md, mit Mockups."
