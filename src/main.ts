import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	RichAppleMusicSettings,
	RichAppleMusicSettingTab,
} from "./settings";
import { MemoryMetadataCache } from "./applemusic/api";
import {
	createAppleMusicPostProcessor,
	type ProcessorDeps,
	type ProcessorOptions,
} from "./applemusic/processor";
import { appleMusicLivePreviewExtension } from "./applemusic/livePreview";

export default class RichAppleMusicPlugin extends Plugin {
	settings: RichAppleMusicSettings = { ...DEFAULT_SETTINGS };
	private readonly cache = new MemoryMetadataCache();

	async onload(): Promise<void> {
		await this.loadSettings();

		const deps: ProcessorDeps = {
			cache: this.cache,
			getOptions: (): ProcessorOptions => ({
				showPreviewPlayer: this.settings.showPreviewPlayer,
				openInAppleMusic: this.settings.openInAppleMusic,
				convertLabeledLinks: this.settings.convertLabeledLinks,
			}),
		};

		this.registerMarkdownPostProcessor(createAppleMusicPostProcessor(deps));
		this.registerEditorExtension(appleMusicLivePreviewExtension(deps));

		this.addSettingTab(new RichAppleMusicSettingTab(this.app, this));
	}

	onunload(): void {
		document
			.querySelectorAll<HTMLAudioElement>("audio.ram-card__audio")
			.forEach((audio) => {
				if (!audio.paused) audio.pause();
			});
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<RichAppleMusicSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
