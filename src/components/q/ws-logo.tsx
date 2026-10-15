/** Reference workspace logo: first letter on the workspace colour, or the uploaded image. */
export function WsLogo({
	workspace,
	px = 22,
}: {
	workspace: { name: string; color?: string | null; imageUrl?: string | null };
	px?: number;
}) {
	const style = {
		width: px,
		height: px,
		"--c": workspace.color ?? "#ea5a32",
	} as React.CSSProperties;
	if (workspace.imageUrl) {
		return (
			<img
				src={workspace.imageUrl}
				alt=""
				className="ws-logo object-cover"
				style={style}
			/>
		);
	}
	return (
		<span
			className="ws-logo"
			style={{ ...style, fontSize: Math.max(9, Math.round(px * 0.46)) }}
			aria-hidden="true"
		>
			{workspace.name[0]?.toUpperCase()}
		</span>
	);
}
