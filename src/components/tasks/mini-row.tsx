import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import type { TaskItem } from "#/graphql/operations";
import { cn } from "#/lib/utils";
import { Due, PrIcon } from "./bits";
import { useTaskView } from "./context";

/** One task line (reference miniRow): complete, status, title, project, priority, due, assignee. */
export function MiniRow({ t, av = true }: { t: TaskItem; av?: boolean }) {
	const { openTask, project, member, update, canEdit } = useTaskView();
	const p = project(t.projectId);
	const m = av ? member(t.assigneeId) : undefined;
	const done = t.status === "completed";
	return (
		// biome-ignore lint/a11y/useSemanticElements: the row holds a checkbox, so it can't be a <button>
		<div
			className={cn("mini", done && "done")}
			role="button"
			tabIndex={0}
			onClick={() => openTask(t.id)}
			onKeyDown={(e) => {
				if (e.key === "Enter") openTask(t.id);
			}}
		>
			<input
				type="checkbox"
				className="check round"
				checked={done}
				disabled={!canEdit(t.projectId)}
				aria-label={`Complete ${t.name}`}
				onClick={(e) => e.stopPropagation()}
				onChange={() => update(t, { status: done ? "todo" : "completed" })}
			/>
			<StatusIcon status={t.status} />
			<span className="tt">{t.name}</span>
			<span className="pj hide-m">
				<span
					className="pdot"
					style={{ "--c": projectColor(p?.color) } as React.CSSProperties}
				/>
				<span className="trunc">{p?.title}</span>
			</span>
			<PrIcon p={t.priority} />
			<span style={{ width: 74, textAlign: "right" }} className="hide-m">
				<Due day={t.dueDate} status={t.status} icon={false} />
			</span>
			{m && <Av name={m.name} image={m.image} className="sm" />}
		</div>
	);
}
