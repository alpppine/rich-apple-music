import { setIcon } from "obsidian";
import type { AppleMusicLink } from "./parser";
import type { AppleMusicMetadata } from "./api";

// Brand label - capitalization is part of the trademark and intentional.
const APPLE_MUSIC_LABEL = "Apple Music";

export interface CardOptions {
	showPreviewPlayer: boolean;
	openInAppleMusic: boolean;
}

/**
 * Build the skeleton card while metadata is loading. The same root element is
 * later hydrated by {@link hydrateCard} with the fetched metadata.
 */
export function createSkeletonCard(link: AppleMusicLink): HTMLElement {
	const card = document.createElement("div");
	card.addClass("ram-card", "ram-card--loading");
	card.dataset.kind = link.kind;
	card.setAttr("role", "group");
	card.setAttr("aria-busy", "true");
	card.setAttr("aria-label", "Loading Apple Music preview");

	const artwork = card.createDiv({ cls: "ram-card__artwork ram-card__artwork--placeholder" });
	setIcon(artwork, "music");

	const body = card.createDiv({ cls: "ram-card__body" });
	body.createDiv({ cls: "ram-card__skeleton ram-card__skeleton--title" });
	body.createDiv({ cls: "ram-card__skeleton ram-card__skeleton--subtitle" });
	body.createDiv({ cls: "ram-card__skeleton ram-card__skeleton--meta" });

	const aside = card.createDiv({ cls: "ram-card__aside" });
	const badge = aside.createDiv({ cls: "ram-card__badge" });
	badge.setText(APPLE_MUSIC_LABEL);

	return card;
}

export function hydrateCard(
	card: HTMLElement,
	metadata: AppleMusicMetadata,
	options: CardOptions,
): void {
	card.empty();
	card.removeClass("ram-card--loading");
	card.removeAttribute("aria-busy");
	card.dataset.kind = metadata.kind;
	card.setAttr("aria-label", `${metadata.title} on Apple Music`);

	const artworkAnchor = card.createEl("a", {
		cls: "ram-card__artwork-link",
		href: metadata.href,
	});
	artworkAnchor.setAttr("target", "_blank");
	artworkAnchor.setAttr("rel", "noopener noreferrer");

	const artwork = artworkAnchor.createDiv({ cls: "ram-card__artwork" });
	if (metadata.artworkUrl) {
		const img = artwork.createEl("img", {
			cls: "ram-card__artwork-img",
			attr: {
				src: metadata.artworkUrl,
				alt: `${metadata.title} artwork`,
				loading: "lazy",
				referrerpolicy: "no-referrer",
			},
		});
		img.addEventListener("error", () => {
			img.remove();
			artwork.addClass("ram-card__artwork--placeholder");
			setIcon(artwork, kindToIcon(metadata.kind));
		});
	} else {
		artwork.addClass("ram-card__artwork--placeholder");
		setIcon(artwork, kindToIcon(metadata.kind));
	}

	if (options.showPreviewPlayer && metadata.previewUrl) {
		mountPreviewOverlay(artwork, metadata.previewUrl, metadata.title);
	}

	const body = card.createDiv({ cls: "ram-card__body" });

	const titleRow = body.createDiv({ cls: "ram-card__title-row" });
	const titleLink = titleRow.createEl("a", {
		cls: "ram-card__title",
		href: metadata.href,
		text: metadata.title,
	});
	titleLink.setAttr("target", "_blank");
	titleLink.setAttr("rel", "noopener noreferrer");

	if (metadata.explicit) {
		const explicit = titleRow.createSpan({ cls: "ram-card__explicit" });
		explicit.setText("E");
		explicit.setAttr("aria-label", "Explicit");
		explicit.setAttr("title", "Explicit");
	}

	if (metadata.subtitle) {
		body.createDiv({ cls: "ram-card__subtitle", text: metadata.subtitle });
	}

	const metaBits: string[] = [];
	metaBits.push(kindLabel(metadata.kind));
	if (metadata.genre) metaBits.push(metadata.genre);
	if (metadata.durationMs != null) metaBits.push(formatDuration(metadata.durationMs));
	if (metadata.kind === "album" && metadata.trackCount != null) {
		metaBits.push(`${metadata.trackCount} ${metadata.trackCount === 1 ? "track" : "tracks"}`);
	}
	if (metadata.releaseDate) {
		const year = metadata.releaseDate.slice(0, 4);
		if (/^\d{4}$/.test(year)) metaBits.push(year);
	}

	if (metaBits.length > 0) {
		body.createDiv({ cls: "ram-card__meta", text: metaBits.join(" \u00B7 ") });
	}

	const aside = card.createDiv({ cls: "ram-card__aside" });
	const badge = aside.createDiv({ cls: "ram-card__badge" });
	badge.setText(APPLE_MUSIC_LABEL);

	if (options.openInAppleMusic) {
		const openLink = aside.createEl("a", {
			cls: "ram-card__open",
			href: metadata.href,
			text: "Open",
		});
		openLink.setAttr("target", "_blank");
		openLink.setAttr("rel", "noopener noreferrer");
		openLink.setAttr("aria-label", `Open ${metadata.title} in Apple Music`);
	}
}

export function renderErrorCard(card: HTMLElement, link: AppleMusicLink): void {
	card.empty();
	card.removeClass("ram-card--loading");
	card.addClass("ram-card--error");
	card.removeAttribute("aria-busy");

	const artwork = card.createDiv({ cls: "ram-card__artwork ram-card__artwork--placeholder" });
	setIcon(artwork, "alert-triangle");

	const body = card.createDiv({ cls: "ram-card__body" });
	body.createDiv({ cls: "ram-card__title", text: "Apple Music preview unavailable" });
	const subtitle = body.createDiv({ cls: "ram-card__subtitle" });
	const fallback = subtitle.createEl("a", { href: link.href, text: link.href });
	fallback.setAttr("target", "_blank");
	fallback.setAttr("rel", "noopener noreferrer");

	const aside = card.createDiv({ cls: "ram-card__aside" });
	aside.createDiv({ cls: "ram-card__badge", text: APPLE_MUSIC_LABEL });
}

function mountPreviewOverlay(
	artwork: HTMLElement,
	previewUrl: string,
	title: string,
): void {
	const overlay = artwork.createDiv({ cls: "ram-card__play-overlay" });
	const button = overlay.createEl("button", {
		cls: "ram-card__play-button",
		attr: { type: "button", "aria-label": `Play 30 second preview of ${title}` },
	});
	setIcon(button, "play");

	const audio = artwork.createEl("audio", {
		cls: "ram-card__audio",
		attr: { preload: "none", src: previewUrl },
	});

	button.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		if (audio.paused) {
			pauseOthers(audio);
			audio.play().catch(() => {
				setIcon(button, "play");
			});
		} else {
			audio.pause();
		}
	});

	audio.addEventListener("play", () => {
		setIcon(button, "pause");
		button.setAttr("aria-label", `Pause preview of ${title}`);
		overlay.addClass("ram-card__play-overlay--playing");
	});
	audio.addEventListener("pause", () => {
		setIcon(button, "play");
		button.setAttr("aria-label", `Play 30 second preview of ${title}`);
		overlay.removeClass("ram-card__play-overlay--playing");
	});
	audio.addEventListener("ended", () => {
		setIcon(button, "play");
		overlay.removeClass("ram-card__play-overlay--playing");
	});
}

function pauseOthers(current: HTMLAudioElement): void {
	const all = document.querySelectorAll<HTMLAudioElement>("audio.ram-card__audio");
	all.forEach((el) => {
		if (el !== current && !el.paused) el.pause();
	});
}

function kindToIcon(kind: AppleMusicMetadata["kind"]): string {
	switch (kind) {
		case "album":
			return "disc";
		case "artist":
			return "user";
		case "playlist":
			return "list-music";
		case "music-video":
			return "video";
		case "station":
			return "radio";
		default:
			return "music";
	}
}

function kindLabel(kind: AppleMusicMetadata["kind"]): string {
	switch (kind) {
		case "song":
			return "Song";
		case "album":
			return "Album";
		case "artist":
			return "Artist";
		case "playlist":
			return "Playlist";
		case "music-video":
			return "Music video";
		case "station":
			return "Station";
		default:
			return "Apple Music";
	}
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
