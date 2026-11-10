import { useState } from "react";
import { Av } from "#/components/q/av";
import type { ToastData } from "#/lib/toast";
import { Live, Toast } from "./bento-tiles";

// Bento tiles about people and sharing: a role change through the real role menu, and a share
// link copied with the app's own toast.

const ROLES = [
	["moderator", "Admin", "Manage members, settings, and all projects"],
	["member", "Member", "Create projects and work on tasks"],
	["guest", "Guest", "Only sees projects they are invited to"],
] as const;

export function RoleTile() {
	const [role, setRole] = useState("member");
	const [open, setOpen] = useState(false);
	const [toast, setToast] = useState<ToastData | null>(null);
	const label = ROLES.find((r) => r[0] === role)?.[1];
	return (
		<Live
			h={232}
			reset={() => {
				setRole("member");
				setOpen(false);
				setToast(null);
			}}
			end={() => setRole("moderator")}
			script={async (w) => {
				await w(1000);
				setOpen(true);
				await w(1100);
				setOpen(false);
				setRole("moderator");
				setToast({
					id: Date.now(),
					type: "success",
					title: "Leo Park is now an admin",
					duration: 2600,
				});
				await w(3200);
			}}
		>
			<div className="row" style={{ gap: 10, padding: "16px 16px 0" }}>
				<Av name="Leo Park" className="md" />
				<span className="col grow" style={{ minWidth: 0 }}>
					<b style={{ fontWeight: 500 }}>Leo Park</b>
					<span className="faint" style={{ fontSize: 12 }}>
						leo@northwind.dev
					</span>
				</span>
				<span className="pillbtn bordered">
					{label}
					<span className="icon-[solar--alt-arrow-down-linear] size-3" />
				</span>
			</div>
			{open && (
				<div
					className="pop enter"
					style={{
						position: "absolute",
						top: 54,
						right: 12,
						left: 12,
						maxWidth: "none",
					}}
				>
					<div className="mh">Role for Leo Park</div>
					{ROLES.map(([r, name, help]) => (
						<div key={r} className="mi">
							<div className="grow" style={{ whiteSpace: "normal" }}>
								<div style={{ fontWeight: 500 }}>{name}</div>
								<div className="faint" style={{ fontSize: 11.5 }}>
									{help}
								</div>
							</div>
							{role === r && (
								<span className="ck">
									<span className="icon-[hugeicons--tick-02] size-3.5" />
								</span>
							)}
						</div>
					))}
				</div>
			)}
			<Toast t={toast} />
		</Live>
	);
}

export function ShareTile() {
	const [toast, setToast] = useState<ToastData | null>(null);
	return (
		<Live
			h={150}
			reset={() => setToast(null)}
			end={() => {}}
			script={async (w) => {
				await w(1400);
				setToast({
					id: 1,
					type: "pending",
					title: "Copying link…",
					duration: 0,
				});
				await w(500);
				setToast({
					id: 1,
					type: "success",
					title: "Link copied",
					duration: 2400,
				});
				await w(3600);
			}}
		>
			<div className="row" style={{ gap: 8, padding: "16px 16px 0" }}>
				<span
					className="input grow trunc"
					style={{ display: "flex", alignItems: "center", fontSize: 12.5 }}
				>
					zadaci.vercel.app/s/Hk3…
				</span>
				<span className="btn btn-secondary">
					<span className="icon-[solar--copy-linear] size-3.5" />
					Copy
				</span>
			</div>
			<Toast t={toast} />
		</Live>
	);
}
