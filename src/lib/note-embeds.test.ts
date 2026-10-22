import assert from "node:assert/strict";
import { test } from "node:test";
import {
	isEmbedSrc,
	isImageSrc,
	isShortMapLink,
	isYoutubeSrc,
	toEmbed,
} from "./note-embeds";

test("share links become provider embed addresses; anything else isn't embedded", () => {
	assert.deepEqual(toEmbed("https://vimeo.com/76979871"), {
		src: "https://player.vimeo.com/video/76979871",
		provider: "Vimeo",
	});
	assert.equal(
		toEmbed("https://www.loom.com/share/0a1b2c3d4e")?.src,
		"https://www.loom.com/embed/0a1b2c3d4e",
	);
	assert.equal(
		toEmbed("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")?.src,
		"https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
	);
	assert.equal(
		toEmbed("https://codepen.io/team/pen/abcDEF")?.src,
		"https://codepen.io/team/embed/abcDEF?default-tab=result",
	);
	assert.match(
		toEmbed("https://www.figma.com/design/KEY/Name")?.src ?? "",
		/^https:\/\/www\.figma\.com\/embed\?/,
	);
	assert.equal(toEmbed("https://evil.example.com/vimeo.com/1"), null);
	assert.equal(toEmbed("http://vimeo.com/1"), null);
});

test("only allowed embed, YouTube and image addresses are stored", () => {
	assert.equal(isEmbedSrc("https://player.vimeo.com/video/1"), true);
	assert.equal(isEmbedSrc("https://example.com/embed"), false);
	assert.equal(
		isYoutubeSrc("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
		true,
	);
	assert.equal(
		isYoutubeSrc("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
		true,
	);
	assert.equal(isYoutubeSrc("https://youtu.be/dQw4w9WgXcQ"), true);
	assert.equal(isYoutubeSrc("https://www.youtube.com/@channel"), false);
	assert.equal(isYoutubeSrc("https://notyoutube.com/watch?v=x"), false);
	assert.equal(
		isImageSrc("https://res.cloudinary.com/x/image/upload/a.png"),
		true,
	);
	assert.equal(isImageSrc('https://x.com/a.png" onerror="alert(1)'), false);
	assert.equal(isImageSrc("javascript:alert(1)"), false);
});

test("Google Maps views, places and searches embed without an API key", () => {
	const src = (link: string) => toEmbed(link)?.src;
	assert.equal(
		src("https://www.google.com/maps/@-1.2889853,36.7280684,15z?entry=ttu"),
		"https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s-1.2889853%2C36.7280684!6i15",
	);
	assert.equal(
		src(
			"https://www.google.com/maps/place/Mombasa/@-4.0435,39.6682,12z/data=!4m2",
		),
		"https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sMombasa!6i12",
	);
	assert.equal(
		src("https://maps.google.com/?q=Nairobi"),
		"https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sNairobi!6i14",
	);
	assert.equal(
		src("https://www.google.com/search?q=maps"),
		undefined,
		"only maps pages",
	);
	assert.ok(
		isEmbedSrc(
			"https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sMombasa!6i12",
		),
	);
	assert.ok(
		!isEmbedSrc("https://www.google.com/maps?q=Mombasa"),
		"a normal maps page can't be framed",
	);
	assert.ok(isShortMapLink("https://maps.app.goo.gl/KdDu6LmSXCpxKRx67"));
	assert.ok(!isShortMapLink("https://bit.ly/abc"));
});
