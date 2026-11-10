// Starts the landing page's reveals: elements marked .lp-reveal or .lp-line get data-in as they
// enter the screen, and CSS (src/styles.css, "Landing reveals") plays a one-off transition.
// It runs as an inline script before the page hydrates (so nothing waits on the app's JS), and
// again after client-side navigation; it only hides things once it is running, and never with
// reduced motion.
export function startReveal() {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const w = window as Window & { __lpIO?: IntersectionObserver };
	w.__lpIO ??= new IntersectionObserver(
		(entries) => {
			for (const e of entries)
				if (e.isIntersecting) {
					e.target.setAttribute("data-in", "");
					w.__lpIO?.unobserve(e.target);
				}
		},
		{ rootMargin: "0px 0px -6% 0px" },
	);
	const io = w.__lpIO;
	const scan = () => {
		for (const el of document.querySelectorAll(
			".lp-reveal:not([data-in]),.lp-line:not([data-in])",
		))
			io.observe(el);
	};
	document.documentElement.setAttribute("data-reveal", "");
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", scan);
	else scan();
}

export const REVEAL_SCRIPT = `(${startReveal.toString()})()`;
