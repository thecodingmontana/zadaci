import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	pixelBasedPreset,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

// Ported from the old app's workspace-invite email. Preview it with `pnpm email`.

export type WorkspaceInviteProps = {
	sender: string;
	workspace: string;
	role: string;
	link: string;
	baseUrl: string;
};

export default function WorkspaceInvite({
	sender,
	workspace,
	role,
	link,
	baseUrl,
}: WorkspaceInviteProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{`${sender} invited you to ${workspace} on Zadaci`}</Preview>
			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: { extend: { colors: { brand: "#F97452" } } },
				}}
			>
				<Body className="bg-[#fafafa] py-8 font-sans">
					<Container className="mx-auto max-w-[560px] rounded-lg border border-solid border-[#e7e5e4] bg-white px-8 py-8">
						<Link href={baseUrl}>
							<Img
								src={`${baseUrl}/android-chrome-192x192.png`}
								alt="Zadaci"
								width="40"
								height="40"
								className="rounded-lg"
							/>
						</Link>
						<Text className="mt-6 mb-0 text-[22px] leading-[30px] font-semibold text-[#0a0a0a]">
							Join {workspace} on Zadaci
						</Text>
						<Text className="text-[15px] leading-6 text-[#57534e]">
							<b className="text-[#0a0a0a]">{sender}</b> invited you to
							collaborate in the <b className="text-[#0a0a0a]">{workspace}</b>{" "}
							workspace as {role === "moderator" ? "an admin" : "a member"}.
						</Text>
						<Section className="my-6">
							<Button
								href={link}
								className="rounded-md bg-brand px-5 py-3 text-[15px] font-medium text-white"
							>
								Accept invitation
							</Button>
						</Section>
						<Text className="text-[15px] leading-6 text-[#57534e]">
							If you weren't expecting this invite, you can safely ignore this
							email.
						</Text>
						<Hr className="my-6 border-[#e7e5e4]" />
						<Text className="m-0 text-[13px] leading-5 text-[#a8a29e]">
							Button not working? Paste this link into your browser:
						</Text>
						<Link href={link} className="text-[13px] break-all text-brand">
							{link}
						</Link>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

WorkspaceInvite.PreviewProps = {
	sender: "Olive Bishop",
	workspace: "Acme",
	role: "member",
	link: "https://zadaci.vercel.app/join/ABC123",
	baseUrl: "https://zadaci.vercel.app",
} satisfies WorkspaceInviteProps;
