# Brands-Eintrag für den HACS-Katalog

HACS und der Eintrag "Device Panel Update" in Home Assistant holen das Symbol von `https://brands.home-assistant.io/_/device_panel/icon.png`. Dieser Pfad liefert nur, was im Repository `home-assistant/brands` unter `custom_integrations/device_panel/` liegt; das lokale `brand/` der Integration genügt dafür nicht (Stand 2026-10-24: der Pfad gibt "icon not available").

Der Ordner `custom_integrations/device_panel/` hier ist 1:1 die Vorlage für einen Pull Request an `home-assistant/brands` (gleiche Dateien wie `custom_components/device_panel/brand/`: `icon.png` 256 px, `icon@2x.png` 512 px, `logo.png`, `logo@2x.png`).
