import {
	Body,
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

// The weekday morning summary: unread notifications and tasks due tomorrow. Preview it with `pnpm email`.

export type DailyDigestProps = {
	items: { text: string; workspace: string; link: string }[];
	settingsLink: string;
	baseUrl: string;
};

export default function DailyDigest({
	items,
	settingsLink,
	baseUrl,
}: DailyDigestProps) {
	const summary = `${items.length} ${items.length === 1 ? "update" : "updates"} waiting for you`;
	return (
		<Html lang="en">
			<Head />
			<Preview>{summary}</Preview>
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
							Your daily summary
						</Text>
						<Text className="mt-1 text-[13px] text-[#a8a29e]">{summary}</Text>
						<Section className="my-4">
							{items.map((item) => (
								<Text
									key={item.link + item.text}
									className="my-0 border-0 border-b border-solid border-[#f5f5f4] py-3 text-[15px] leading-6"
								>
									<Link href={item.link} className="text-[#0a0a0a]">
										{item.text}
									</Link>
									<span className="text-[13px] text-[#a8a29e]">
										{" "}
										· {item.workspace}
									</span>
								</Text>
							))}
						</Section>
						<Hr className="my-6 border-[#e7e5e4]" />
						<Text className="m-0 text-[13px] leading-5 text-[#a8a29e]">
							You get this email every weekday at 8:00 because the daily digest
							is on.{" "}
							<Link href={settingsLink} className="text-brand">
								Turn it off
							</Link>
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

DailyDigest.PreviewProps = {
	items: [
		{
			text: "Olive Bishop mentioned you in “Launch checklist”",
			workspace: "Acme",
			link: "https://zadaci.vercel.app/w/acme/p/abc?task=xyz",
		},
		{
			text: "“Pricing page copy” is due tomorrow",
			workspace: "Acme",
			link: "https://zadaci.vercel.app/w/acme/p/abc?task=uvw",
		},
	],
	settingsLink: "https://zadaci.vercel.app/w/acme/settings?sec=notif-email",
	baseUrl: "https://zadaci.vercel.app",
} satisfies DailyDigestProps;
