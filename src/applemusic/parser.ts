export type AppleMusicKind =
	| "song"
	| "album"
	| "artist"
	| "playlist"
	| "music-video"
	| "station";

export interface AppleMusicLink {
	href: string;
	storefront: string;
	kind: AppleMusicKind;
	slug: string;
	id: string;
	trackId: string | null;
}

const APPLE_HOSTS = new Set([
	"music.apple.com",
	"geo.music.apple.com",
	"beta.music.apple.com",
	"embed.music.apple.com",
]);

const KIND_PATHS: Record<string, AppleMusicKind> = {
	album: "album",
	song: "song",
	artist: "artist",
	playlist: "playlist",
	"music-video": "music-video",
	station: "station",
};

/**
 * Parse a music.apple.com URL into its semantic parts.
 *
 * Supported shapes (slug segment is optional in some shares):
 *   https://music.apple.com/<storefront>/<kind>/<slug>/<id>
 *   https://music.apple.com/<storefront>/<kind>/<id>
 *   https://music.apple.com/<storefront>/album/<slug>/<id>?i=<trackId>
 */
export function parseAppleMusicUrl(input: string): AppleMusicLink | null {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return null;
	}

	if (!APPLE_HOSTS.has(url.hostname)) return null;

	const segments = url.pathname.split("/").filter(Boolean);
	if (segments.length < 3) return null;

	const storefront = (segments[0] ?? "").toLowerCase();
	const kindSegment = (segments[1] ?? "").toLowerCase();
	const kind = KIND_PATHS[kindSegment];
	if (!kind) return null;

	const last = segments[segments.length - 1] ?? "";
	const secondLast = segments[segments.length - 2] ?? "";

	let id = "";
	let slug = "";
	if (/^[0-9]+$/.test(last)) {
		id = last;
		slug = segments.length >= 4 ? secondLast : "";
	} else if (/^pl\..+/i.test(last) || /^ra\..+/i.test(last)) {
		id = last;
		slug = segments.length >= 4 ? secondLast : "";
	} else {
		return null;
	}

	if (!storefront || !id) return null;

	const trackId = url.searchParams.get("i");

	return {
		href: input,
		storefront,
		kind,
		slug,
		id,
		trackId: trackId && /^[0-9]+$/.test(trackId) ? trackId : null,
	};
}
