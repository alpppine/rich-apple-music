import { requestUrl } from "obsidian";
import type { AppleMusicLink } from "./parser";

export interface AppleMusicMetadata {
	kind: "song" | "album" | "artist" | "playlist" | "music-video" | "station";
	title: string;
	subtitle: string;
	artist: string | null;
	collection: string | null;
	artworkUrl: string | null;
	previewUrl: string | null;
	durationMs: number | null;
	releaseDate: string | null;
	genre: string | null;
	href: string;
	explicit: boolean;
	trackCount: number | null;
}

interface ItunesResult {
	wrapperType?: string;
	kind?: string;
	collectionType?: string;
	artistName?: string;
	collectionName?: string;
	trackName?: string;
	collectionCensoredName?: string;
	trackCensoredName?: string;
	artistViewUrl?: string;
	collectionViewUrl?: string;
	trackViewUrl?: string;
	previewUrl?: string;
	artworkUrl30?: string;
	artworkUrl60?: string;
	artworkUrl100?: string;
	artworkUrl600?: string;
	releaseDate?: string;
	primaryGenreName?: string;
	trackTimeMillis?: number;
	collectionExplicitness?: string;
	trackExplicitness?: string;
	trackCount?: number;
}

interface ItunesResponse {
	resultCount: number;
	results: ItunesResult[];
}

const ENTITY_BY_KIND: Record<string, string> = {
	song: "song",
	album: "album",
	artist: "musicArtist",
	"music-video": "musicVideo",
};

const ARTWORK_SIZE = "600x600bb";

export interface MetadataCache {
	get(key: string): AppleMusicMetadata | undefined;
	set(key: string, value: AppleMusicMetadata): void;
	delete(key: string): void;
}

export class MemoryMetadataCache implements MetadataCache {
	private readonly store = new Map<string, AppleMusicMetadata>();
	private readonly maxEntries: number;

	constructor(maxEntries = 256) {
		this.maxEntries = maxEntries;
	}

	get(key: string): AppleMusicMetadata | undefined {
		const value = this.store.get(key);
		if (value) {
			// LRU-ish: re-insert to mark as recently used.
			this.store.delete(key);
			this.store.set(key, value);
		}
		return value;
	}

	set(key: string, value: AppleMusicMetadata): void {
		if (this.store.has(key)) this.store.delete(key);
		this.store.set(key, value);
		while (this.store.size > this.maxEntries) {
			const iter = this.store.keys().next();
			if (iter.done || iter.value === undefined) break;
			this.store.delete(iter.value);
		}
	}

	delete(key: string): void {
		this.store.delete(key);
	}
}

export function cacheKeyFor(link: AppleMusicLink): string {
	if (link.trackId) return `track:${link.storefront}:${link.trackId}`;
	return `${link.kind}:${link.storefront}:${link.id}`;
}

/**
 * Fetch enriched metadata for an Apple Music link via the public iTunes Lookup
 * API. Falls back to a minimal metadata record if the API has nothing for us.
 */
export async function fetchAppleMusicMetadata(
	link: AppleMusicLink,
	cache?: MetadataCache,
): Promise<AppleMusicMetadata> {
	const key = cacheKeyFor(link);
	const cached = cache?.get(key);
	if (cached) return cached;

	const lookupId = link.trackId ?? link.id;
	const entity = link.trackId ? "song" : ENTITY_BY_KIND[link.kind] ?? "album";
	const params = new URLSearchParams({
		id: lookupId,
		entity,
		country: link.storefront.toUpperCase(),
		limit: "1",
	});

	let response: ItunesResponse | null = null;
	try {
		const res = await requestUrl({
			url: `https://itunes.apple.com/lookup?${params.toString()}`,
			method: "GET",
			throw: false,
		});
		if (res.status >= 200 && res.status < 300) {
			response = JSON.parse(res.text) as ItunesResponse;
		}
	} catch {
		response = null;
	}

	const first = response?.results?.[0];
	const metadata = first
		? itunesResultToMetadata(first, link)
		: fallbackMetadata(link);

	cache?.set(key, metadata);
	return metadata;
}

function itunesResultToMetadata(
	result: ItunesResult,
	link: AppleMusicLink,
): AppleMusicMetadata {
	const isTrack = Boolean(result.trackName);
	const isAlbum =
		result.wrapperType === "collection" || result.collectionType === "Album";
	const isMusicVideo =
		result.kind === "music-video" || result.wrapperType === "track" && result.kind === "music-video";
	const isArtist = result.wrapperType === "artist";

	let kind: AppleMusicMetadata["kind"] = link.kind;
	if (isMusicVideo) kind = "music-video";
	else if (isArtist) kind = "artist";
	else if (link.trackId || (isTrack && !isAlbum)) kind = "song";
	else if (isAlbum) kind = "album";

	const title =
		(kind === "song" || kind === "music-video"
			? result.trackName
			: kind === "album"
				? result.collectionName
				: kind === "artist"
					? result.artistName
					: result.trackName ?? result.collectionName) ?? "Apple Music";

	const artworkUrl = upgradeArtwork(
		result.artworkUrl100 ?? result.artworkUrl60 ?? result.artworkUrl30 ?? null,
	);

	const href =
		result.trackViewUrl ?? result.collectionViewUrl ?? result.artistViewUrl ?? link.href;

	const artist = result.artistName ?? null;
	const collection = result.collectionName ?? null;

	const subtitle = buildSubtitle(kind, artist, collection);

	const explicit =
		result.trackExplicitness === "explicit" ||
		result.collectionExplicitness === "explicit";

	return {
		kind,
		title,
		subtitle,
		artist,
		collection,
		artworkUrl,
		previewUrl: result.previewUrl ?? null,
		durationMs: result.trackTimeMillis ?? null,
		releaseDate: result.releaseDate ?? null,
		genre: result.primaryGenreName ?? null,
		href: stripUoParam(href),
		explicit,
		trackCount: result.trackCount ?? null,
	};
}

function fallbackMetadata(link: AppleMusicLink): AppleMusicMetadata {
	const fallbackTitle = link.slug
		? decodeURIComponent(link.slug).replace(/-/g, " ")
		: "Apple Music";
	return {
		kind: link.kind,
		title: titleCase(fallbackTitle),
		subtitle: "Apple Music",
		artist: null,
		collection: null,
		artworkUrl: null,
		previewUrl: null,
		durationMs: null,
		releaseDate: null,
		genre: null,
		href: link.href,
		explicit: false,
		trackCount: null,
	};
}

function buildSubtitle(
	kind: AppleMusicMetadata["kind"],
	artist: string | null,
	collection: string | null,
): string {
	const cleanedCollection = collection
		? collection.replace(/\s*-\s*Single$/i, "").replace(/\s*-\s*EP$/i, "")
		: null;

	switch (kind) {
		case "song":
		case "music-video":
			if (artist && cleanedCollection) return `${artist} \u2014 ${cleanedCollection}`;
			return artist ?? cleanedCollection ?? "Apple Music";
		case "album":
			return artist ?? "Album";
		case "artist":
			return "Artist";
		case "playlist":
			return "Playlist";
		case "station":
			return "Station";
		default:
			return "Apple Music";
	}
}

function upgradeArtwork(url: string | null): string | null {
	if (!url) return null;
	return url.replace(/\/\d+x\d+bb(?:-\d+)?\.(jpg|png|webp)$/i, `/${ARTWORK_SIZE}.$1`);
}

function stripUoParam(url: string): string {
	try {
		const u = new URL(url);
		u.searchParams.delete("uo");
		return u.toString();
	} catch {
		return url;
	}
}

function titleCase(input: string): string {
	return input.replace(/\b\w/g, (c) => c.toUpperCase());
}
