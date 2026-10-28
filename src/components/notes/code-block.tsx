import {
	NodeViewContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import CodeBlockShiki from "tiptap-extension-code-block-shiki";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import { copy } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Code blocks highlighted by Shiki (each language and theme loads the first time it's used),
// with a header like Notion's: pick the language and colour theme, copy the code, wrap lines.

/** [Shiki id, label]; null is plain text */
const LANGUAGES: [string | null, string][] = [
	[null, "Plain text"],
	["javascript", "JavaScript"],
	["typescript", "TypeScript"],
	["jsx", "JSX"],
	["tsx", "TSX"],
	["json", "JSON"],
	["html", "HTML"],
	["css", "CSS"],
	["bash", "Bash"],
	["python", "Python"],
	["go", "Go"],
	["rust", "Rust"],
	["java", "Java"],
	["kotlin", "Kotlin"],
	["swift", "Swift"],
	["c", "C"],
	["cpp", "C++"],
	["csharp", "C#"],
	["php", "PHP"],
	["ruby", "Ruby"],
	["sql", "SQL"],
	["graphql", "GraphQL"],
	["yaml", "YAML"],
	["markdown", "Markdown"],
	["dockerfile", "Dockerfile"],
];

/** Colour themes, each a light and dark pair so code reads well in both app modes. */
const THEMES = [
	{ id: "github", label: "GitHub", light: "github-light", dark: "github-dark" },
	{
		id: "vitesse",
		label: "Vitesse",
		light: "vitesse-light",
		dark: "vitesse-dark",
	},
	{ id: "one", label: "One", light: "one-light", dark: "one-dark-pro" },
	{
		id: "catppuccin",
		label: "Catppuccin",
		light: "catppuccin-latte",
		dark: "catppuccin-mocha",
	},
	{
		id: "rose-pine",
		label: "Rosé Pine",
		light: "rose-pine-dawn",
		dark: "rose-pine",
	},
	{
		id: "night-owl",
		label: "Night Owl",
		light: "night-owl-light",
		dark: "night-owl",
	},
	{
		id: "kanagawa",
		label: "Kanagawa",
		light: "kanagawa-lotus",
		dark: "kanagawa-wave",
	},
	{
		id: "everforest",
		label: "Everforest",
		light: "everforest-light",
		dark: "everforest-dark",
	},
	{
		id: "gruvbox",
		label: "Gruvbox",
		light: "gruvbox-light-medium",
		dark: "gruvbox-dark-medium",
	},
	{
		id: "solarized",
		label: "Solarized",
		light: "solarized-light",
		dark: "solarized-dark",
	},
	{
		id: "material",
		label: "Material",
		light: "material-theme-lighter",
		dark: "material-theme-darker",
	},
	{ id: "min", label: "Minimal", light: "min-light", dark: "min-dark" },
] as const;
type Theme = (typeof THEMES)[number];
const DEFAULT_THEME: Theme = THEMES[0];
/** The block's theme; anything unknown (an edited page) falls back to the default. */
const themeOf = (value: unknown): Theme =>
	THEMES.find(
		(t) => t.light === (value as { light?: unknown } | null)?.light,
	) ?? DEFAULT_THEME;

function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
	const language = (node.attrs.language as string | null) ?? null;
	const label =
		LANGUAGES.find(([id]) => id === language)?.[1] ?? language ?? "Plain text";
	const wrap = !!node.attrs.wrap;
	const theme = themeOf(node.attrs.themes);

	return (
		<NodeViewWrapper className={cn("code-wrap", wrap && "wrap")}>
			<div className="code-bar" contentEditable={false}>
				{editor.isEditable ? (
					<Menu>
						<MenuTrigger className="code-lang">
							{label}
							<span
								className="icon-[solar--alt-arrow-down-linear] size-3"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={180} align="end">
							<div className="code-langs">
								{LANGUAGES.map(([id, name]) => (
									<MenuItem
										key={name}
										checked={id === language}
										onSelect={() => updateAttributes({ language: id })}
									>
										{name}
									</MenuItem>
								))}
							</div>
						</MenuContent>
					</Menu>
				) : (
					<span className="code-lang">{label}</span>
				)}
				<span className="code-sep" />
				{editor.isEditable && (
					<Menu>
						<MenuTrigger
							className="ibtn ibtn-xs"
							aria-label={`Colour theme: ${theme.label}`}
							data-tip="Colour theme"
						>
							<span
								className="icon-[solar--palette-linear] size-4"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={180} align="end">
							<div className="code-langs">
								{THEMES.map((t) => (
									<MenuItem
										key={t.id}
										checked={t.id === theme.id}
										onSelect={() =>
											updateAttributes({
												themes:
													t.id === DEFAULT_THEME.id
														? null
														: { light: t.light, dark: t.dark },
											})
										}
									>
										{t.label}
									</MenuItem>
								))}
							</div>
						</MenuContent>
					</Menu>
				)}
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label="Copy code"
					data-tip="Copy"
					onClick={() => copy(node.textContent, "code")}
				>
					<span
						className="icon-[solar--copy-linear] size-4"
						aria-hidden="true"
					/>
				</button>
				{editor.isEditable && (
					<button
						type="button"
						className={cn("ibtn ibtn-xs", wrap && "on")}
						aria-label="Wrap long lines"
						aria-pressed={wrap}
						data-tip={wrap ? "Don't wrap" : "Wrap lines"}
						onClick={() => updateAttributes({ wrap: !wrap })}
					>
						<span
							className="icon-[hugeicons--text-wrap] size-4"
							aria-hidden="true"
						/>
					</button>
				)}
			</div>
			<pre>
				<NodeViewContent<"code"> as="code" />
			</pre>
		</NodeViewWrapper>
	);
}

export const CodeBlock = CodeBlockShiki.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			// read by the Shiki plugin; only pairs from THEMES are written
			themes: {
				default: null,
				parseHTML: (el: HTMLElement) => {
					const t = THEMES.find((x) => x.id === el.getAttribute("data-theme"));
					return t ? { light: t.light, dark: t.dark } : null;
				},
				renderHTML: (attrs: { themes?: unknown }) => {
					const t = themeOf(attrs.themes);
					return t.id === DEFAULT_THEME.id ? {} : { "data-theme": t.id };
				},
			},
			wrap: {
				default: false,
				parseHTML: (el: HTMLElement) => el.hasAttribute("data-wrap"),
				renderHTML: (attrs: { wrap?: boolean }) =>
					attrs.wrap ? { "data-wrap": "" } : {},
			},
		};
	},
	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockView);
	},
}).configure({
	defaultTheme: DEFAULT_THEME.dark,
	// the app switches themes with a "dark" class; notes.css swaps the token colours
	themes: { light: DEFAULT_THEME.light, dark: DEFAULT_THEME.dark },
});
