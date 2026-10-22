import { useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { StatusIcon } from "#/components/q/status-icon";
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
	const { data, loading } = useQuery(SEARCH, {
		variables: { slug, q: debounced },
		skip: !debounced,
	});
	const items =
		kind === "task"
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
				{debounced && !loading && !items.length && (
					<p className="faint">Nothing found.</p>
				)}
			</div>
			<p className="faint">{hint}</p>
		</div>
	);
}
