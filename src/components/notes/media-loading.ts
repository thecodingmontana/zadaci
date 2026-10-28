// Pictures, videos, embeds and audio in a page show a loading skeleton (notes.css) until the
// browser has them; this marks each one `data-loaded` once it has (or once it fails).

const MEDIA = "img, iframe, audio";

export function watchMediaLoading(root: HTMLElement) {
	const mark = (el: Element) => el.setAttribute("data-loaded", "");
	// pictures that were already cached are complete before any event could fire
	const markCached = () => {
		for (const img of root.querySelectorAll<HTMLImageElement>(
			"img:not([data-loaded])",
		))
			if (img.complete) mark(img);
	};
	const onDone = (e: Event) => {
		const target = e.target;
		if (target instanceof Element && target.matches(MEDIA)) mark(target);
	};
	// load, metadata and error don't bubble, so listen on the way down
	const events = ["load", "loadedmetadata", "error"];
	for (const name of events) root.addEventListener(name, onDone, true);
	const observer = new MutationObserver(markCached);
	observer.observe(root, { childList: true, subtree: true });
	markCached();
	return () => {
		for (const name of events) root.removeEventListener(name, onDone, true);
		observer.disconnect();
	};
}
