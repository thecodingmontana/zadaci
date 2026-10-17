import assert from "node:assert/strict";
import { test } from "node:test";
import { isEmbedSrc, isImageSrc, isYoutubeSrc, toEmbed } from "./note-embeds";

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
