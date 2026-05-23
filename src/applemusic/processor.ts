import type { MarkdownPostProcessorContext } from "obsidian";
import { parseAppleMusicUrl } from "./parser";
import type { AppleMusicLink } from "./parser";
import {
	createSkeletonCard,
	hydrateCard,
	renderErrorCard,
	type CardOptions,
} from "./card";
import {
	fetchAppleMusicMetadata,
	type MetadataCache,
} from "./api";

export interface ProcessorOptions extends CardOptions {
	convertLabeledLinks: boolean;
}

export interface ProcessorDeps {
	cache: MetadataCache;
	getOptions(): ProcessorOptions;
}

/**
 * Walk the rendered markdown chunk and swap every Apple Music link with a
 * rich card. Cards mount their skeleton immediately and hydrate when metadata
 * resolves so that scrolling stays smooth even on slow networks.
 */
export function createAppleMusicPostProcessor(deps: ProcessorDeps) {
	return async function appleMusicPostProcessor(
		el: HTMLElement,
		_ctx: MarkdownPostProcessorContext,
	): Promise<void> {
		const options = deps.getOptions();
		const anchors = collectAppleMusicAnchors(el, options);
		if (anchors.length === 0) return;

		for (const { anchor, link } of anchors) {
			const card = createSkeletonCard(link);
			const host = chooseMountPoint(anchor);
			host.replaceWith(card);
			hydrateAsync(card, link, deps);
		}
	};
}

interface AnchorMatch {
	anchor: HTMLAnchorElement;
	link: AppleMusicLink;
}

function collectAppleMusicAnchors(
	el: HTMLElement,
	options: ProcessorOptions,
): AnchorMatch[] {
	const matches: AnchorMatch[] = [];
	const anchors = el.querySelectorAll<HTMLAnchorElement>("a[href]");
	anchors.forEach((anchor) => {
		const href = anchor.getAttribute("href");
		if (!href) return;
		const link = parseAppleMusicUrl(href);
		if (!link) return;

		const text = (anchor.textContent ?? "").trim();
		const isNakedLink = text.length === 0 || text === href;
		if (!isNakedLink && !options.convertLabeledLinks) return;

		matches.push({ anchor, link });
	});
	return matches;
}

/**
 * Prefer to replace the whole paragraph (or list item) when the anchor is the
 * only meaningful content, otherwise replace just the anchor so surrounding
 * prose stays intact.
 */
function chooseMountPoint(anchor: HTMLAnchorElement): HTMLElement {
	const parent = anchor.parentElement;
	if (!parent) return anchor;

	if (parent.tagName === "P" || parent.tagName === "LI") {
		const remainingText = (parent.textContent ?? "")
			.replace(anchor.textContent ?? "", "")
			.trim();
		const hasSiblingElements = Array.from(parent.children).some(
			(child) => child !== anchor,
		);
		if (remainingText.length === 0 && !hasSiblingElements) {
			return parent;
		}
	}
	return anchor;
}

function hydrateAsync(
	card: HTMLElement,
	link: AppleMusicLink,
	deps: ProcessorDeps,
): void {
	fetchAppleMusicMetadata(link, deps.cache)
		.then((metadata) => {
			if (!card.isConnected) return;
			hydrateCard(card, metadata, deps.getOptions());
		})
		.catch(() => {
			if (!card.isConnected) return;
			renderErrorCard(card, link);
		});
}
