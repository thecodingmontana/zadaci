import { Av } from "#/components/q/av";

/** Up to four faces, then "+N" (reference avStack). */
export function TeamAvatars({
	members,
}: {
	members: { id: string; name: string; image: string | null }[];
}) {
	return (
		<span className="avs">
			{members.slice(0, 4).map((m) => (
				<Av key={m.id} name={m.name} image={m.image} className="sm" />
			))}
			{members.length > 4 && (
				<span className="av sm more">+{members.length - 4}</span>
			)}
		</span>
	);
}
