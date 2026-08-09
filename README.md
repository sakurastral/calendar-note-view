# Calendar Note View

> [!WARNING]
> **Beta status:** Calendar Note View is still under active development and testing. Features, settings, and stored configuration may change before a stable release. Back up your vault and plugin settings before testing.

Calendar Note View adds a note-backed month calendar to Obsidian. It includes a Sidebar Calendar for events collected from across your vault and a Calendar view for Bases entries that have already been filtered by the current Base.

## Features

- Sidebar month calendar with independent year and month controls
- Calendar view for Obsidian Bases
- Date-only single-day and inclusive multi-day events
- Continuous multi-day bars with stable lanes across weeks
- Daily Notes indicators, opening, and confirmed creation
- Event creation from the command palette, calendar dates, and context menus
- Source Profiles for folder, tag, property-scoped wiki-link, and start-property matching
- Configurable property mapping and strict property date formats
- Event type style rules and safe note-level color overrides
- Time zone-aware Today highlighting without shifting date-only events
- Light, dark, custom theme, desktop, and mobile support
- Optional Style Settings controls through CSS variables
- Diagnostics for invalid indexed notes
- Guided, mobile-friendly settings with live matching summaries and validation

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the release.
2. Create `<Vault>/.obsidian/plugins/calendar-note-view/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **Calendar Note View** in **Settings → Community plugins**.

## Sidebar Calendar

Use the ribbon icon or run **Calendar Note View: Open sidebar calendar**. The header provides Previous Month, Next Month, Today, separate Year and Month controls, and Refresh.

Date cells show Daily Note status and colored event dots or icon badges selected independently by each Source Profile. Indicators from different profiles can use different modes in the same date cell. Select a date number to open or create its Daily Note. Use the plus button or date context menu to create an event. Select an event indicator to open its note.

Refresh safely rebuilds the Sidebar event index while preserving the viewed month.

## Bases Calendar

Add a Base view and choose **Calendar** as its view type. Configure its property mapping in the view options.

The Bases Calendar uses only the Entries supplied by the current Base. Base filters, formulas, properties, sorting, and limits remain authoritative. Source Profiles never rescan or filter Bases Calendar contents.

The view supports:

- Independent Previous Month, Next Month, Today, Year, and Month controls
- Start, end, title, type, icon, background color, and text color property mapping
- Icon, Title, or Icon + Title event display
- First day of week and weekend selection
- Adjacent-month date visibility
- Maximum visible events and `+N more`
- Daily Notes and event creation actions

Updating Base data does not reset the month being viewed.

## Daily Notes

Calendar Note View uses the Obsidian Core Daily Notes folder, file name format, and template. It does not override those settings. When a Daily Note is missing, the plugin can ask for confirmation before creating and opening it.

The Daily Notes core plugin must be enabled for these actions.

## Source Profiles

Source Profiles control which notes appear in the Sidebar Calendar. They do not filter the contents of Bases Calendar views.

A profile defines:

- A system-generated stable ID that remains unchanged when the display name changes
- An explicit Order; lower values appear first in settings, event creation, and Sidebar events
- A Sidebar indicator mode using colored dots or icon badges
- Event note matching for the Sidebar Calendar
- Folder, tag, and property-scoped wiki-link matching through Metadata Cache
- `all` or `any` matching across configured condition groups
- Start-property-only matching when explicitly enabled
- Property mapping and default icon, background color, and text color
- Event creation folder, template, file name, and generated title rules

Values inside one condition group use OR. For example, folders `Events` and `Holidays` mean `Events OR Holidays`; multiple configured Wiki Links also use OR. Only non-empty groups participate in the profile's **All configured groups** or **Any configured group** mode. A profile with no source conditions does not scan the entire vault unless **Match start property only** is enabled. Start-property-only never bypasses a configured Folder, Tag, or Wiki Link condition.

Profile names are labels rather than identities, so profiles may share the same name and can be renamed safely. Declarative Settings pages use the immutable generated ID for navigation. Use drag-and-drop, **Move up**, **Move down**, or the Advanced **Order** field to control priority; the plugin normalizes the result to a stable sequence.

Select **Add source profile** and choose a Folder, Tag, Wiki Link, Start-property-only, or Empty / Advanced preset. New profiles begin disabled so their Start property and source conditions can be reviewed before indexing. **Duplicate** copies the complete configuration into a new Profile with a new ID and unique display name.

Folder matching normalizes slash direction and leading or trailing separators, includes descendants, and respects path boundaries. A configured `Events` folder matches `Events/Holidays/Trip.md` but not `Events-Archive/Trip.md`.

Folders are edited as individual tokens. Type a partial path and select a contextual floating suggestion with the mouse, touch, or keyboard. Selecting a suggestion appends one Folder without replacing existing tokens. Each token can be removed independently.

Tag matching uses Obsidian's combined cached Properties and inline tags. Tags are displayed as individual `#tag` tokens with MetadataCache suggestions. Tags match exactly, so `#calendar` does not automatically include `#calendar/holiday`; configure both when both should match.

Wiki Link matching reads only the frontmatter property selected in **Wiki link property**. Its value may be a YAML string or array containing wiki links or plain-text targets. Short paths, full paths, aliases, `.md`, and heading subpaths resolve through Obsidian's Metadata Cache; arbitrary outgoing links and embeds in the note body are not source conditions. Wiki Link targets are edited as independent tokens with a floating note suggestion popover. Full paths distinguish same-name notes in different folders.

Source Profile icons provide suggestions from Obsidian's installed icon set. Default background and text colors can use a selected Obsidian CSS variable or **Use style settings fallback**. Style priority is note property → first matching Event Type Rule → explicit Source Profile default → Style Settings Event fallback → Obsidian theme fallback.

The Source Profile page is divided into Overview, Source matching, Property mapping, Display defaults, Event creation, Advanced, and Actions. A live sentence explains the effective All, Any, or Start-only logic, and inline validation identifies incomplete Wiki Link pairs, missing Start properties, duplicate display names, and event-creation paths. Creation-only fields stay hidden until **Allow event creation** is enabled.

Delete a Source Profile from its list action or from **Actions → Delete** inside the profile. Calendar Note View asks for confirmation and removes only the profile, its indexed Sidebar items, and related diagnostics; it never deletes event notes from the vault.

## Event Type Rules

Event Type Rules are checked from top to bottom, and the first enabled matching value supplies any configured icon, background, or text color. Rule rows show their enabled state and style summary without opening the detail page. Rules use immutable generated IDs, so Type values can be renamed safely; duplicate values show a warning because the first enabled rule wins. Drag, duplicate, or use **Move up** and **Move down** to manage precedence.

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

**Time zone** can use System, UTC, or a searchable, validated custom IANA time zone such as `Asia/Taipei`. A live preview shows the current instant in the selected zone. It affects Today highlighting and the default date in event creation. It never shifts a date-only event to another calendar date.

**Display date format** controls dates in the interface, tooltips, previews, and confirmation text. Common formats are available as presets, while Custom retains strict validation and a live example.

**Event property date format** strictly parses and writes event properties. It has an independent preset or Custom value and example. Internally, every calendar date remains `YYYY-MM-DD`.

Daily Note file names continue to use the Core Daily Notes format.

## Style Settings

Calendar Note View works without the Style Settings plugin. If Style Settings is installed, its **Calendar Note View** section is organized by where a change appears:

- **Calendar essentials** — shared font and navigation icons
- **Sidebar calendar** — Sidebar background, weekday labels, navigation row, spacing, and day cells
- **Bases calendar** — navigation row, weekday row, grid, date badge, event-bar layout, and overflow count
- **Date appearance and states** — shared date numbers, hover, Other month, Weekend, and Today
- **Items and indicators** — Event fallback colors, dots, icons, corners, and Daily Note indicators

Color selectors contain only choices relevant to their purpose: background selectors use Obsidian background, accent, and extended color variables; text selectors use text, accent, and extended color variables. Choose **Custom** to activate the paired light/dark color setting. Otherwise, the selector follows Obsidian theme variables and adapts to Light, Dark, and custom themes.

Date-state priority is **ordinary date → Weekend → Other month → Today → hover/focus**. This keeps an adjacent-month weekend visually grouped with the other adjacent dates while retaining Today and interaction feedback. The Bases date badge is circular by default; **Bases calendar → Date badge corner radius** changes it from square to round.

Event fallback colors apply only when the note, matching Type Style Rule, and Source Profile do not provide a color override.

## Diagnostics

The Settings **Quick status** section shows enabled Source Profiles, indexed Events, diagnostics, index readiness, and automatic save state. Use **Open diagnostics** or **Refresh index** directly from Settings. Refresh performs one full rebuild and one Sidebar notification.

Run **Calendar Note View: Open calendar diagnostics** to inspect indexed note issues. The dialog shows the diagnostic code, message, file, and Source Profile. Select a file to open it. Profile-level issues are labeled as Profile settings instead of rendering an empty file action.

## Mobile

The Sidebar Calendar, Bases Calendar, date actions, event actions, Create Event dialog, token editors, action menus, and floating suggestions use responsive layouts and public Obsidian APIs. Settings provide keyboard alternatives to drag-and-drop, viewport-clamped suggestions, screen-reader state, and touch-sized controls. No desktop-only Node or Electron APIs are used.

## Known limitations

- Version 0.3.x provides month views only; it does not include year, week, day, or hour timelines.
- Recurring events, reminders, external calendar sync, drag-and-drop, and event resizing are not included.
- Daily Notes integration uses `obsidian-daily-notes-interface` as a compatibility layer around the Core Daily Notes plugin.
- Formula values in Bases must render to a value compatible with the configured strict event property date format.

## Privacy

Calendar Note View runs locally in Obsidian. It does not send vault contents, file names, settings, or usage data to external services, and it includes no telemetry or network requests.

## AI development disclosure

This plugin was developed with significant AI assistance. The project owner directed the design, requirements, review, and release decisions. AI-assisted changes were validated with TypeScript type checking, ESLint, automated tests, production builds, and project-owner review.

## License

Calendar Note View is released under the [MIT License](LICENSE).
