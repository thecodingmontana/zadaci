import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

/** Reference modal look (.scrim/.modal) on Radix Dialog for focus trapping, Esc and labelling. */
export function Modal({
	open,
	onOpenChange,
	title,
	sub,
	size,
	children,
	footer,
	busy,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	sub?: ReactNode;
	size?: "sm" | "lg";
	children: ReactNode;
	footer?: ReactNode;
	/** an action is running: Esc, the scrim and × don't close it until it finishes */
	busy?: boolean;
}) {
	return (
		<Dialog.Root
			open={open}
			onOpenChange={(o) => {
				if (busy && !o) return;
				onOpenChange(o);
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="scrim enter" />
				<div className="modal-wrap">
					<Dialog.Content
						className={cn("modal enter", size)}
						{...(sub ? {} : { "aria-describedby": undefined })}
					>
						<div className="modal-h">
							<div>
								<Dialog.Title asChild>
									<h2>{title}</h2>
								</Dialog.Title>
								{sub && (
									<Dialog.Description asChild>
										<div
											className="muted"
											style={{ fontSize: 12.5, marginTop: 2 }}
										>
											{sub}
										</div>
									</Dialog.Description>
								)}
							</div>
							<Dialog.Close
								className="ibtn ibtn-sm"
								aria-label="Close"
								disabled={busy}
							>
								<span
									className="icon-[solar--close-linear] size-4"
									aria-hidden="true"
								/>
							</Dialog.Close>
						</div>
						{children}
						{footer && <div className="modal-f">{footer}</div>}
					</Dialog.Content>
				</div>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
