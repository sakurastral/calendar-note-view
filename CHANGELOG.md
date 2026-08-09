# Changelog

All notable changes to Calendar Note View are documented in this file.

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
