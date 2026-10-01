/**
 * Styles (Shadow DOM). Farben aus den Theme-Variablen von Home Assistant,
 * eigene Variablen mit --dp- (siehe docs/DESIGN.md).
 */
export const PANEL_CSS = `
:host {
  --dp-card: var(--card-background-color, #fff);
  --dp-text: var(--primary-text-color, #212121);
  --dp-text2: var(--secondary-text-color, #727272);
  --dp-text3: var(--disabled-text-color, #9e9e9e);
  --dp-divider: var(--divider-color, rgba(0,0,0,0.12));
  --dp-primary: var(--primary-color, #03a9f4);
  --dp-success: var(--success-color, #43a047);
  --dp-error: var(--error-color, #db4437);
  --dp-hover: color-mix(in srgb, var(--dp-text) 5%, var(--dp-card));
  --dp-subtle: color-mix(in srgb, var(--dp-text) 4%, var(--dp-card));
  --dp-primary-soft: color-mix(in srgb, var(--dp-primary) 14%, transparent);
  --dp-success-soft: color-mix(in srgb, var(--dp-success) 16%, transparent);
  --dp-error-soft: color-mix(in srgb, var(--dp-error) 16%, transparent);
  --dp-input: var(--primary-background-color, #fff);
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--primary-background-color, #fff);
  color: var(--dp-text);
  font-family: var(--ha-font-family-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}
.toolbar { display: flex; gap: 10px; padding: 16px 20px 10px; }
.search {
  flex: 1; height: 40px; padding: 0 14px; border-radius: 12px;
  border: 1px solid var(--dp-divider); background: var(--dp-input); color: var(--dp-text); font: inherit;
}
.stats { display: flex; margin: 0 20px 12px; padding: 3px; gap: 2px; border-radius: 12px; background: var(--dp-subtle); }
.stats button {
  flex: 1; padding: 8px; border: 0; border-radius: 9px; background: transparent;
  color: var(--dp-text2); font: inherit; cursor: pointer;
}
.stats button.on { background: var(--dp-card); color: var(--dp-text); box-shadow: 0 1px 2px rgba(0,0,0,.15); }
.stats b { margin-right: 4px; }
.content { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 20px 12px; }
table {
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px;
  background: var(--dp-card); border: 1px solid var(--dp-divider); border-radius: 16px;
}
th {
  position: sticky; top: 0; z-index: 2; background: var(--dp-card); text-align: left; white-space: nowrap;
  height: 38px; padding: 12px 12px 4px; color: var(--dp-text2); font-size: 12px; font-weight: 500;
  letter-spacing: .03em; text-transform: uppercase; border-bottom: 1px solid var(--dp-divider);
}
th:first-child { border-top-left-radius: 16px; }
th:last-child { border-top-right-radius: 16px; }
td { padding: 12px; border-bottom: 1px solid var(--dp-divider); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--dp-hover); }
.sub { display: block; color: var(--dp-text2); font-size: 12px; margin-top: 2px; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; white-space: nowrap; }
.pill.on { background: var(--dp-success-soft); color: var(--dp-success); }
.pill.off { background: var(--dp-error-soft); color: var(--dp-error); }
.pill.none { background: var(--dp-subtle); color: var(--dp-text3); }
.note { color: var(--dp-text2); padding: 24px 4px; }
@media (max-width: 600px) {
  .toolbar { padding: 12px 12px 8px; }
  .stats { margin: 0 12px 10px; }
  .content { padding: 0 12px 12px; }
}
`;
