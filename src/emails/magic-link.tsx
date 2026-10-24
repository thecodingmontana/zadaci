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

// The sign-in link sent by "Email me a sign-in link". Preview it with `pnpm email`.

export type MagicLinkProps = { link: string; baseUrl: string; minutes: number };

export default function MagicLink({ link, baseUrl, minutes }: MagicLinkProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>Your Zadaci sign-in link</Preview>
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
							Sign in to Zadaci
						</Text>
						<Text className="text-[15px] leading-6 text-[#57534e]">
							Click the button to sign in. The link works once and expires in{" "}
							{minutes} minutes.
						</Text>
						<Section className="my-6">
							<Button
								href={link}
								className="rounded-md bg-brand px-5 py-3 text-[15px] font-medium text-white"
							>
								Sign in to Zadaci
							</Button>
						</Section>
						<Text className="text-[15px] leading-6 text-[#57534e]">
							If you didn't ask to sign in, you can safely ignore this email;
							nobody can sign in without this link.
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

MagicLink.PreviewProps = {
	link: "https://zadaci.vercel.app/api/auth/magic-link/verify?token=example",
	baseUrl: "https://zadaci.vercel.app",
	minutes: 10,
} satisfies MagicLinkProps;
