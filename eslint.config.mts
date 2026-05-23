import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";

// Brand names that should keep their original capitalization in UI text.
const EXTRA_BRANDS = ["Apple Music", "iTunes", "iMessage"];

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					brands: [...DEFAULT_BRANDS, ...EXTRA_BRANDS],
				},
			],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
