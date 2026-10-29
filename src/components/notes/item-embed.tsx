import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import {
	mergeAttributes,
	Node,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { projectColor } from "#/components/projects/bits";
import { StatusIcon } from "#/components/q/status-icon";
import { NOTE_EMBED } from "#/graphql/note-operations";

// A task or bookmark shown as a live card inside a page (the "/" menu's Task and Bookmark).
// The page only stores { kind, id }; each reader sees the item as they're allowed to.

const safeLink = (href: string) => /^https?:\/\//i.test(href);
const hostOf = (href: string) => {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
};

function ItemEmbedView({ node, extension }: NodeViewProps) {
	const { kind, id } = node.attrs as { kind: string; id: string };
	const slug = (extension.options as { slug: string }).slug;
	return (
		<NodeViewWrapper className="item-embed-wrap" data-drag-handle>
			<ItemCard slug={slug} kind={kind} id={id} />
		</NodeViewWrapper>
	);
}

/** A live card for a task, project, note or bookmark, as this reader may see it (also in chat). */
export function ItemCard({
	slug,
	kind,
	id,
}: {
	slug: string;
	kind: string;
	id: string;
}) {
	// shortcut: one small query per card, fine for a handful per page; batch them if pages fill up
	const { data, loading } = useQuery(NOTE_EMBED, {
		variables: { slug, kind, id },
	});
	const item = data?.noteEmbed;
	const icon =
		kind === "task" ? (
			<StatusIcon status={item?.status ?? "todo"} size={15} />
		) : kind === "project" ? (
			<span
				className="pdot"
				style={{ "--c": projectColor(item?.status) } as React.CSSProperties}
			/>
		) : kind === "note" ? (
			item?.status ? (
				<span aria-hidden="true">{item.status}</span>
			) : (
				<span
					className="icon-[solar--document-text-linear] size-[15px]"
					aria-hidden="true"
				/>
			)
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
	return !item ? (
		<span className="item-embed is-empty" contentEditable={false}>
			{body}
		</span>
	) : kind !== "bookmark" ? (
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

/** A link pasted into a page as a card: the page's title, site and image (read once, when added). */
function LinkCardView({ node }: NodeViewProps) {
	const { url, title, site, image } = node.attrs as {
		url: string;
		title: string | null;
		site: string | null;
		image: string | null;
	};
	return (
		<NodeViewWrapper className="item-embed-wrap" data-drag-handle>
			<a
				className="link-card"
				href={safeLink(url) ? url : undefined}
				target="_blank"
				rel="noopener noreferrer"
				contentEditable={false}
			>
				<span className="link-card-text">
					<span className="item-embed-title">{title || url}</span>
					<span className="item-embed-sub">{site || hostOf(url)}</span>
				</span>
				{image && <img src={image} alt="" loading="lazy" />}
			</a>
		</NodeViewWrapper>
	);
}

export const LinkCard = Node.create({
	name: "linkCard",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes() {
		return {
			url: { default: "" },
			title: { default: null },
			site: { default: null },
			image: { default: null },
		};
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-type="link-card"]',
				getAttrs: (el) => ({ url: el.getAttribute("data-url") }),
			},
		];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-type": "link-card",
				"data-url": node.attrs.url,
			}),
		];
	},
	addNodeView() {
		return ReactNodeViewRenderer(LinkCardView);
	},
});
