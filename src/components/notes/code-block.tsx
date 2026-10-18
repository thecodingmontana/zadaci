import {
	NodeViewContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import CodeBlockShiki from "tiptap-extension-code-block-shiki";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Code blocks highlighted by Shiki (each language loads the first time it's used), with a
// header like Notion's: pick the language, copy the code, wrap long lines.

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

function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
	const language = (node.attrs.language as string | null) ?? null;
	const label =
		LANGUAGES.find(([id]) => id === language)?.[1] ?? language ?? "Plain text";
	const wrap = !!node.attrs.wrap;

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
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label="Copy code"
					data-tip="Copy"
					onClick={() =>
						navigator.clipboard
							.writeText(node.textContent)
							.then(() => toast.success("Code copied"))
							.catch(() => toast.error("Couldn't copy the code"))
					}
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
	defaultTheme: "github-dark",
	// the app switches themes with a "dark" class; notes.css swaps the token colours
	themes: { light: "github-light", dark: "github-dark" },
});
