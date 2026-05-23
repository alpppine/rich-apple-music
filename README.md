# Rich Apple Music Links

An Obsidian plugin that turns `music.apple.com` links into iMessage-style rich preview cards in reading view, complete with cover art, artist and album metadata, and an inline 30 second preview player.

![Example: a Bonny Light Horseman song card showing artwork, title, artist, genre and a play button.](docs/example.png)

> Paste any Apple Music URL on its own line and the plugin will replace it with a card the next time the note renders.

## Features

- Recognizes song, album, artist, music video, playlist and station links from `music.apple.com` (any storefront).
- Renders cards in **both** reading view and Live Preview / Source mode.
- Fetches public metadata from the iTunes Lookup API so no Apple Developer credentials or sign-in are needed.
- Inline 30 second audio preview with a single tap-to-play overlay on the artwork (toggleable).
- Cards adapt to light and dark themes via Obsidian CSS variables.
- Smart link handling: only naked URLs become cards by default, with an opt-in to also convert `[label](url)` markdown links.
- In Live Preview, clicking on the line (or moving the cursor onto it) automatically reveals the raw URL so you can edit it.
- In-memory cache so the same link is only fetched once per session, even when you scroll back and forth between notes.

## Example

In your note:

```markdown
Listening to this on repeat:

https://music.apple.com/us/album/once-on-another-day-feat-ana%C3%AFs-mitchell-eric-d-johnson/1663557047?i=1663557054
```

When the note is rendered, the URL is replaced with a card showing the cover art, song title, the artist and album, genre, length and a play button for the 30 second preview.

## Settings

- **Show preview player** - toggle the play button overlay on the artwork. When off, the artwork is a plain image link to Apple Music.
- **Show open button** - toggle the small "Open" pill on the right side of each card.
- **Convert labeled links** - when enabled, markdown links with a custom label (for example `[Listen here](https://music.apple.com/...)`) are also turned into cards. Off by default so your prose links stay intact.

## How it works

1. **Reading view**: a markdown post processor scans each rendered chunk for `<a href="...">` elements pointing at `music.apple.com`.
2. **Live Preview / Source mode**: a CodeMirror 6 `ViewPlugin` walks the visible document and uses a block `replace` decoration to swap standalone Apple Music URL lines with a card widget. Whenever the cursor or selection touches that line, the decoration is suppressed so you can edit the raw text.
3. The URL is parsed into its storefront, kind (song/album/artist/...) and ids.
4. The plugin calls `https://itunes.apple.com/lookup` (a free, no-auth Apple endpoint) to fetch title, artist, artwork, preview URL and other metadata.
5. The original anchor (or paragraph, if the anchor was the only thing in it) is swapped for a rich card. While metadata is loading a skeleton card is shown. The cache is shared between reading view and Live Preview so each link is fetched at most once per session.

## Privacy

- Network calls go directly from your Obsidian client to `itunes.apple.com` and to the Apple-hosted artwork/preview CDNs only when a card actually needs to be rendered.
- No telemetry of any kind. No data is sent to the plugin author.
- Nothing is stored to disk - the metadata cache lives only in memory for the current session.

## Caveats

- In Live Preview, only URLs that sit on their own line (with a blank line above and below, or at the very start / end of the note) become cards. URLs in the middle of a paragraph are left untouched so they don't shred the surrounding prose.
- Playlists and stations don't expose deep metadata via the lookup API; their cards fall back to a slug-based title and a generic icon.
- Apple Music subscription is not required to view the card or play the 30 second preview, but is required to open the full track in Apple Music.

## Development

```bash
npm install
npm run dev      # watch build into main.js
npm run build    # production build
npm run lint
```

Source layout:

```
src/
  main.ts                 # plugin lifecycle
  settings.ts             # settings tab
  applemusic/
    parser.ts             # music.apple.com URL parser
    api.ts                # iTunes Lookup client + memory cache
    card.ts               # DOM renderer for the rich card
    processor.ts          # reading-view markdown post processor
    livePreview.ts        # CodeMirror 6 ViewPlugin + widget for Live Preview
styles.css                # card styling
```

## License

0BSD.
