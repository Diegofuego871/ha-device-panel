// Mockups launcher-v2 (Entscheid des Nutzers zu launcher-v1, 2026-10-13): Raster auf dem Desktop; Favoriten und eigene Apps pro Benutzer;
// auf dem Handy nur der OBERSTE Favorit in der Kopfzeile (ein Strich im Launcher zeigt die Grenze); Protokoll nur noch im Launcher;
// vorinstallierte Links lassen sich ausblenden (Auge); Bearbeiten-Modus mit Ziehen zum Sortieren in allen Gruppen.
//   1: Launcher normal (Desktop): Favoriten mit Strich nach dem ersten; Handy-Blatt mit Kopfzeile (nur der oberste Favorit)
//   2: Bearbeiten-Modus (Desktop): Ziehgriff, Auge, Herz; Favorit wird gezogen; Strich "Handy: nur der oberste"
//   3: Bearbeiten-Modus (Handy)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/launcher-v2/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
import { mkdirSync } from "node:fs";
const { page, compose, close } = await setup(8997, import.meta.url);
const tmp = new URL("./out/", import.meta.url).pathname;
mkdirSync(tmp, { recursive: true });

const P = {
 "apps": "M3 11H11V3H3M5 5H9V9H5M13 21H21V13H13M15 15H19V19H15M3 21H11V13H3M5 15H9V19H5M13 3V11H21V3M19 9H15V5H19Z",
 "dots": "M12 16C13.1 16 14 16.9 14 18S13.1 20 12 20 10 19.1 10 18 10.9 16 12 16M12 10C13.1 10 14 10.9 14 12S13.1 14 12 14 10 13.1 10 12 10.9 10 12 10M12 4C13.1 4 14 4.9 14 6S13.1 8 12 8 10 7.1 10 6 10.9 4 12 4M6 16C7.1 16 8 16.9 8 18S7.1 20 6 20 4 19.1 4 18 4.9 16 6 16M6 10C7.1 10 8 10.9 8 12S7.1 14 6 14 4 13.1 4 12 4.9 10 6 10M6 4C7.1 4 8 4.9 8 6S7.1 8 6 8 4 7.1 4 6 4.9 4 6 4M18 16C19.1 16 20 16.9 20 18S19.1 20 18 20 16 19.1 16 18 16.9 16 18 16M18 10C19.1 10 20 10.9 20 12S19.1 14 18 14 16 13.1 16 12 16.9 10 18 10M18 4C19.1 4 20 4.9 20 6S19.1 8 18 8 16 7.1 16 6 16.9 4 18 4Z",
 "timer": "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
 "bell": "M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M17,11A5,5 0 0,0 12,6A5,5 0 0,0 7,11V18H17V11M19.75,3.19L18.33,4.61C20.04,6.3 21,8.6 21,11H23C23,8.07 21.84,5.25 19.75,3.19M1,11H3C3,8.6 3.96,6.3 5.67,4.61L4.25,3.19C2.16,5.25 1,8.07 1,11Z",
 "log": "M5,3C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3H5M5,5H19V19H5V5M7,7V9H17V7H7M7,11V13H17V11H7M7,15V17H14V15H7Z",
 "robot": "M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z",
 "palette": "M12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2C17.5,2 22,6 22,11A6,6 0 0,1 16,17H14.2C13.9,17 13.7,17.2 13.7,17.5C13.7,17.6 13.8,17.7 13.8,17.8C14.2,18.3 14.4,18.9 14.4,19.5C14.5,20.9 13.4,22 12,22M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C12.3,20 12.5,19.8 12.5,19.5C12.5,19.3 12.4,19.2 12.4,19.1C12,18.6 11.8,18.1 11.8,17.5C11.8,16.1 12.9,15 14.3,15H16A4,4 0 0,0 20,11C20,7.1 16.4,4 12,4M6.5,10C7.3,10 8,10.7 8,11.5C8,12.3 7.3,13 6.5,13C5.7,13 5,12.3 5,11.5C5,10.7 5.7,10 6.5,10M9.5,6C10.3,6 11,6.7 11,7.5C11,8.3 10.3,9 9.5,9C8.7,9 8,8.3 8,7.5C8,6.7 8.7,6 9.5,6M14.5,6C15.3,6 16,6.7 16,7.5C16,8.3 15.3,9 14.5,9C13.7,9 13,8.3 13,7.5C13,6.7 13.7,6 14.5,6M17.5,10C18.3,10 19,10.7 19,11.5C19,12.3 18.3,13 17.5,13C16.7,13 16,12.3 16,11.5C16,10.7 16.7,10 17.5,10Z",
 "script": "M15,20A1,1 0 0,0 16,19V4H8A1,1 0 0,0 7,5V16H5V5A3,3 0 0,1 8,2H19A3,3 0 0,1 22,5V6H20V5A1,1 0 0,0 19,4A1,1 0 0,0 18,5V9L18,19A3,3 0 0,1 15,22H5A3,3 0 0,1 2,19V18H13A2,2 0 0,0 15,20M9,6H14V8H9V6M9,10H14V12H9V10M9,14H14V16H9V14Z",
 "tools": "M13.78 15.3L19.78 21.3L21.89 19.14L15.89 13.14L13.78 15.3M17.5 10.1C17.11 10.1 16.69 10.05 16.36 9.91L4.97 21.25L2.86 19.14L10.27 11.74L8.5 9.96L7.78 10.66L6.33 9.25V12.11L5.63 12.81L2.11 9.25L2.81 8.55H5.62L4.22 7.14L7.78 3.58C8.95 2.41 10.83 2.41 12 3.58L9.89 5.74L11.3 7.14L10.59 7.85L12.38 9.63L14.2 7.75C14.06 7.42 14 7 14 6.63C14 4.66 15.56 3.11 17.5 3.11C18.09 3.11 18.61 3.25 19.08 3.53L16.41 6.2L17.91 7.7L20.58 5.03C20.86 5.5 21 6 21 6.63C21 8.55 19.45 10.1 17.5 10.1Z",
 "history": "M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17M19 19H5V5H19V19.1M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z",
 "logbook": "M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z",
 "devices": "M3 6H21V4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H7V18H3V6M13 12H9V13.78C8.39 14.33 8 15.11 8 16C8 16.89 8.39 17.67 9 18.22V20H13V18.22C13.61 17.67 14 16.88 14 16S13.61 14.33 13 13.78V12M11 17.5C10.17 17.5 9.5 16.83 9.5 16S10.17 14.5 11 14.5 12.5 15.17 12.5 16 11.83 17.5 11 17.5M22 8H16C15.5 8 15 8.5 15 9V19C15 19.5 15.5 20 16 20H22C22.5 20 23 19.5 23 19V9C23 8.5 22.5 8 22 8M21 18H17V10H21V18Z",
 "shape": "M11,13.5V21.5H3V13.5H11M9,15.5H5V19.5H9V15.5M12,2L17.5,11H6.5L12,2M12,5.86L10.08,9H13.92L12,5.86M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13M17.5,15A2.5,2.5 0 0,0 15,17.5A2.5,2.5 0 0,0 17.5,20A2.5,2.5 0 0,0 20,17.5A2.5,2.5 0 0,0 17.5,15Z",
 "puzzle": "M22,13.5C22,15.26 20.7,16.72 19,16.96V20A2,2 0 0,1 17,22H13.2V21.7A2.7,2.7 0 0,0 10.5,19C9,19 7.8,20.21 7.8,21.7V22H4A2,2 0 0,1 2,20V16.2H2.3C3.79,16.2 5,15 5,13.5C5,12 3.79,10.8 2.3,10.8H2V7A2,2 0 0,1 4,5H7.04C7.28,3.3 8.74,2 10.5,2C12.26,2 13.72,3.3 13.96,5H17A2,2 0 0,1 19,7V10.04C20.7,10.28 22,11.74 22,13.5M17,15H18.5A1.5,1.5 0 0,0 20,13.5A1.5,1.5 0 0,0 18.5,12H17V7H12V5.5A1.5,1.5 0 0,0 10.5,4A1.5,1.5 0 0,0 9,5.5V7H4V9.12C5.76,9.8 7,11.5 7,13.5C7,15.5 5.75,17.2 4,17.88V20H6.12C6.8,18.25 8.5,17 10.5,17C12.5,17 14.2,18.25 14.88,20H17V15Z",
 "tune": "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
 "cog": "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z",
 "bolt": "M11 15H6L13 1V9H18L11 23V15Z",
 "map": "M20.5,3L20.34,3.03L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21L3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19.03 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3M10,5.47L14,6.87V18.53L10,17.13V5.47M5,6.46L8,5.45V17.15L5,18.31V6.46M19,17.54L16,18.55V6.86L19,5.7V17.54Z",
 "plus": "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
 "heart": "M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z",
 "heartO": "M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z",
 "pencil": "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
 "link": "M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z",
 "web": "M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
 "close": "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
 "drag": "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
 "search": "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
 "bug": "M20,8H17.19C16.74,7.2 16.12,6.5 15.37,6L17,4.41L15.59,3L13.42,5.17C12.96,5.06 12.5,5 12,5C11.5,5 11.05,5.06 10.59,5.17L8.41,3L7,4.41L8.62,6C7.87,6.5 7.26,7.21 6.81,8H4V10H6.09C6.03,10.33 6,10.66 6,11V12H4V14H6V15C6,15.34 6.03,15.67 6.09,16H4V18H6.81C8.47,20.87 12.14,21.84 15,20.18C15.91,19.66 16.67,18.9 17.19,18H20V16H17.91C17.97,15.67 18,15.34 18,15V14H20V12H18V11C18,10.66 17.97,10.33 17.91,10H20V8M16,15A4,4 0 0,1 12,19A4,4 0 0,1 8,15V11A4,4 0 0,1 12,7A4,4 0 0,1 16,11V15M14,10V12H10V10H14M10,14H14V16H10V14Z",
 "store": "M18.36 9L18.96 12H5.04L5.64 9H18.36M20 4H4V6H20V4M20 7H4L3 12V14H4V20H14V14H18V20H20V14H21V12L20 7M6 18V14H12V18H6Z",
 "home": "M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22",
 "chev": "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
 "cam": "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z",
 "bar": "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z",
 "wrench": "M22.61,19L13.53,9.91C14.46,7.57 14,4.81 12.09,2.91C9.79,0.61 6.21,0.4 3.66,2.26L7.5,6.11L6.08,7.5L2.25,3.69C0.39,6.23 0.6,9.82 2.9,12.11C4.76,13.97 7.47,14.46 9.79,13.59L18.9,22.7C19.29,23.09 19.92,23.09 20.31,22.7L22.61,20.4C23,20 23,19.39 22.61,19M19.61,20.59L10.15,11.13C9.54,11.58 8.86,11.85 8.15,11.95C6.79,12.15 5.36,11.74 4.32,10.7C3.37,9.76 2.93,8.5 3,7.26L6.09,10.35L10.33,6.11L7.24,3C8.5,2.95 9.73,3.39 10.68,4.33C11.76,5.41 12.17,6.9 11.92,8.29C11.8,9 11.5,9.66 11.04,10.25L20.5,19.7L19.61,20.59Z",
 "calendar": "M7 11H9V13H7V11M21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H6V1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5M5 7H19V5H5V7M19 19V9H5V19H19M15 13V11H17V13H15M11 13V11H13V13H11M7 15H9V17H7V15M15 17V15H17V17H15M11 17V15H13V17H11Z",
 "pulse": "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
 "eye": "M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z",
 "eyeOff": "M2,5.27L3.28,4L20,20.72L18.73,22L15.65,18.92C14.5,19.3 13.28,19.5 12,19.5C7,19.5 2.73,16.39 1,12C1.69,10.24 2.79,8.69 4.19,7.46L2,5.27M12,9A3,3 0 0,1 15,12C15,12.35 14.94,12.69 14.83,13L11,9.17C11.31,9.06 11.65,9 12,9M12,4.5C17,4.5 21.27,7.61 23,12C22.18,14.08 20.79,15.88 19,17.19L17.58,15.76C18.94,14.82 20.06,13.54 20.82,12C19.17,8.64 15.76,6.5 12,6.5C10.91,6.5 9.84,6.68 8.84,7L7.3,5.47C8.74,4.85 10.33,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C12.69,17.5 13.37,17.43 14,17.29L11.72,15C10.29,14.85 9.15,13.71 9,12.28L5.6,8.87C4.61,9.72 3.78,10.78 3.18,12Z",
 "phone": "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z",
 "restore": "M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z",
 "check": "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
 "lock": "M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,20V10H6V20H18M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
 "pencilO": "M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z",
 "desktop": "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z"
};

const ic = (k, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[k]}"/></svg>`;

// Beispiel-Einträge. pin: als Favorit in der Kopfzeile. Pfade sind HA-Seiten (öffnen in HA), Adressen mit https:// öffnen in einem neuen Tab.
const APPS = {
  panel: [
    { id: "timer", n: "Timer", i: "timer", sub: "Alle Timer", pin: true },
    { id: "magic", n: "Magic Push", i: "bell", sub: "Alle Meldungen" },
    { id: "log", n: "Protokoll", i: "log", sub: "mit Debug-Modus", badge: "Debug" },
  ],
  ha: [
    { id: "auto", n: "Automationen", i: "robot", sub: "/config/automation", pin: true },
    { id: "scene", n: "Szenen", i: "palette", sub: "/config/scene" },
    { id: "script", n: "Skripte", i: "script", sub: "/config/script" },
    { id: "helper", n: "Helfer", i: "tune", sub: "/config/helpers" },
    { id: "dev", n: "Geräte", i: "devices", sub: "/config/devices" },
    { id: "ent", n: "Entitäten", i: "shape", sub: "/config/entities" },
    { id: "integ", n: "Integrationen", i: "puzzle", sub: "/config/integrations" },
    { id: "tools", n: "Werkzeuge", i: "tools", sub: "/developer-tools" },
    { id: "hist", n: "Verlauf", i: "history", sub: "/history" },
    { id: "book", n: "Logbuch", i: "logbook", sub: "/logbook" },
    { id: "energy", n: "Energie", i: "bolt", sub: "/energy" },
    { id: "addons", n: "Add-ons", i: "store", sub: "/hassio/dashboard" },
  ],
  own: [
    { id: "cam", n: "Kamera Eingang", i: "cam", sub: "/lovelace/kameras", own: true },
    { id: "router", n: "Router", i: "web", sub: "http://router.local", own: true, ext: true },
  ],
};
const pins = [...APPS.panel, ...APPS.ha, ...APPS.own].filter((a) => a.pin);

const CSS = `
.lc-pop { position: fixed; z-index: 60; box-sizing: border-box; padding: 12px 12px 10px; border: 1px solid var(--dp-divider); border-radius: 20px;
  background: var(--dp-card); box-shadow: 0 14px 40px rgba(0,0,0,.24); color: var(--dp-text); }
.lc-search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 999px; color: var(--dp-text2); font-size: 14px; margin-bottom: 2px; }
.lc-h { display: flex; align-items: center; gap: 6px; margin: 12px 4px 6px; color: var(--dp-text2); font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; }
.lc-h .sp { margin-left: auto; text-transform: none; letter-spacing: 0; font-size: 12.5px; color: var(--dp-primary); }
.lc-grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: 6px; }
.lc-tile { position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 80px; padding: 10px 4px 8px;
  border-radius: 14px; background: var(--dp-subtle); font-size: 12px; line-height: 1.2; text-align: center; }
.lc-tile.pin { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--dp-primary) 55%, transparent); }
.lc-ico { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); }
.lc-heart { position: absolute; top: 6px; right: 7px; color: var(--dp-text2); opacity: .8; }
.lc-heart.on { color: #e53935; opacity: 1; }
.lc-badge { position: absolute; top: 6px; left: 6px; padding: 1px 6px; border-radius: 99px; font-size: 10px; font-weight: 600; background: color-mix(in srgb, var(--dp-warning) 22%, transparent); color: var(--dp-warning); }
.lc-tile.add { background: none; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); color: var(--dp-primary); justify-content: center; }
.lc-tile.add .lc-ico { background: none; }
.lc-ext { position: absolute; bottom: 6px; right: 7px; color: var(--dp-text2); }
.lc-row { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 6px; border-radius: 12px; }
.lc-row .t { flex: 1; min-width: 0; font-size: 14.5px; }
.lc-row .t b { display: block; font-weight: 500; }
.lc-row .t small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12px; }
.lc-row .ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); }
.lc-row .h { flex: none; color: var(--dp-text2); }
.lc-row .h.on { color: #e53935; }
.lc-row .drag { color: var(--dp-text2); opacity: .7; }
.lc-row + .lc-row { border-top: 1px solid var(--dp-divider); }
.lc-foot { display: flex; align-items: center; gap: 8px; margin: 10px 4px 0; padding-top: 10px; border-top: 1px solid var(--dp-divider); color: var(--dp-primary); font-size: 13.5px; }
.lc-foot .r { margin-left: auto; color: var(--dp-text2); font-size: 12px; }
.lc-btn { display: grid; place-items: center; flex: none; width: 42px; height: 42px; margin: 0 4px; border-radius: 50%; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); }
.lc-btn.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.lc-btn.m { width: 38px; height: 38px; margin: 0 3px; }
.lc-dim { position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,.5); }
.lc-sheet { position: fixed; z-index: 60; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 8px 14px 18px; border-radius: 22px 22px 0 0; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 -10px 30px rgba(0,0,0,.35); }
.lc-grab { width: 40px; height: 4px; margin: 0 auto 10px; border-radius: 4px; background: color-mix(in srgb, var(--dp-text) 25%, transparent); }
.lc-dlg { position: fixed; z-index: 60; box-sizing: border-box; width: 460px; padding: 22px 22px 18px; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 18px 50px rgba(0,0,0,.3); }
.lc-dlg h3 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
.lc-dlg .sub { margin: 0 0 14px; color: var(--dp-text2); font-size: 13px; line-height: 1.4; }
.lc-f { margin: 12px 0 0; }
.lc-f label { display: block; margin-bottom: 5px; color: var(--dp-text2); font-size: 12.5px; }
.lc-in { box-sizing: border-box; display: flex; align-items: center; height: 44px; padding: 0 14px; border: 1px solid var(--dp-divider); border-radius: 12px; font-size: 14.5px; }
.lc-in.f { border-color: var(--dp-primary); box-shadow: 0 0 0 1px var(--dp-primary); }
.lc-hint { margin: 5px 2px 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.lc-icons { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.lc-icons span { display: grid; place-items: center; height: 40px; border-radius: 12px; background: var(--dp-subtle); color: var(--dp-text2); }
.lc-icons span.on { background: var(--dp-primary-soft); color: var(--dp-primary); box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.lc-acts { display: flex; gap: 10px; margin-top: 18px; }
.lc-acts span { flex: 1; display: grid; place-items: center; height: 44px; border-radius: 12px; border: 1px solid var(--dp-divider); font-size: 14px; }
.lc-acts span.p { background: var(--dp-primary); border-color: var(--dp-primary); color: #fff; font-weight: 500; }
.lc-prev { display: flex; align-items: center; gap: 12px; margin-top: 4px; padding: 10px 12px; border-radius: 14px; background: var(--dp-subtle); }
.lc-prev .lc-tile { width: 84px; min-height: 76px; background: var(--dp-card); }
.lc-prev p { margin: 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.lc-cap { position: fixed; z-index: 70; top: 8px; left: 8px; padding: 3px 10px; border-radius: 99px; background: #263238; color: #fff; font: 600 12px system-ui; }
`;

const CSS2 = `
.lc-fav { display: grid; grid-template-columns: minmax(0, 1fr) 16px minmax(0, 3fr); gap: 0; align-items: stretch; }
.lc-fav .vl { position: relative; border-left: 1.5px dashed color-mix(in srgb, var(--dp-text2) 55%, transparent); margin: 2px 7px; }
.lc-fav .vl span { position: absolute; top: -2px; left: -9px; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--dp-card); color: var(--dp-text2); }
.lc-fav .rest { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.lc-note { margin: 6px 4px 0; color: var(--dp-text2); font-size: 11.5px; line-height: 1.35; }
.lc-ehead { display: flex; align-items: center; gap: 8px; margin: 0 4px 4px; }
.lc-ehead b { font-size: 15px; font-weight: 600; }
.lc-ehead .sp { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 999px; background: var(--dp-primary); color: #fff; font-size: 13px; font-weight: 500; }
.lc-erow { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 6px 0 2px; border-radius: 12px; font-size: 14.5px; }
.lc-erow + .lc-erow { border-top: 1px solid var(--dp-divider); }
.lc-erow .drag { flex: none; display: grid; place-items: center; width: 26px; color: var(--dp-text2); }
.lc-erow .ico { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); }
.lc-erow .n { flex: 1; min-width: 0; }
.lc-erow .n small { display: block; color: var(--dp-text2); font-size: 11.5px; }
.lc-erow .a { flex: none; display: grid; place-items: center; width: 34px; height: 34px; color: var(--dp-text2); }
.lc-erow .a.on { color: #e53935; }
.lc-erow .a.del { color: var(--dp-error); }
.lc-erow.hid { opacity: .55; }
.lc-erow.hid .n { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--dp-text2) 60%, transparent); }
.lc-erow.lift { position: relative; z-index: 3; margin: 2px -4px; padding: 0 10px 0 6px; background: var(--dp-card); border: 1px solid color-mix(in srgb, var(--dp-primary) 45%, transparent); box-shadow: 0 8px 22px rgba(0,0,0,.28); transform: rotate(-.8deg); }
.lc-drop { height: 3px; margin: 1px 6px; border-radius: 3px; background: var(--dp-primary); }
.lc-hline { display: flex; align-items: center; gap: 8px; margin: 2px 6px; color: var(--dp-text2); font-size: 11.5px; }
.lc-hline::before, .lc-hline::after { content: ""; flex: 1; border-top: 1.5px dashed color-mix(in srgb, var(--dp-text2) 55%, transparent); }
.lc-hline span { display: inline-flex; align-items: center; gap: 5px; }
.lc-reset { display: flex; align-items: center; gap: 8px; margin: 10px 4px 0; padding-top: 10px; border-top: 1px solid var(--dp-divider); color: var(--dp-primary); font-size: 13.5px; }
.lc-reset .r { margin-left: auto; color: var(--dp-text2); font-size: 12px; }
`;
const tile = (a, o = {}) => `<div class="lc-tile${a.pin ? " pin" : ""}">${a.badge ? `<span class="lc-badge">${a.badge}</span>` : ""}<span class="lc-heart${a.pin ? " on" : ""}">${ic(a.pin ? "heart" : "heartO", 15)}</span>
  <span class="lc-ico">${ic(a.i, 22)}</span><span>${a.n}</span>${a.ext ? `<span class="lc-ext">${ic("link", 12)}</span>` : ""}</div>`;
const row = (a, o = {}) => `<div class="lc-row">${o.edit && a.own ? `<span class="drag">${ic("drag", 18)}</span>` : ""}<span class="ico">${ic(a.i, 20)}</span>
  <span class="t"><b>${a.n}</b><small>${a.badge ? "Debug-Modus und Einträge · " : ""}${a.sub}</small></span>
  ${o.edit && a.own ? `<span class="h">${ic("pencil", 18)}</span><span class="h" style="color:var(--dp-error)">${ic("close", 18)}</span>` : `<span class="h${a.pin ? " on" : ""}">${ic(a.pin ? "heart" : "heartO", 20)}</span>`}</div>`;
const head = (t, extra = "") => `<div class="lc-h">${t}${extra}</div>`;
const search = `<div class="lc-search">${ic("search", 18)}<span>Seite suchen …</span></div>`;
const addTile = `<div class="lc-tile add"><span class="lc-ico">${ic("plus", 24)}</span><span>Eigene App</span></div>`;

const popA = (style) => `<div class="lc-pop" style="${style}">${search}
  ${head("Favoriten ♥", '<span class="sp">in der Kopfzeile</span>')}<div class="lc-grid">${pins.map((a) => tile(a)).join("")}</div>
  ${head("Device Panel")}<div class="lc-grid">${APPS.panel.map((a) => tile(a)).join("")}</div>
  ${head("Home Assistant")}<div class="lc-grid">${APPS.ha.map((a) => tile(a)).join("")}</div>
  ${head("Eigene", '<span class="sp">Bearbeiten</span>')}<div class="lc-grid">${APPS.own.map((a) => tile(a)).join("")}${addTile}</div></div>`;
const popB = (style, edit = false) => `<div class="lc-pop" style="${style}">${search}
  ${head("Favoriten ♥")}${pins.map((a) => row(a)).join("")}
  ${head("Device Panel")}${APPS.panel.map((a) => row(a)).join("")}
  ${head("Home Assistant")}${APPS.ha.slice(0, 3).map((a) => row(a)).join("")}<div class="lc-row"><span class="ico">${ic("chev", 20)}</span><span class="t"><b style="color:var(--dp-primary)">Alle 12 anzeigen</b></span></div>
  ${head("Eigene", '<span class="sp">Bearbeiten</span>')}${APPS.own.map((a) => row(a, { edit })).join("")}
  <div class="lc-foot">${ic("plus", 18)}<span>Eigene App hinzufügen</span></div></div>`;

// Kopfzeile umbauen: mode "ist" | "neu" (nur Launcher) | "pins" (Favoriten plus Launcher); mobile: höchstens ein Favorit sichtbar
async function toolbar(ev, mode, mobile, openLauncher = false) {
  await ev(`
    const tb = r.querySelector(".toolbar");
    const old = tb.querySelector(".tmall-btn");
    const m = arg.mobile ? " m" : "";
    const btn = (icon, on) => '<span class="lc-btn' + m + (on ? " on" : "") + '">' + icon + '</span>';
    if (arg.mode !== "ist") {
      const pins = arg.pins.slice(0, arg.mobile ? 1 : 9).map((a) => btn(arg.icons[a.i], false)).join("");
      old.insertAdjacentHTML("beforebegin", arg.mode === "pins" ? pins : "");
      old.outerHTML = btn(arg.icons.dots, arg.open);
    }
  `, { mode, mobile, open: openLauncher, pins, icons: Object.fromEntries(Object.keys(P).map((k) => [k, ic(k, mobile ? 20 : 22)])) });
}

async function clipEl(p, f, sel, file, pad = 8, right = 0) {
  const d = await f.evaluate(new Function(`const d=${"document.querySelector('device-panel').shadowRoot"}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
  const fr = await (await p.$("#panel-frame")).boundingBox();
  // right > 0: nur die rechten right Pixel der Kopfzeile (Knöpfe), damit sie gross genug zu sehen sind
  const w = right ? Math.min(right, d.width) : d.width;
  const x = d.x + fr.x + d.width - w;
  await p.screenshot({ path: file, clip: { x: Math.max(0, x - pad), y: d.y + fr.y - pad, width: w + pad * 2, height: d.height + pad * 2 } });
}


// Favoriten im Raster: erstes Element | Strich (Handy-Grenze) | Rest
const favRaster = () => `<div class="lc-fav">${tile(pins[0])}<div class="vl"><span>${ic("phone", 12)}</span></div><div class="rest">${pins.slice(1).map((a) => tile(a)).join("")}${tile({ id: "x", n: "Szenen", i: "palette", pin: true })}</div></div>
  <div class="lc-note">${ic("phone", 12)} Am Handy erscheint nur der erste in der Kopfzeile. Auf dem Desktop alle. Reihenfolge: im Bearbeiten-Modus ziehen.</div>`;

const popNormal = (style) => `<div class="lc-pop" style="${style}"><div class="lc-ehead"><b>Apps</b><span class="sp" style="background:none;color:var(--dp-primary);padding:0 4px">${ic("pencilO", 16)} Bearbeiten</span></div>${search}
  ${head("Favoriten ♥")}${favRaster()}
  ${head("Device Panel")}<div class="lc-grid">${APPS.panel.map((a) => tile(a)).join("")}</div>
  ${head("Home Assistant")}<div class="lc-grid">${APPS.ha.slice(0, 8).map((a) => tile(a)).join("")}</div>
  ${head("Eigene")}<div class="lc-grid">${APPS.own.map((a) => tile(a)).join("")}${addTile}</div></div>`;

const erow = (a, o = {}) => `<div class="lc-erow${o.hid ? " hid" : ""}${o.lift ? " lift" : ""}"><span class="drag">${ic("drag", 20)}</span><span class="ico">${ic(a.i, 18)}</span>
  <span class="n">${a.n}<small>${a.sub || ""}</small></span>
  ${o.lock ? `<span class="a" title="immer sichtbar">${ic("lock", 18)}</span>` : `<span class="a">${ic(o.hid ? "eyeOff" : "eye", 20)}</span>`}
  ${a.own ? `<span class="a">${ic("pencilO", 18)}</span><span class="a del">${ic("close", 18)}</span>` : `<span class="a${a.pin ? " on" : ""}">${ic(a.pin ? "heart" : "heartO", 20)}</span>`}</div>`;
const hline = `<div class="lc-hline"><span>${ic("phone", 13)} Kopfzeile am Handy: nur der oberste Favorit</span></div>`;

const popEdit = (style) => `<div class="lc-pop" style="${style}"><div class="lc-ehead"><b>Apps bearbeiten</b><span class="sp">${ic("check", 16)} Fertig</span></div>
  <div class="lc-note" style="margin:0 4px 2px">Ziehen sortiert, das Auge blendet aus, das Herz macht zum Favoriten. Gilt nur für dich.</div>
  ${head("Favoriten ♥")}
  ${erow({ ...APPS.ha[0], pin: true }, { lift: true })}<div class="lc-drop"></div>${erow({ ...APPS.panel[0], pin: true })}${hline}${erow({ id: "x", n: "Szenen", i: "palette", sub: "/config/scene", pin: true })}
  ${head("Device Panel")}${erow(APPS.panel[1])}${erow({ ...APPS.panel[2], sub: "immer sichtbar: einziger Zugang zum Debug-Modus" }, { lock: true })}
  ${head("Home Assistant")}${erow(APPS.ha[1])}${erow(APPS.ha[2], { hid: true })}<div class="lc-note" style="margin:4px 8px">… 9 weitere</div>
  ${head("Eigene")}${APPS.own.map((a) => erow(a)).join("")}
  <div class="lc-reset">${ic("restore", 18)}<span>Auf Standard zurücksetzen</span><span class="r">Auswahl, Reihenfolge, Ausgeblendetes</span></div></div>`;

async function img1() {
  const out = [];
  {
    const { ctx, p, ev } = await page(false, { css: CSS + CSS2 });
    await toolbar(ev, "pins", false, true);
    await ev(`const b = r.querySelectorAll(".toolbar .lc-btn"); const l = b[b.length - 1].getBoundingClientRect(); r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg.replace("STYLE", "top:" + (l.bottom + 8) + "px;left:" + (l.right - 400) + "px;width:410px"));`, popNormal("STYLE"));
    await p.waitForTimeout(250);
    const file = `${tmp}1-d.png`;
    await p.screenshot({ path: file, clip: { x: 0, y: 40, width: 1400, height: 940 } });
    out.push([file, "Desktop: Favoriten mit Strich nach dem ersten (Handy-Grenze)", 1000]);
    await ctx.close();
  }
  {
    const { ctx, p, ev } = await page(true, { css: CSS + CSS2 });
    await toolbar(ev, "pins", true, true);
    await ev(`r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg);`,
      `<div class="lc-dim"></div><div class="lc-sheet"><div class="lc-grab"></div>${search}
      ${head("Favoriten ♥")}<div class="lc-fav" style="grid-template-columns:minmax(0,1fr) 16px minmax(0,2fr)">${tile(pins[0])}<div class="vl"><span>${ic("phone", 12)}</span></div><div class="rest" style="grid-template-columns:repeat(2,minmax(0,1fr))">${tile(pins[1])}${tile({ n: "Szenen", i: "palette", pin: true })}</div></div>
      <div class="lc-note">Am Handy erscheint nur der erste in der Kopfzeile.</div>
      ${head("Device Panel")}<div class="lc-grid" style="--cols:3">${APPS.panel.map((a) => tile(a)).join("")}</div>
      ${head("Home Assistant", '<span class="sp">Alle 12 ›</span>')}<div class="lc-grid" style="--cols:3">${APPS.ha.slice(0, 3).map((a) => tile(a)).join("")}</div></div>`);
    await p.waitForTimeout(250);
    const file = `${tmp}1-m.png`;
    await p.screenshot({ path: file });
    out.push([file, "Handy: nur der erste Favorit (Timer) steht in der Kopfzeile", 330]);
    await ctx.close();
  }
  return out;
}

async function img2() {
  const { ctx, p, ev } = await page(false, { css: CSS + CSS2 });
  await toolbar(ev, "pins", false, true);
  await ev(`const b = r.querySelectorAll(".toolbar .lc-btn"); const l = b[b.length - 1].getBoundingClientRect(); r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg.replace("STYLE", "top:" + (l.bottom + 8) + "px;left:" + (l.right - 400) + "px;width:410px"));`, popEdit("STYLE"));
  await p.waitForTimeout(250);
  const file = `${tmp}2-d.png`;
  await p.screenshot({ path: file, clip: { x: 0, y: 40, width: 1400, height: 1000 } });
  await ctx.close();
  return [[file, "Bearbeiten (Desktop): Ziehgriff links, Auge (ausblenden), Herz. \"Automationen\" wird auf Platz 1 gezogen (blaue Linie): Der Timer rutscht unter den Strich und fehlt am Handy in der Kopfzeile. Protokoll lässt sich nicht ausblenden.", 1000]];
}

async function img3() {
  const { ctx, p, ev } = await page(true, { css: CSS + CSS2 });
  await toolbar(ev, "pins", true, true);
  await ev(`r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg);`,
    `<div class="lc-dim"></div><div class="lc-sheet" style="top:96px;padding-bottom:12px;overflow:hidden"><div class="lc-grab"></div>
    <div class="lc-ehead"><b>Apps bearbeiten</b><span class="sp">${ic("check", 16)} Fertig</span></div>
    ${head("Favoriten ♥")}${erow({ ...APPS.panel[0], pin: true })}${hline}${erow({ ...APPS.ha[0], pin: true })}${erow({ id: "x", n: "Szenen", i: "palette", sub: "/config/scene", pin: true })}
    ${head("Device Panel")}${erow(APPS.panel[1])}${erow({ ...APPS.panel[2], sub: "immer sichtbar" }, { lock: true })}
    ${head("Home Assistant")}${erow(APPS.ha[1])}${erow(APPS.ha[2], { hid: true })}</div>`);
  await p.waitForTimeout(250);
  const file = `${tmp}3-m.png`;
  await p.screenshot({ path: file });
  await ctx.close();
  return [[file, "Bearbeiten (Handy): gleiche Zeilen, grosse Trefferflächen (44 px)", 330]];
}

await compose("1-Launcher.png", await img1());
await compose("2-Bearbeiten-Desktop.png", await img2());
await compose("3-Bearbeiten-Handy.png", await img3());
await close();
