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

// One notification by email: a mention, an assignment or a comment. Preview it with `pnpm email`.

export type NotificationEmailProps = {
	/** e.g. "Ann mentioned you in" plus what it's about */
	headline: string;
	/** the comment or task text it's about, quoted */
	snippet?: string | null;
	workspace: string;
	link: string;
	settingsLink: string;
	baseUrl: string;
};

export default function NotificationEmail({
	headline,
	snippet,
	workspace,
	link,
	settingsLink,
	baseUrl,
}: NotificationEmailProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{headline}</Preview>
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
						<Text className="mt-6 mb-0 text-[20px] leading-[28px] font-semibold text-[#0a0a0a]">
							{headline}
						</Text>
						<Text className="mt-1 text-[13px] text-[#a8a29e]">
							in {workspace}
						</Text>
						{snippet && (
							<Text className="border-0 border-l-[3px] border-solid border-[#e7e5e4] pl-3 text-[15px] leading-6 text-[#57534e]">
								{snippet}
							</Text>
						)}
						<Section className="my-6">
							<Button
								href={link}
								className="rounded-md bg-brand px-5 py-3 text-[15px] font-medium text-white"
							>
								Open in Zadaci
							</Button>
						</Section>
						<Hr className="my-6 border-[#e7e5e4]" />
						<Text className="m-0 text-[13px] leading-5 text-[#a8a29e]">
							You get this email because of your notification settings.{" "}
							<Link href={settingsLink} className="text-brand">
								Change what you receive
							</Link>
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

NotificationEmail.PreviewProps = {
	headline: "Olive Bishop mentioned you in “Launch checklist”",
	snippet: "@Sam can you check the pricing copy before Friday?",
	workspace: "Acme",
	link: "https://zadaci.vercel.app/w/acme/p/abc?task=xyz",
	settingsLink: "https://zadaci.vercel.app/w/acme/settings?sec=notif-email",
	baseUrl: "https://zadaci.vercel.app",
} satisfies NotificationEmailProps;
