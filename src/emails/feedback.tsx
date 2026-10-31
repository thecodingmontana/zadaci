import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	pixelBasedPreset,
	Tailwind,
	Text,
} from "@react-email/components";

// A bug report, idea or other feedback someone sent from the app (Send feedback). It goes to the
// support inbox; replying answers them. Preview it with `pnpm email`.

export type FeedbackEmailProps = {
	/** "Bug report", "Idea" or "Feedback" */
	kind: string;
	message: string;
	name: string;
	email: string;
	/** the page they were on, and their workspace */
	page: string | null;
	workspace: string | null;
	browser: string | null;
};

export default function FeedbackEmail({
	kind,
	message,
	name,
	email,
	page,
	workspace,
	browser,
}: FeedbackEmailProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{`${kind} from ${name}`}</Preview>
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Body className="bg-[#fafafa] py-8 font-sans">
					<Container className="mx-auto max-w-[560px] rounded-lg border border-solid border-[#e7e5e4] bg-white px-8 py-8">
						<Text className="m-0 text-[20px] leading-[28px] font-semibold text-[#0a0a0a]">
							{kind} from {name}
						</Text>
						<Text className="mt-1 text-[13px] text-[#a8a29e]">
							{email} · reply to answer them
						</Text>
						<Text className="border-0 border-l-[3px] border-solid border-[#e7e5e4] pl-3 text-[15px] leading-6 whitespace-pre-wrap text-[#292524]">
							{message}
						</Text>
						<Hr className="my-6 border-[#e7e5e4]" />
						<Text className="m-0 text-[13px] leading-5 text-[#a8a29e]">
							{workspace ? `Workspace: ${workspace}` : "No workspace"}
							{page ? ` · Page: ${page}` : ""}
							{browser ? ` · ${browser}` : ""}
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

FeedbackEmail.PreviewProps = {
	kind: "Bug report",
	message: "The calendar skips a day when I drag a task across months.",
	name: "Olive Bishop",
	email: "olive@example.com",
	page: "/w/acme/calendar",
	workspace: "acme",
	browser: "Chrome on Windows",
} satisfies FeedbackEmailProps;
