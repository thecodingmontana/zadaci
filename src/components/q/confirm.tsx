import { Dialog } from "radix-ui";
import { type ReactNode, useState } from "react";
import { cn } from "#/lib/utils";

/** Reference confirm dialog: danger icon, title, body, optional "type the name to confirm". */
export function ConfirmModal({
	open,
	onOpenChange,
	title,
	body,
	ok,
	danger,
	icon,
	typeName,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	body: ReactNode;
	ok: string;
	danger?: boolean;
	icon?: string;
	typeName?: string;
	onConfirm: () => Promise<unknown> | unknown;
}) {
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const ready = !typeName || text === typeName;

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(o) => {
				if (busy) return;
				if (!o) setText("");
				onOpenChange(o);
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="scrim enter" />
				<div className="modal-wrap">
					<Dialog.Content
						className="modal enter sm"
						aria-describedby="confirm-body"
					>
						<div className="modal-b" style={{ paddingTop: 18, gap: 10 }}>
							<div
								className="row"
								style={{ gap: 12, alignItems: "flex-start" }}
							>
								<span
									className="ftype"
									style={
										{
											"--c": danger ? "var(--q-red)" : "var(--q-amber)",
											width: 34,
											height: 34,
											borderRadius: 9,
										} as React.CSSProperties
									}
								>
									<span
										className={cn(
											icon ??
												(danger
													? "icon-[solar--trash-bin-minimalistic-linear]"
													: "icon-[solar--archive-linear]"),
											"size-[17px]",
										)}
										aria-hidden="true"
									/>
								</span>
								<div className="grow">
									<Dialog.Title
										style={{
											fontSize: 15,
											fontWeight: 600,
											margin: "4px 0 6px",
										}}
									>
										{title}
									</Dialog.Title>
									<p
										id="confirm-body"
										className="muted"
										style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}
									>
										{body}
									</p>
								</div>
							</div>
							{typeName && (
								<div className="field" style={{ marginTop: 6 }}>
									<label
										className="label"
										htmlFor="confirm-in"
										style={{ fontWeight: 400, color: "var(--q-text-2)" }}
									>
										Type{" "}
										<b style={{ color: "var(--q-text)", fontWeight: 600 }}>
											{typeName}
										</b>{" "}
										to confirm
									</label>
									<input
										className="input"
										id="confirm-in"
										autoComplete="off"
										value={text}
										onChange={(e) => setText(e.target.value)}
									/>
								</div>
							)}
						</div>
						<div className="modal-f">
							<span className="sp" />
							<Dialog.Close className="btn btn-secondary" disabled={busy}>
								Cancel
							</Dialog.Close>
							<button
								type="button"
								className={cn(
									"btn",
									danger ? "btn-danger" : "btn-primary",
									busy && "is-loading",
								)}
								disabled={!ready || busy}
								aria-busy={busy}
								onClick={async () => {
									setBusy(true);
									try {
										await onConfirm();
										setText("");
										onOpenChange(false);
									} catch {
										// the caller already showed the error; keep the dialog open to retry
									} finally {
										setBusy(false);
									}
								}}
							>
								{ok}
							</button>
						</div>
					</Dialog.Content>
				</div>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
