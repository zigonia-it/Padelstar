# Padelstar

Live app: https://padelstar.app

Sist oppdatert: 2026-10-05

Status: 1.0.0, responsiv PWA som kan hostes statisk med Supabase live sync

Dokumentasjon (holdes oppdatert i hver arbeidsøkt, se `CLAUDE.md` / `AGENTS.md`):

- `docs/MASTER-ROADMAP.md`: den styrende planen, fra 1.0.x til 4.x.
- `docs/PROJECT.md`: nåværende tilstand og godkjent produktoppførsel.
- `docs/CHANGELOG.md`: verifiserte endringer per versjon.
- `docs/BUGS.md`: aktive feil og kjente begrensninger.
- `docs/USER_ACTIONS.md`: det bare utvikleren kan gjøre eller bestemme.
- `docs/ROADMAP.md`: detaljerte sjekkpunkter for releasen det jobbes med. `docs/technical/` har tekniske kontrakter, `docs/archive/` er historikk.

Metadata:
- Navn: Padelstar
- Undertittel: Padel Manager
- Utvikler: Sigurd Steen Grødem

Padelstar er en responsiv PWA for å opprette, administrere og følge padelturneringer på mobil, nettbrett og desktop. Appen kan hostes som statiske filer, men bruker Supabase for delt turneringsdata, live sync og sanntidsoppdateringer mellom enheter.

Avklart kontomodell: Konto er ikke nødvendig for å opprette eller delta i en turnering, heller ikke på flere enheter. Databasen brukes for delt aktiv turneringsdata også for gjester. Konto gir permanent eierskap og turneringshistorikk for oppretteren, og permanent personlig statistikk for innloggede spillere. En gjesteeid turnering slettes etter avslutning eller avbrytelse, først når statistikken til registrerte spillere er lagret uavhengig av turneringen.

## Hva appen gjør

- Lar admin opprette en turnering og dele invitasjonskode/QR-lenke.
- Lar spillere bli med fra egen enhet.
- Lar spillere forlate sin lokale spillerøkt uten å slette spilleren eller endre turneringen for andre.
- Lar admin velge om han også deltar som spiller.
- Viser egne moduler for landing page, oppsett, admin, spiller og turneringsvisning.
- Skjuler inaktive moduler slik at de ikke tar plass i layouten.
- Støtter round-robin og cup med automatisk/manuelt lagoppsett, byes og valgfri bronsefinale.
- Støtter walkover, ett-stegs undo, QR-kode og offentlig join-lenke.
- Synkroniserer turneringsstate live via Supabase når live-config er aktiv.
- Krever serverutstedt spillertoken for spillerstyrt poengføring mot Supabase.
- Fungerer lokalt i nettleseren med localStorage fallback, siste-kjente-gode recovery-kopi og IndexedDB-speiling der nettleseren støtter det.
- Har Web Share med kopieringsfallback, opt-in lokale PWA-varsler og admin-eierskap via Supabase Auth for live-turneringer.
- Har en kort, flerspråklig bruksanvisning på `guide.html`, lenket fra hjemmesiden og tilgjengelig offline.


## Roller og visninger

- Admin styrer turneringen, spillere, baner, kamper og resultater.
- Spiller ser egen status, neste kamp, makker, motstandere og relevante resultater.
- Turnering/tilskuer viser livekampene og oversikten uten personlig spillerstatus.
- Admin kan også ha spilleridentitet dersom `Admin spiller selv` velges ved opprettelse.
