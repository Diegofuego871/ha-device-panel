# Zwischenstände

Arbeit, die auf einen Entscheid des Nutzers wartet und noch nicht in den
Code gehört (sonst landete sie in einem Tag auf `main`).

- `battery-off-backend.patch`: Batterie-Warnung für eine ganze Integration
  aus (`battery_low_integrations` mit `"off"`, auch `False` aus YAML 1.1;
  `battery_threshold` liefert dann None; Optionsdialog-Texte; Tests in
  `tests/test_battery.py` und `tests/test_update_check.py`). Geprüft: alle
  Python-Tests grün. Wartet auf die Wahl der Darstellung im Panel
  (`docs/mockups/battery-v2/`). Anwenden mit
  `git apply docs/wip/battery-off-backend.patch`, danach diese Datei und den
  Patch löschen.
