import { createFileRoute, redirect } from "@tanstack/react-router";
import { Chapters } from "#/components/home/chapters";
import {
	Changelog,
	ClosingCta,
	LandingFooter,
} from "#/components/home/closing";
import { Hero } from "#/components/home/hero";
import { LandingNav } from "#/components/home/landing-nav";
import { Principles } from "#/components/home/principles";
import { SITE_DESCRIPTION, SITE_URL } from "#/lib/seo";
import { getSession } from "#/lib/session";

const TITLE = "Zadaci - Collaborative Task Management Platform";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: "/workspace" });
	},
	head: () => ({
		meta: [
			{ title: TITLE },
			{ name: "description", content: SITE_DESCRIPTION },
			{ property: "og:title", content: TITLE },
			{ property: "og:url", content: `${SITE_URL}/` },
			{ name: "twitter:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/` }],
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
	return (
		<div className="min-h-dvh overflow-x-clip bg-(--q-bg) text-(color:--q-text) antialiased">
			<LandingNav />
			<main>
				<Hero />
				<Principles />
				<Chapters />
				<Changelog />
				<ClosingCta />
			</main>
			<LandingFooter />
		</div>
	);
}
