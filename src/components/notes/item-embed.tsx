import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import {
	mergeAttributes,
	Node,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { StatusIcon } from "#/components/q/status-icon";
import { NOTE_EMBED } from "#/graphql/note-operations";

// A task or bookmark shown as a live card inside a page (the "/" menu's Task and Bookmark).
// The page only stores { kind, id }; each reader sees the item as they're allowed to.

const safeLink = (href: string) => /^https?:\/\//i.test(href);

function ItemEmbedView({ node, extension }: NodeViewProps) {
	const { kind, id } = node.attrs as { kind: string; id: string };
	const slug = (extension.options as { slug: string }).slug;
	// shortcut: one small query per card, fine for a handful per page; batch them if pages fill up
	const { data, loading } = useQuery(NOTE_EMBED, {
		variables: { slug, kind, id },
	});
	const item = data?.noteEmbed;
	const icon =
		kind === "task" ? (
			<StatusIcon status={item?.status ?? "todo"} size={15} />
		) : (
			<span
				className="icon-[solar--bookmark-linear] size-[15px]"
				aria-hidden="true"
			/>
		);
	const body = (
		<>
			{icon}
			<span className="item-embed-title">
				{item?.title ?? (loading ? "Loading…" : "No access")}
			</span>
			{item?.sub && <span className="item-embed-sub">{item.sub}</span>}
		</>
	);
	return (
		<NodeViewWrapper className="item-embed-wrap" data-drag-handle>
			{!item ? (
				<span className="item-embed is-empty" contentEditable={false}>
					{body}
				</span>
			) : kind === "task" ? (
				<Link className="item-embed" to={item.href} contentEditable={false}>
					{body}
				</Link>
			) : (
				<a
					className="item-embed"
					href={safeLink(item.href) ? item.href : undefined}
					target="_blank"
					rel="noopener noreferrer"
					contentEditable={false}
				>
					{body}
					<span
						className="icon-[solar--arrow-right-up-linear] size-3"
						aria-hidden="true"
					/>
				</a>
			)}
		</NodeViewWrapper>
	);
}

export const ItemEmbed = Node.create<{ slug: string }>({
	name: "itemEmbed",
	group: "block",
	atom: true,
	draggable: true,
	addOptions() {
		return { slug: "" };
	},
	addAttributes() {
		return { kind: { default: "task" }, id: { default: "" } };
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-type="item-embed"]',
				getAttrs: (el) => ({
					kind: el.getAttribute("data-kind"),
					id: el.getAttribute("data-id"),
				}),
			},
		];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-type": "item-embed",
				"data-kind": node.attrs.kind,
				"data-id": node.attrs.id,
			}),
		];
	},
	addNodeView() {
		return ReactNodeViewRenderer(ItemEmbedView);
	},
});
