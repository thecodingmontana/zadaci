import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionProps } from "@tiptap/suggestion";
import { forwardRef } from "react";
import type { NotePerson } from "#/graphql/note-operations";
import { cn } from "#/lib/utils";
import { type ListHandle, popup, useListNav } from "./slash-menu";

// "@" in a page: pick a teammate and they're told (graphql/notes.server notifyMentions).

type Props = SuggestionProps<NotePerson, { id: string; label: string }>;

const PeopleList = forwardRef<ListHandle, Props>(function PeopleList(
	{ items, command },
	ref,
) {
	const pick = (p: NotePerson) => command({ id: p.userId, label: p.name });
	const { index, setIndex, list } = useListNav(items, pick, ref);
	return (
		<div className="pop slash-menu" role="listbox" aria-label="People">
			<div className="slash-list" ref={list}>
				{items.length ? (
					items.map((p, i) => (
						<button
							key={p.id}
							type="button"
							role="option"
							aria-selected={i === index}
							data-i={i}
							className={cn("mi", i === index && "hl")}
							onMouseEnter={() => setIndex(i)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => pick(p)}
						>
							{p.image ? (
								<img className="mention-av" src={p.image} alt="" />
							) : (
								<span className="mention-av" aria-hidden="true">
									{p.name.slice(0, 1).toUpperCase()}
								</span>
							)}
							<span className="grow trunc">{p.name}</span>
							{p.isMe && <span className="faint">you</span>}
						</button>
					))
				) : (
					<div className="faint" style={{ padding: "8px 10px" }}>
						No one by that name
					</div>
				)}
			</div>
		</div>
	);
});

/** Mentions with a picker of the workspace's people; `people` is read each time "@" is typed. */
export const peopleMention = (people: () => NotePerson[]) =>
	Mention.configure({
		HTMLAttributes: { class: "mention" },
		suggestion: {
			char: "@",
			pluginKey: new PluginKey("peopleMention"),
			items: ({ query }) => {
				const q = query.trim().toLowerCase();
				return people()
					.filter((p) => !q || p.name.toLowerCase().includes(q))
					.slice(0, 8);
			},
			render: () => popup(PeopleList),
		},
	});

/** Shows mentions on a read-only page. */
export const ReadOnlyMention = Mention.configure({
	HTMLAttributes: { class: "mention" },
});
