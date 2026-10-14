import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BlueprintFrame } from "#/components/home/blueprint-frame";
import { MultiplayerText } from "#/components/home/multiplayer-text";
import { ArrowChip, Button } from "#/components/ui/button";
import { getSession } from "#/lib/session";

const PLAYERS = [
	{ name: "Olive Bishop", color: "#3ecf8e" },
	{ name: "Blackie", color: "#f0883e" },
	{ name: "Ebra Kitavey", color: "#ffb703" },
];

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: "/workspace" });
	},
	head: () => ({
		meta: [
			{ title: "Zadaci - Collaborative Task Management Platform" },
			{
				name: "description",
				content:
					"Stay organized and collaborate seamlessly with Zadaci. The all-in-one project management platform built to get things done faster.",
			},
		],
	}),
	component: Home,
});

function Home() {
	return (
		<main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-6 py-20 text-center dark:bg-[#08080a]">
			<BlueprintFrame className="dark:hidden" color="#0a0a0a" inset={40} />
			<BlueprintFrame className="hidden dark:block" inset={40} />

			<div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-4">
				<h1 className="sr-only">Zadaci</h1>
				<MultiplayerText
					text="Turning teams productivity into a powerful daily habit"
					className="text-3xl leading-[1.45] font-semibold tracking-tight text-black sm:text-[3.5rem] dark:text-white"
					players={PLAYERS}
					interval={1500}
				/>
				<p className="max-w-xl text-sm leading-relaxed text-balance text-black/60 sm:text-lg dark:text-white/50">
					Stay organized and collaborate seamlessly with Zadaci. The all-in-one
					project management platform built to get things done faster.
				</p>
				<Button
					asChild
					size="lg"
					className="rounded-full motion-safe:hover:scale-105"
				>
					<Link to="/auth/signin">
						Get Started
						<ArrowChip />
					</Link>
				</Button>
			</div>

			<footer className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-x-1 text-sm text-black/60 dark:text-white/50">
				<p>&copy; {new Date().getFullYear()} &middot; Made with 💚,</p>
				<a
					href="https://x.com/codewithmontana"
					target="_blank"
					rel="noreferrer"
					className="group flex items-center gap-x-1 rounded-sm"
				>
					<img
						src="https://avatars.githubusercontent.com/u/63234437?v=4"
						alt=""
						width={24}
						height={24}
						className="size-6 rounded-full"
					/>
					<span className="decoration-brand decoration-wavy group-hover:underline">
						@codewithmontana
					</span>
				</a>
			</footer>
		</main>
	);
}
