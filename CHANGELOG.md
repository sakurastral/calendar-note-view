# Changelog

All notable changes to Calendar Note View are documented in this file.

## 0.4.1

### Added

- Add a Base-native event creation dialog backed by the public `BasesView.createFileForView()` API
- Add localized, keyboard-accessible date Agendas with public Bases Value rendering and note actions
- Add container-responsive Comfortable, Compact, and Automatic layouts with touch-friendly compact indicators
- Add localized empty, invalid-entry, and current-month feedback with a safe skipped-entry list
- Add event hover, pressed, focus, selected-date, Agenda, compact-indicator, and invalid-notice Style Settings

### Changed

- Preserve the exact order of `this.data.data` through lane allocation, overflow, Agenda, and event details
- Reorganize Bases view options into Required mapping, Event content, Event styling, Calendar layout, and Advanced
- Replace raw weekend values and the event-row slider with readable presets while safely migrating existing view configuration
- Make visible Base properties secondary content beside the title and render their complete public Values in Agenda details
- Use an Obsidian tooltip and an inclusive date range for every Bases event without a duplicate native tooltip

### Fixed

- Stop Bases date-cell creation from inheriting Source Profile folders, templates, mappings, or filtering behavior
- Disable creation when Start maps to a formula or file property and skip all other non-writable mappings safely
- Preserve the viewed month, selected date, and reasonable keyboard focus across Base data updates and responsive rerenders
- Prevent invalid formula or date Values from aborting the complete Calendar render

## 0.4.0

### Added

- Add a Calendar language dropdown with System, English, Traditional Chinese, Simplified Chinese, Japanese, and Korean calendar labels
- Add Event Type intellisense to the Create Event dialog
- Add a Bases event display mode that renders the properties currently visible in the Base
- Accept date and datetime Values for Sidebar and Bases Start and End property mappings without shifting the written date

### Changed

- Change Source Profile Default type to a dropdown populated from configured and indexed event types
- Expand the Bases maximum event row limit to 12 and clarify that the option controls rows shown per day
- Add a configurable hover text color and ensure Weekend and Today cells receive complete hover feedback
- Show Sidebar event names through Obsidian tooltips without a duplicate native browser tooltip

## 0.3.2

### Fixed

- Avoid ES2022 `Array.prototype.at()` in runtime source so official ES2021 type analysis remains safe
- Narrow the Daily Notes `moment()` result before returning it from typed code
- Resolve the remaining official unsafe assignment, call, member access, argument, and return warnings

## 0.3.1

### Changed

- Update the Obsidian ESLint rules to match the current official reviewer

### Fixed

- Create floating suggestion elements with Obsidian's public element helpers
- Eliminate the official `prefer-create-el` source review warnings

## 0.3.0

### Changed

- Re-license Calendar Note View under the MIT License
- Mark the plugin as beta in the README before its initial public release

## 0.2.9

### Added

- Add a Quick status dashboard with enabled Profile, indexed Event, diagnostics, index, and settings-save status
- Add guided Folder, Tag, Wiki Link, Start-property-only, and Advanced presets for new Source Profiles
- Add Source Profile and Event Type Rule duplication, move up, move down, and contextual action menus
- Add accessible Folder, Tag, and Wiki Link token editors with contextual floating suggestions
- Add live matching summaries, Profile validation, date-format examples, time-zone previews, and Event Type Rule previews

### Changed

- Reorganize Source Profile settings into Overview, Source matching, Property mapping, Display defaults, Event creation, Advanced, and Actions
- Use immutable IDs as declarative settings page identities so renaming or duplicate display values cannot invalidate navigation
- Replace numeric Weekend input with human-readable weekday buttons while preserving the existing persisted weekday array
- Show event-creation fields only when creation is enabled and show Match mode or Start-only controls only when they are relevant
- Make Source Profile and Event Type Rule list rows summarize their state, matching source, style, and indexed event count
- Improve Settings controls for keyboard, screen-reader, touch, mobile viewport, Light, Dark, and custom themes

### Fixed

- Keep failed writes visible and retryable while continuing to serialize saves so an older asynchronous write cannot win
- Keep Folder, Tag, and Wiki Link suggestions above the Settings modal, clamped to the visual viewport, and connected through ARIA listbox state
- Prevent Profile names and Event Type values from acting as mutable settings navigation identities

## 0.2.8

### Changed

- Move the Sidebar indicator mode from Calendar behavior into each Source Profile
- Allow colored dots and icon badges from different Source Profiles to appear together in the same Sidebar date cell
- Migrate the former global Sidebar indicator mode into profiles that do not already define their own mode

### Fixed

- Re-render the Sidebar without rebuilding its Vault index when a profile's indicator mode changes

## 0.2.7

### Added

- Add a persisted numeric Order to each Source Profile; lower values appear first in settings, event creation, and Sidebar event ordering
- Show the immutable system-generated Profile ID in Source Profile settings

### Changed

- Generate and immediately persist UUID-backed IDs for new, missing, or duplicate Source Profile identities
- Give declarative Source Profile pages a unique ID-qualified page name so duplicate display names remain independent

### Fixed

- Prevent renaming a Source Profile from invalidating the currently open declarative settings subpage
- Raise Folder and Wiki Link suggestion popovers above the Obsidian settings modal so they remain visible and interactive

## 0.2.6

### Changed

- Show Folder and Wiki Link target suggestions in a viewport-level floating popover with mouse and keyboard selection

### Fixed

- Commit a selected Folder through the Source Profile's stable-ID settings callback while preserving other comma-separated folders
- Keep the saved cursor position during suggestion clicks so focus changes cannot replace the wrong Folder or Wiki Link target
- Prevent Wiki Link target suggestions from taking space in, or overlapping, the settings row

## 0.2.5

### Changed

- Remove Task as a current data model, Sidebar, Bases, style, option, and runtime concept; all calendar entries are events
- Restore Wiki Link source matching to the explicit `wikiLinkProperty` and `wikiLinkTargets` model
- Debounce and coalesce settings writes, flush edits when leaving settings, and classify index, render-only, and save-only changes
- Allow Source Profile background and text defaults to inherit the Style Settings Event fallback
- Read Bases `DateValue`, `ListValue`, and `LinkValue` through their public Value APIs while continuing to use only `this.data.data`

### Fixed

- Persist the latest Source Profile and Event Type values through slow writes, navigation, settings reopening, and plugin reload
- Prevent Profile names, creation templates, display settings, and Event Type styles from causing unnecessary full Vault rebuilds
- Match folders, cached tags, and configured frontmatter Wiki Links with correct All, Any, and Start-only boundaries
- Remove ghost items, diagnostics, and reverse-index paths after file or folder rename and move operations
- Store Sidebar and Bases style diagnostics and validate icons against Obsidian's installed icon set
- Avoid rendering profile-level diagnostics as empty file buttons

## 0.2.4

### Changed

- Rebuild Source Matching as a dedicated cached-metadata matcher shared by full and incremental Sidebar indexing
- Use Obsidian's combined Properties and inline tag collection instead of manually relying on one frontmatter shape
- Resolve configured and outgoing Wiki Links to canonical vault paths, including short paths, full paths, aliases, headings, Properties links, and embeds
- Combine only configured condition groups: values inside Folder, Tag, and Wiki Link use OR; Match mode applies All or Any across those groups
- Clarify Source Matching settings descriptions and the Start-property-only fallback behavior

### Fixed

- Match normalized Folder paths and descendants without matching similarly prefixed folders
- Reindex notes when Obsidian finishes resolving outgoing links so Wiki Link matches do not remain stale
- Prevent same-name notes in different folders from matching the wrong resolved Wiki Link
- Persist Folder, Property, and Icon suggestions through their settings callbacks instead of relying on synthetic input events
- Replace a partial query such as `eve` with the selected `Events` value immediately and retain it after reopening settings

## 0.2.3

### Added

- Source Profile icon suggestions from Obsidian's installed icon set
- Theme-aware default background and text color selectors for Source Profiles
- Multi-line Wiki Link input with one link per line

### Changed

- Treat all Source Profiles as events and remove the Kind and task-completion controls from Source Profile settings
- Migrate old Source Profile task kinds and unsupported custom default colors to event-safe Obsidian CSS variable defaults
- Save Source Profile and Event Type edits by stable ID and serialize settings writes

### Fixed

- Apply the Sidebar Default day cell background setting with sufficient specificity to override generic theme button styles
- Apply Default date number color to Sidebar date numbers
- Refresh Source Profile and Event Type list labels after their names are edited
- Preserve newly added Source Profile values when returning to the settings list

## 0.2.2

### Changed

- Reorganize Style Settings into five task-focused sections: Calendar essentials, Sidebar calendar, Bases calendar, Date appearance and states, and Items and indicators
- Rename controls and add descriptions that identify the affected view, element, fallback behavior, and date-state priority
- Limit background, text, border, and indicator selectors to relevant Obsidian theme variables while retaining extended color presets and custom light/dark colors
- Use theme-aware semantic variables as the default color source; custom colors now apply only when Custom is selected
- Add a generator and consistency check for the Style Settings definition to prevent empty or misplaced groups

### Fixed

- Keep Other-month styling above Weekend styling when a date has both states, including July 26 in an August 2026 calendar
- Keep hover and keyboard-focus feedback visible above ordinary date-state backgrounds
- Route Event and Task fallback colors through the selected Style Settings source instead of bypassing official variable choices
- Give ordinary Bases date badges an explicit theme-aware background so their circular shape no longer depends on generic theme button styles

## 0.2.1

### Added

- Visible Source Profile deletion with confirmation from both the profile list and detail page
- Obsidian semantic and extended color variable presets for every Style Settings color control
- Adjustable Bases date-number border radius

### Changed

- Render Bases date numbers as circles by default, including Today and hover backgrounds
- Prefer theme-aware Obsidian variables while retaining custom light and dark color pickers

## 0.2.0

### Added

- Working light and dark Style Settings color controls for Sidebar and Bases calendars
- Property suggestions for Source Profile mappings and searchable Bases property selectors
- Event template variable references in Source Profile settings
- Multiple Wiki Link suggestions and matching through Obsidian Metadata Cache

### Changed

- Start new Source Profiles and Bases Calendar views with blank property mappings
- Use `{date-range} {title}` for default file names and generated titles
- Move Match mode into Source matching
- Match configured Wiki Links in note content and Properties instead of reading one configured frontmatter property

### Fixed

- Supply required light and dark defaults for every themed Style Settings color control

## 0.1.1

### Fixed

- Preserve the Bases Calendar and its view controls when switching to another tab and back

## 0.1.0

Initial release.

### Added

- Sidebar month calendar with year and month navigation
- Source Profiles with folder, tag, wiki-link property, and start-property matching
- Incremental event index with create, edit, rename, move, delete, rebuild, and range queries
- Strict date-only parsing, inclusive end dates, time zone-aware Today, and separate display/storage formats
- Daily Notes indicators, opening, confirmation, and creation
- Event creation with property mapping, templates, previews, nested folders, and collision handling
- Bases Calendar view using only the current Base's filtered Entries
- Bases property mapping, independent navigation, Daily Notes, event display modes, task visibility, and adjacent dates
- Multi-day range segmentation, stable lane allocation, cross-week/cross-month display, and `+N more`
- Type style rules, note-level overrides, safe CSS colors, and Style Settings variables
- Diagnostics command and file-opening dialog
- Responsive desktop and mobile styling
