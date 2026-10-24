# Baut die Mockup-Seiten 1 bis 4 (statisches HTML, erfundene Daten). Aufruf: python3 build.py, danach render.mjs
HEAD = '<!doctype html><meta charset=utf-8><link rel=stylesheet href=base.css><link rel=stylesheet href=extra.css><link rel=stylesheet href=wizard.css><body><div class=row>\n'


def col(title, cap, body, rec=False):
    return f'<div class=col><div class=cap>{title}{" <em>Empfehlung</em>" if rec else ""}<small>{cap}</small></div>\n{body}</div>\n'


def wz(step, total, title, body, foot, desktop=False, bar=True):
    pct = int(100 * step / total) if total else 0
    top = (
        f'<div class=top><div class=prog><i style="width:{pct}%"></i></div><div class=stp><span><b>Schritt {step} von {total}</b></span><span>{title}</span></div></div>'
        if bar
        else '<div class=top style="height:30px"></div>'
    )
    return f'<div class="wz{" d" if desktop else ""}">{top}<div class=bd>{body}</div><div class=ft>{foot}</div></div>'


def li(ic, name, small='', on=True, tag=''):
    return f'<div class=li><div class=ic>{ic}</div><div class=nm>{name}{tag}{f"<small>{small}</small>" if small else ""}</div><div class="tg{" on" if on else ""}"></div></div>'


BACK = '<div class=btn>Zurück</div>'
NEXT = '<div class="btn p">Weiter</div>'

welcome_body = '''<div class=hero>⌁</div><h1>Willkommen beim Device Panel</h1>
<p>Alle Geräte von Home Assistant auf einen Blick: wer ausgefallen ist, wie oft, wie voll die Batterien sind. In fünf kurzen Schritten stellst du die Grundlagen ein.</p>
<div class=pts>
<div><u>1</u><span>Was soll überwacht werden?<small>Integrationen, Typen und einzelne Geräte</small></span></div>
<div><u>2</u><span>Wohin gehen die Meldungen?<small>Dein Handy oder eine Notify-Gruppe</small></span></div>
<div><u>3</u><span>Wann willst du Ruhe?<small>Nachts keine Meldungen</small></span></div></div>
<p style="font-size:12.5px;color:var(--t3)">Dauert etwa zwei Minuten. Alles lässt sich später in den Einstellungen ändern.</p>'''
welcome_foot_A = '<div class="btn t">Jetzt nicht</div><div class="btn p">Los geht\'s</div>'

integ = [
    ('▤', 'Zigbee Home Automation', '38 Geräte', True, ''),
    ('▤', 'Shelly', '14 Geräte', True, ''),
    ('▤', 'Philips Hue', '12 Geräte', True, ''),
    ('▤', 'ESPHome', '6 Geräte', True, ''),
    ('▤', 'Mobile App', '4 Geräte', True, '<span class=tag>Handys, oft unterwegs</span>'),
    ('▤', 'Apple TV', '3 Geräte', False, '<span class=tag>oft aus</span>'),
    ('▤', 'Sonos', '3 Geräte', True, ''),
    ('▤', 'Samsung Smart TV', '1 Gerät', False, '<span class=tag>oft aus</span>'),
]
integ_body = (
    '<h1 style="font-size:21px">Welche Integrationen?</h1><p>Das Panel hat 8 Integrationen mit 81 Geräten gefunden. Abgewählte zeigt das Panel nicht, und ihre Geräte werden nicht überwacht.</p>'
    '<div class=sr>🔍 Integration suchen …</div><div class=lst>' + ''.join(li(*x) for x in integ) + '</div>'
)
types = [
    ('◉', 'Licht', '24 Geräte', True),
    ('▣', 'Sensor', '31 Geräte', True),
    ('⏻', 'Steckdose', '14 Geräte', True),
    ('♨', 'Thermostat', '5 Geräte', True),
    ('◧', 'Medien', '4 Geräte', False),
    ('☎', 'Handy', '4 Geräte', False),
    ('⌂', 'Hub', '3 Geräte', True),
]
types_body = (
    '<h1 style="font-size:21px">Welche Gerätetypen?</h1><p>Nach den Integrationen bleiben 73 Geräte in 7 Typen. Typen, die du nicht beobachten willst, kannst du hier abwählen.</p>'
    '<div class=lst>' + ''.join(li(*x) for x in types) + '</div><div class=tip>Handys und Fernseher sind oft ausser Haus oder aus und melden dann ständig einen Ausfall.</div>'
)


def groups():
    out = '<div class=sr>🔍 Gerät suchen …</div>'
    out += '<div class=grp><span class=ch>⌄</span>▤ Zigbee Home Automation<span class=cn>34 von 38</span><div class="tg on"></div></div><div class=sub>'
    for n, s, on in [('Bewegungsmelder Flur', 'Flur', True), ('Temperatursensor Keller', 'Keller', True), ('Fensterkontakt Küche', 'Küche', True), ('Testlampe Büro', 'Büro', False), ('Alter Taster', 'Wohnzimmer', False)]:
        out += li('', n, s, on)
    out += '</div>'
    for n, c in [('Shelly', '14 von 14'), ('Philips Hue', '12 von 12'), ('ESPHome', '6 von 6'), ('Sonos', '3 von 3')]:
        out += f'<div class=grp><span class=ch>›</span>▤ {n}<span class=cn>{c}</span><div class="tg on"></div></div>'
    return out


dev_body_A = '<h1 style="font-size:21px">Welche Geräte?</h1><p>69 von 73 Geräten sind gewählt. Nimm Geräte heraus, die du nicht überwachen willst.</p>' + groups()
dev_body_B = (
    '<h1 style="font-size:21px">Welche Geräte?</h1><p>69 von 73 Geräten sind gewählt.</p><div class=sr>🔍 Gerät suchen …</div>'
    '<div class=chips style="margin:2px 0 6px"><span class=on>Alle</span><span>Zigbee 38</span><span>Shelly 14</span><span>Hue 12</span><span>ESPHome 6</span></div><div class=lst>'
    + ''.join(
        li('', n, s, on)
        for n, s, on in [
            ('Alter Taster', 'Zigbee · Wohnzimmer', False),
            ('Bewegungsmelder Flur', 'Zigbee · Flur', True),
            ('Fensterkontakt Küche', 'Zigbee · Küche', True),
            ('Heizung Bad', 'Shelly · Bad', True),
            ('Klimasensor Keller', 'Zigbee · Keller', True),
            ('Testlampe Büro', 'Hue · Büro', False),
        ]
    )
    + '</div>'
)

notify_body = (
    '<h1 style="font-size:21px">Wohin gehen die Meldungen?</h1><p>Ohne Ziel meldet das Panel nichts. Wähle deine Notify-Gruppe oder dein Handy.</p>'
    '<div class=lab>Ziel</div><div class=sel><span>notify.group_diego_mobile</span><u>⌄</u></div><div class=lab>Das melden</div><div class=lst>'
    + li('!', 'Ausfälle', 'wenn ein Gerät ausfällt', True)
    + li('↺', 'Wieder online', 'mit der Dauer des Ausfalls', True)
    + li('▯', 'Batterie schwach', 'unter 15 %, einmal am Tag um 08:00', True)
    + li('✦', 'Neue Geräte', 'wenn Home Assistant ein Gerät findet', False)
    + '</div><div class=two style="margin-top:12px"><div class=btn>Testmeldung senden</div></div>'
    '<p style="font-size:12.5px;color:var(--t3);margin-top:8px">Weitere Meldungen (Laden, Updates, Routinen) stehen in den Einstellungen.</p>'
)
quiet_body = (
    '<h1 style="font-size:21px">Nachts Ruhe?</h1><p>Meldungen warten bis zum Morgen und kommen dann als eine Zusammenfassung. Kritische Meldungen von Magic Push kommen immer sofort.</p><div class=lst>'
    + li('☾', 'Ruhezeit verwenden', 'jeden Tag, später pro Wochentag einstellbar', True)
    + '</div><div class=lab>Von bis</div><div class=two><div class=sel style="flex:1"><span>22:00</span><u>⌄</u></div><div class=sel style="flex:1"><span>07:00</span><u>⌄</u></div></div>'
)
done_body = (
    '<div class=chk>✓</div><h1 style="font-size:21px">Fertig eingerichtet</h1><p>Das hast du eingestellt:</p>'
    '<div class=sum><div class=li><div class=nm>Integrationen</div><b>6 von 8</b></div><div class=li><div class=nm>Gerätetypen</div><b>5 von 7</b></div>'
    '<div class=li><div class=nm>Geräte</div><b>69 von 73</b></div><div class=li><div class=nm>Meldungen an</div><b>notify.group_diego_mobile</b></div>'
    '<div class=li><div class=nm>Ruhezeit</div><b>22:00 bis 07:00</b></div></div>'
    '<p style="margin-top:12px">Alles weitere steht in den Einstellungen. Den Assistenten startest du dort jederzeit neu: Einstellungen › Panel › Einrichtungsassistent.</p>'
)

TOT = 6

b = HEAD
b += col('0 Willkommen', 'Vollbild am Handy. Kurz: was das Panel tut, die Schritte, Dauer. "Jetzt nicht" schliesst; der Assistent bleibt dann im App-Launcher (siehe Bild 4).', wz(0, TOT, 'Willkommen', welcome_body, welcome_foot_A, bar=False), True)
b += col('1 Integrationen', 'Alle erkannten Integrationen mit Zahl der Geräte, alle angewählt. Hinweise ("oft aus") nur als Tipp, nichts ist vorgewählt. Suche ab etwa acht Einträgen.', wz(1, TOT, 'Integrationen', integ_body, BACK + NEXT))
b += col('2 Gerätetypen', 'Nur Typen, die nach Schritt 1 noch Geräte haben (die Zahlen passen sich an).', wz(2, TOT, 'Gerätetypen', types_body, BACK + NEXT))
b += col('3 Geräte, A nach Integration gruppiert', 'Gruppen mit Schalter für die ganze Integration, aufklappbar zu den einzelnen Geräten; "34 von 38" zeigt den Stand. Gut bei vielen Geräten.', wz(3, TOT, 'Geräte', dev_body_A, BACK + NEXT), True)
b += '</div>'
open('1.html', 'w').write(b)

b = HEAD
b += col('3 Geräte, B flache Liste mit Integrations-Chips', 'Eine Liste aller Geräte nach Name, Chips zum Eingrenzen. Übersichtlich bei wenigen Geräten, bei 80 oder mehr aber lang.', wz(3, TOT, 'Geräte', dev_body_B, BACK + NEXT))
b += col('4 Meldungen', 'Der wichtigste Schritt: ohne Ziel kommt nichts an (Meldungen sind heute standardmässig aus). Ziel aus den Notify-Diensten von Home Assistant, dazu die vier wichtigsten Arten. Eine Testmeldung prüft das Ziel.', wz(4, TOT, 'Meldungen', notify_body, BACK + NEXT), True)
b += col('5 Ruhezeit', 'Nur wenn ein Ziel gewählt ist. Ein Schalter und zwei Zeiten; Wochentage und Arten bleiben in den Einstellungen.', wz(5, TOT, 'Ruhezeit', quiet_body, BACK + NEXT))
b += col('6 Fertig', 'Zusammenfassung mit den Zahlen. Gespeichert wird erst hier (ein Speichern am Schluss); Zurück ändert bis dahin nichts.', wz(6, TOT, 'Fertig', done_body, BACK + '<div class="btn p">Fertigstellen</div>'))
b += '</div>'
open('2.html', 'w').write(b)

b = HEAD
b += col('Desktop: Popup in der Mitte', 'Dasselbe Fenster als Popup (640 px), dahinter das abgedunkelte Panel. Schritt 0.', wz(0, TOT, 'Willkommen', welcome_body, welcome_foot_A, desktop=True, bar=False))
b += col('Desktop: Schritt 3 Geräte (A)', 'Gruppen mit Schalter und Suche; die Liste scrollt im Popup.', wz(3, TOT, 'Geräte', dev_body_A, BACK + NEXT, desktop=True))
b += col('Desktop: Schritt 4 Meldungen', 'Mit Ziel und Testmeldung.', wz(4, TOT, 'Meldungen', notify_body, BACK + NEXT, desktop=True))
b += '</div>'
open('3.html', 'w').write(b)

launcher = '''<div class=lau><div class=hd2><span class=menu>☰<span class=dot></span></span><span>Device Panel</span></div>
<div style="padding:4px 16px 4px;color:var(--t2);font-size:12px;text-transform:uppercase;letter-spacing:.07em">Device Panel</div>
<div class=gridA><div class="tile wzt"><i>✦</i>Einrichtung<span class=dot></span></div><div class=tile><i>≡</i>Protokoll</div><div class=tile><i>∿</i>Status</div><div class=tile><i>⚙</i>Einstellungen</div><div class=tile><i>▦</i>Ansicht</div><div class=tile><i>⌁</i>Routinen</div></div></div>'''
settings = '''<div class=cardx><div class=lab style="margin:0 0 6px">Einstellungen › Panel › Allgemein</div>
<div class=li style="border:0"><div class=ic>✦</div><div class=nm>Einrichtungsassistent<small>Führt dich durch die Grundeinstellungen. Deine jetzigen Einstellungen bleiben, wie sie sind.</small></div></div>
<div class=two style="margin-top:8px"><div class="btn p">Assistent starten</div></div>
<p style="font-size:12.5px;color:var(--t3);margin:10px 0 0">Zuletzt abgeschlossen: 24.10.2026</p></div>'''
states = '''<div class=cardx style="width:560px"><table class=st><tr><th>Zustand</th><th>Wann</th><th>Launcher</th></tr>
<tr><td><b>neu</b></td><td>frische Installation, Assistent noch nicht gesehen. Erscheint beim ersten Öffnen des Panels (nur Administratoren).</td><td>Kachel "Einrichtung" und oranger Punkt am Launcher-Knopf</td></tr>
<tr><td><b>später</b></td><td>"Jetzt nicht" oder Fenster geschlossen</td><td>wie "neu": Kachel und Punkt bleiben bis zum ersten Abschluss</td></tr>
<tr><td><b>fertig</b></td><td>"Fertigstellen" im letzten Schritt</td><td>Kachel und Punkt verschwinden, nicht einstellbar</td></tr>
<tr><td><b>offen</b></td><td>aus den Einstellungen neu gestartet, aber nicht beendet</td><td>Kachel und Punkt kommen zurück, bis er beendet ist</td></tr>
<tr><td><b>Update</b></td><td>bestehende Installation (vor dem Assistenten)</td><td>zählt als "fertig": kein Fenster, keine Kachel; Start nur über die Einstellungen</td></tr></table></div>'''
b = HEAD
b += col('Launcher: Kachel und Punkt, nur vorübergehend', 'Solange der Assistent nie abgeschlossen wurde: eine Kachel "Einrichtung" (nicht verschiebbar, nicht ausblendbar) und ein oranger Punkt am Launcher-Knopf. Nach "Fertigstellen" ist beides weg.', launcher, True)
b += col('Einstellungen › Panel: Kapitel "Einrichtungsassistent"', 'Dauerhafter Einstieg. Neu starten ändert nichts, bis man es im Assistenten selbst ändert; die Felder zeigen immer den jetzigen Stand.', settings)
b += col('Zustände', 'Der Zustand liegt in den Optionen und gilt für alle Administratoren.', states)
b += '</div>'
open('4.html', 'w').write(b)
