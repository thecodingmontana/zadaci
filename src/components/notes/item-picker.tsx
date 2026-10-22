import { useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { StatusIcon } from "#/components/q/status-icon";
import { NOTE_EMBED } from "#/graphql/note-operations";
import { SEARCH } from "#/graphql/operations";

// Finds a task or bookmark to put in a page, using the workspace search (which already hides
// what the viewer can't see).

export function ItemPicker({
	slug,
	kind,
	placeholder,
	hint,
	onPick,
}: {
	slug: string;
	kind: "task" | "bookmark";
	placeholder: string;
	hint: string;
	onPick: (id: string) => void;
}) {
	const [q, setQ] = useState("");
	const [debounced, setDebounced] = useState("");
	useEffect(() => {
		const id = setTimeout(() => setDebounced(q.trim()), 150);
		return () => clearTimeout(id);
	}, [q]);
	// a pasted task link (…/p/<project>?task=<id>) picks that task directly
	const linked =
		kind === "task"
			? /[?&]task=([A-Za-z0-9]{1,16})/.exec(debounced)?.[1]
			: undefined;
	const { data, loading } = useQuery(SEARCH, {
		variables: { slug, q: debounced },
		skip: !debounced || !!linked,
	});
	const byLink = useQuery(NOTE_EMBED, {
		variables: { slug, kind: "task", id: linked ?? "" },
		skip: !linked,
	});
	const found = byLink.data?.noteEmbed;
	const items = linked
		? found
			? [
					{
						id: found.id,
						name: found.title,
						sub: found.sub ?? "",
						icon: <StatusIcon status={found.status ?? "todo"} size={15} />,
					},
				]
			: []
		: kind === "task"
			? (data?.search.tasks ?? []).map((t) => ({
					id: t.id,
					name: t.name,
					sub: t.projectTitle,
					icon: <StatusIcon status={t.status} size={15} />,
				}))
			: (data?.search.bookmarks ?? []).map((b) => ({
					id: b.id,
					name: b.title,
					sub: b.site ?? b.url,
					icon: (
						<span
							className="icon-[solar--bookmark-linear] size-[15px]"
							aria-hidden="true"
						/>
					),
				}));
	return (
		<div className="insert-link">
			<input
				className="input"
				placeholder={placeholder}
				value={q}
				// biome-ignore lint/a11y/noAutofocus: the search is the only thing to fill in
				autoFocus
				onChange={(e) => setQ(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && items[0]) {
						e.preventDefault();
						onPick(items[0].id);
					}
				}}
			/>
			<div className="item-picker" role="listbox" aria-label="Results">
				{items.map((it) => (
					<button
						key={it.id}
						type="button"
						role="option"
						aria-selected={false}
						className="mi"
						onClick={() => onPick(it.id)}
					>
						{it.icon}
						<span className="trunc">{it.name}</span>
						<span className="r trunc">{it.sub}</span>
					</button>
				))}
				{debounced && !loading && !byLink.loading && !items.length && (
					<p className="faint">Nothing found.</p>
				)}
			</div>
			<p className="faint">{hint}</p>
		</div>
	);
}
