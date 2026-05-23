import type { Extension } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";

import {
	createSkeletonCard,
	hydrateCard,
	renderErrorCard,
} from "./card";
import { fetchAppleMusicMetadata } from "./api";
import { parseAppleMusicUrl, type AppleMusicLink } from "./parser";
import type { ProcessorDeps } from "./processor";

/**
 * A line is treated as a card candidate if its trimmed content is exactly an
 * Apple Music URL, optionally wrapped in a Markdown link. The line must also
 * stand alone as its own paragraph so that block-replacing it doesn't tear
 * apart surrounding prose.
 */
const APPLE_HOST_RE =
	/https?:\/\/(?:beta\.|geo\.|embed\.)?music\.apple\.com\/[^\s)]+/;

const NAKED_URL_RE = new RegExp(`^(${APPLE_HOST_RE.source})$`);
const MD_LINK_RE = new RegExp(
	`^\\[([^\\]]+)\\]\\((${APPLE_HOST_RE.source})\\)$`,
);

interface CandidateMatch {
	url: string;
	isLabeled: boolean;
}

function matchLine(text: string): CandidateMatch | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;

	const naked = NAKED_URL_RE.exec(trimmed);
	if (naked && naked[1]) return { url: naked[1], isLabeled: false };

	const labeled = MD_LINK_RE.exec(trimmed);
	if (labeled && labeled[2]) return { url: labeled[2], isLabeled: true };

	return null;
}

/**
 * Widget that mounts the same skeleton/hydrate flow used by the reading-view
 * post processor, so Live Preview cards look identical to rendered ones.
 */
class AppleMusicCardWidget extends WidgetType {
	constructor(
		private readonly link: AppleMusicLink,
		private readonly deps: ProcessorDeps,
	) {
		super();
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof AppleMusicCardWidget &&
			other.link.href === this.link.href
		);
	}

	toDOM(): HTMLElement {
		const card = createSkeletonCard(this.link);
		card.addClass("ram-card--live-preview");
		const options = this.deps.getOptions();
		fetchAppleMusicMetadata(this.link, this.deps.cache)
			.then((metadata) => {
				if (!card.isConnected) return;
				hydrateCard(card, metadata, options);
				card.addClass("ram-card--live-preview");
			})
			.catch(() => {
				if (!card.isConnected) return;
				renderErrorCard(card, this.link);
				card.addClass("ram-card--live-preview");
			});
		return card;
	}

	destroy(dom: HTMLElement): void {
		dom.querySelectorAll<HTMLAudioElement>("audio.ram-card__audio").forEach(
			(audio) => {
				if (!audio.paused) audio.pause();
			},
		);
	}

	/**
	 * Returning true keeps clicks on the card (links, play button) from
	 * leaking into the editor as selection changes.
	 */
	ignoreEvent(): boolean {
		return true;
	}
}

function buildDecorations(
	view: EditorView,
	deps: ProcessorDeps,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const options = deps.getOptions();
	const doc = view.state.doc;
	const selectionRanges = view.state.selection.ranges;

	let lastLineProcessed = 0;
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = doc.lineAt(pos);
			if (line.number <= lastLineProcessed) {
				pos = line.to + 1;
				continue;
			}
			lastLineProcessed = line.number;
			pos = line.to + 1;

			const match = matchLine(line.text);
			if (!match) continue;
			if (match.isLabeled && !options.convertLabeledLinks) continue;

			const link = parseAppleMusicUrl(match.url);
			if (!link) continue;

			// Only swap when the URL is its own paragraph. Otherwise we'd
			// tear a block widget into the middle of soft-wrapped prose.
			if (!isStandaloneParagraph(view, line.number)) continue;

			const selectionOnLine = selectionRanges.some(
				(range) => range.from <= line.to && range.to >= line.from,
			);
			if (selectionOnLine) continue;

			builder.add(
				line.from,
				line.to,
				Decoration.replace({
					widget: new AppleMusicCardWidget(link, deps),
					block: true,
				}),
			);
		}
	}
	return builder.finish();
}

function isStandaloneParagraph(view: EditorView, lineNumber: number): boolean {
	const doc = view.state.doc;
	const prevBlank =
		lineNumber === 1 || doc.line(lineNumber - 1).text.trim().length === 0;
	const nextBlank =
		lineNumber === doc.lines ||
		doc.line(lineNumber + 1).text.trim().length === 0;
	return prevBlank && nextBlank;
}

export function appleMusicLivePreviewExtension(deps: ProcessorDeps): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, deps);
			}

			update(update: ViewUpdate): void {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.decorations = buildDecorations(update.view, deps);
				}
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
		},
	);
}
