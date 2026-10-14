import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BlueprintFrame } from "#/components/home/blueprint-frame";
import { MultiplayerText } from "#/components/home/multiplayer-text";
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
				<Link
					to="/auth/signin"
					className="group inline-flex items-center gap-x-2 rounded-full bg-brand px-4 py-2.5 text-base font-medium text-white shadow-[0_-1px_0_1px_rgba(249,129,99,1)_inset,0_0_0_1px_#F97452_inset,0_0.5px_0_1.5px_#F97452_inset] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none hover:scale-105 hover:shadow-[0_-1px_0_1px_rgba(252,199,185,0.8)_inset,0_0_0_1px_#F97452_inset,0_0.5px_0_1.5px_hsla(0,0%,100%,0.25)_inset] focus-visible:ring-4 focus-visible:ring-brand/40 active:scale-95 motion-reduce:transform-none"
				>
					Get Started
					<span className="size-6 overflow-hidden rounded-full border border-white/10 bg-white/5 transition-colors duration-300 group-hover:bg-white/10">
						<span className="flex w-12 -translate-x-1/2 transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:translate-x-0 motion-reduce:transition-none">
							<span className="flex size-6">
								<span
									className="m-auto icon-[solar--arrow-right-linear] size-3.5"
									aria-hidden="true"
								/>
							</span>
							<span className="flex size-6">
								<span
									className="m-auto icon-[solar--arrow-right-linear] size-3.5"
									aria-hidden="true"
								/>
							</span>
						</span>
					</span>
				</Link>
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
