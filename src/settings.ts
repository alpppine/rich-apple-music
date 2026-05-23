import { App, PluginSettingTab, Setting } from "obsidian";
import type RichAppleMusicPlugin from "./main";

export interface RichAppleMusicSettings {
	showPreviewPlayer: boolean;
	openInAppleMusic: boolean;
	convertLabeledLinks: boolean;
}

export const DEFAULT_SETTINGS: RichAppleMusicSettings = {
	showPreviewPlayer: true,
	openInAppleMusic: true,
	convertLabeledLinks: false,
};

export class RichAppleMusicSettingTab extends PluginSettingTab {
	plugin: RichAppleMusicPlugin;

	constructor(app: App, plugin: RichAppleMusicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Show preview player")
			.setDesc("Add a play button to the artwork that streams the 30 second Apple Music preview when available.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showPreviewPlayer)
					.onChange(async (value) => {
						this.plugin.settings.showPreviewPlayer = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show open button")
			.setDesc("Display an open shortcut on each card that links straight to Apple Music.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openInAppleMusic)
					.onChange(async (value) => {
						this.plugin.settings.openInAppleMusic = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Convert labeled links")
			.setDesc("Also transform Markdown links with custom labels, like [Listen](https://music.apple.com/...). When off, only naked URLs become cards.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.convertLabeledLinks)
					.onChange(async (value) => {
						this.plugin.settings.convertLabeledLinks = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
