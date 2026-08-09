# Calendar Note View

Calendar Note View adds a note-backed month calendar to Obsidian. It includes a Sidebar Calendar for events collected from across your vault and a Calendar view for Bases entries that have already been filtered by the current Base.

## Features

- Sidebar month calendar with independent year and month controls
- Calendar view for Obsidian Bases
- Date-only single-day and inclusive multi-day events
- Continuous multi-day bars with stable lanes across weeks
- Daily Notes indicators, opening, and confirmed creation
- Event creation from the command palette, calendar dates, and context menus
- Source Profiles for folder, tag, outgoing wiki-link, and start-property matching
- Configurable property mapping and strict property date formats
- Event type style rules and safe note-level color overrides
- Time zone-aware Today highlighting without shifting date-only events
- Light, dark, custom theme, desktop, and mobile support
- Optional Style Settings controls through CSS variables
- Diagnostics for invalid indexed notes

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the release.
2. Create `<Vault>/.obsidian/plugins/calendar-note-view/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **Calendar Note View** in **Settings → Community plugins**.

## Sidebar Calendar

Use the ribbon icon or run **Calendar Note View: Open sidebar calendar**. The header provides Previous Month, Next Month, Today, separate Year and Month controls, and Refresh.

Date cells show Daily Note status and either colored event dots or icon badges. Select a date number to open or create its Daily Note. Use the plus button or date context menu to create an event. Select an event indicator to open its note.

Refresh safely rebuilds the Sidebar event index while preserving the viewed month.

## Bases Calendar

Add a Base view and choose **Calendar** as its view type. Configure its property mapping in the view options.

The Bases Calendar uses only the Entries supplied by the current Base. Base filters, formulas, properties, sorting, and limits remain authoritative. Source Profiles never rescan or filter Bases Calendar contents.

The view supports:

- Independent Previous Month, Next Month, Today, Year, and Month controls
- Start, end, title, type, icon, color, text color, and completed property mapping
- Icon, Title, or Icon + Title event display
- First day of week and weekend selection
- Adjacent-month date visibility
- Maximum visible events and `+N more`
- Hide or dim completed tasks
- Daily Notes and event creation actions

Updating Base data does not reset the month being viewed.

## Daily Notes

Calendar Note View uses the Obsidian Core Daily Notes folder, file name format, and template. It does not override those settings. When a Daily Note is missing, the plugin can ask for confirmation before creating and opening it.

The Daily Notes core plugin must be enabled for these actions.

## Source Profiles

Source Profiles control which notes appear in the Sidebar Calendar. They do not filter the contents of Bases Calendar views.

A profile defines:

- Event note matching for the Sidebar Calendar
- Folder, tag, and wiki-link matching from note content or properties
- `all` or `any` matching across configured condition groups
- Start-property-only matching when explicitly enabled
- Property mapping and default icon, background color, and text color
- Event creation folder, template, file name, and generated title rules

Values inside one condition group use OR. For example, folders `Events` and `Holidays` mean `Events OR Holidays`; multiple configured Wiki Links also use OR. Different configured groups use the profile's `all` or `any` mode. A profile with no source conditions does not scan the entire vault unless **Match start property only** is enabled.

Wiki Link matching uses Obsidian's Metadata Cache. It matches links in Markdown content and Properties without reading every note body with a regular expression. Enter one link per line in the Wiki Links text area; any listed link can match.

Source Profile icons provide suggestions from Obsidian's installed icon set. Default background and text colors use selectable Obsidian CSS variables so they follow the active theme. These defaults apply only when a note property and matching Event Type Rule do not provide that style value.

Delete a Source Profile from its list trash button or from **Profile actions → Delete profile** inside the profile. Calendar Note View asks for confirmation and removes only the profile, its indexed Sidebar items, and related diagnostics; it never deletes event notes from the vault.

## Event properties

Calendar Note View does not impose property names. New Source Profiles and Bases Calendar views start with blank mappings, and property fields provide suggestions from the vault or current Base. A possible mapping is:

| Purpose | Property |
|---|---|
| Start date | `start` |
| Inclusive end date | `end` |
| Title | `event-title` |
| Type | `type` |
| Icon | `icon` |
| Background color | `color` |
| Text color | `text-color` |
| Completed | `completed` |

Example:

```yaml
---
start: 2026-08-09
end: 2026-08-11
event-title: Summer break
type: "[[Holiday]]"
icon: sun
color: var(--color-yellow)
text-color: var(--text-normal)
---
```

The end date is inclusive. Missing end dates create a single-day event. Invalid dates and ranges are excluded without changing the note.

## Property mapping

Each Source Profile and each Bases Calendar view maps its own properties. Bases property selectors provide native searchable selection for note, formula, and file properties exposed by the current Base. Source Profile property fields provide suggestions from MetadataCache, while folder and icon fields provide vault-aware suggestions.

## Event creation

Run **Calendar Note View: Create event**, use a calendar date's plus button, or use its context menu. Choose an enabled Source Profile, enter a title and date range, then review the generated file path and properties before creating the note.

The creation service supports nested folders, frontmatter property mapping, note templates, safe file names, and automatic suffixes when a file name already exists.

## Template variables

File name, generated title, and note templates can use:

- `{title}`
- `{start}`
- `{end}`
- `{start-date}`
- `{end-date}`
- `{date-range}`
- `{year}`
- `{month}`
- `{day}`
- `{type}`
- `{type-name}`
- `{icon}`
- `{profile}`

`{start}` and `{start-date}` are equivalent, as are `{end}` and `{end-date}`. `{type-name}` removes wiki-link syntax and aliases. Single-day `{date-range}` values use one date; multi-day values include both the inclusive start and end dates. The default file name and generated title template is `{date-range} {title}`.

## Time zone and date formats

**Time zone** can use System, UTC, or a validated custom IANA time zone such as `Asia/Taipei`. It affects Today highlighting and the default date in event creation. It never shifts a date-only event to another calendar date.

**Display date format** controls dates in the interface, tooltips, previews, and confirmation text.

**Event property date format** strictly parses and writes event properties. Internally, every calendar date remains `YYYY-MM-DD`.

Daily Note file names continue to use the Core Daily Notes format.

## Style Settings

Calendar Note View works without the Style Settings plugin. If Style Settings is installed, its **Calendar Note View** section is organized by where a change appears:

- **Calendar essentials** — shared font and navigation icons
- **Sidebar calendar** — Sidebar background, weekday labels, navigation row, spacing, and day cells
- **Bases calendar** — navigation row, weekday row, grid, date badge, event-bar layout, and overflow count
- **Date appearance and states** — shared date numbers, hover, Other month, Weekend, and Today
- **Items and indicators** — Event and Task fallbacks, completed opacity, dots, icons, corners, and Daily Note indicators

Color selectors contain only choices relevant to their purpose: background selectors use Obsidian background, accent, and extended color variables; text selectors use text, accent, and extended color variables. Choose **Custom** to activate the paired light/dark color setting. Otherwise, the selector follows Obsidian theme variables and adapts to Light, Dark, and custom themes.

Date-state priority is **ordinary date → Weekend → Other month → Today → hover/focus**. This keeps an adjacent-month weekend visually grouped with the other adjacent dates while retaining Today and interaction feedback. The Bases date badge is circular by default; **Bases calendar → Date badge corner radius** changes it from square to round.

Event and Task fallback colors apply only when the note, matching Type Style Rule, and Source Profile do not provide a color override.

## Diagnostics

Run **Calendar Note View: Open calendar diagnostics** to inspect indexed note issues. The dialog shows the diagnostic code, message, file, and Source Profile. Select a file to open it.

## Mobile

The Sidebar Calendar, Bases Calendar, date actions, event actions, and Create Event dialog use responsive layouts and public Obsidian APIs. No desktop-only Node or Electron APIs are used.

## Known limitations

- Version 0.2.x provides month views only; it does not include year, week, day, or hour timelines.
- Recurring events, reminders, external calendar sync, drag-and-drop, and event resizing are not included.
- Tasks are property-backed notes. Markdown checkbox parsing and Tasks plugin parsing are not included.
- Daily Notes integration uses `obsidian-daily-notes-interface` as a compatibility layer around the Core Daily Notes plugin.
- Formula values in Bases must render to a value compatible with the configured strict event property date format.

## Privacy

Calendar Note View runs locally in Obsidian. It does not send vault contents, file names, settings, or usage data to external services, and it includes no telemetry or network requests.

## AI development disclosure

This plugin was developed with significant AI assistance. The project owner directed the design, requirements, review, and release decisions. AI-assisted changes were validated with TypeScript type checking, ESLint, automated tests, production builds, and project-owner review.

## License

[0BSD](LICENSE)
