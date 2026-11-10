import { createFileRoute, redirect, ScriptOnce } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bento } from "#/components/home/bento";
import { Chapters } from "#/components/home/chapters";
import {
	Changelog,
	ClosingCta,
	LandingFooter,
} from "#/components/home/closing";
import { Hero } from "#/components/home/hero";
import { LandingNav } from "#/components/home/landing-nav";
import { Principles } from "#/components/home/principles";
import { REVEAL_SCRIPT, startReveal } from "#/components/home/reveal-script";
import { pageHead, SITE_DESCRIPTION, SITE_URL } from "#/lib/seo";
import { getSession } from "#/lib/session";

const TITLE = "Zadaci - Collaborative Task Management Platform";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: "/workspace" });
	},
	head: () => ({
		...pageHead(TITLE, SITE_DESCRIPTION, "/"),
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify({
					"@context": "https://schema.org",
					"@graph": [
						{
							"@type": "WebSite",
							name: "Zadaci",
							url: `${SITE_URL}/`,
							description: SITE_DESCRIPTION,
						},
						{
							"@type": "SoftwareApplication",
							name: "Zadaci",
							url: `${SITE_URL}/`,
							description: SITE_DESCRIPTION,
							applicationCategory: "BusinessApplication",
							operatingSystem: "Web",
							image: `${SITE_URL}/og.png`,
							offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
							publisher: { "@type": "Organization", name: "Crow Studio" },
						},
					],
				}),
			},
		],
	}),
	component: Home,
});

function Home() {
	// after a client-side visit the inline script has already run once: watch the new page too
	useEffect(() => startReveal(), []);
	return (
		<div className="min-h-dvh overflow-x-clip bg-(--q-bg) text-(color:--q-text) antialiased">
			<ScriptOnce>{REVEAL_SCRIPT}</ScriptOnce>
			<LandingNav />
			<main>
				<Hero />
				<Principles />
				<Chapters />
				<Bento />
				<Changelog />
				<ClosingCta />
			</main>
			<LandingFooter />
		</div>
	);
}
