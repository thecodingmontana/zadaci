import assert from "node:assert/strict";
import { test } from "node:test";
import {
	cleanUrl,
	fetchPreview,
	isPublicAddress,
	kindOf,
	parsePreview,
} from "./link-preview.server";

test("internal and reserved addresses are refused; public ones pass", () => {
	for (const ip of [
		"127.0.0.1",
		"10.1.2.3",
		"172.20.0.1",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"0.0.0.0",
		"::1",
		"::",
		"fd00::1",
		"fe80::1",
		"::ffff:127.0.0.1",
		"::ffff:7f00:1",
		"64:ff9b::a9fe:a9fe",
		"not-an-ip",
	])
		assert.equal(isPublicAddress(ip), false, ip);
	for (const ip of [
		"8.8.8.8",
		"1.1.1.1",
		"2606:4700:4700::1111",
		"64:ff9b::1457:f500",
	])
		assert.equal(isPublicAddress(ip), true, ip);
});

test("links are cleaned to http(s) on a normal port", () => {
	assert.equal(cleanUrl("example.com/a"), "https://example.com/a");
	assert.equal(cleanUrl(" https://example.com "), "https://example.com/");
	for (const bad of [
		"javascript:alert(1)",
		"file:///etc/passwd",
		"ftp://example.com",
		"https://user:pw@example.com",
		"https://example.com:8080/",
		"http://localhost/",
		"",
		`https://example.com/${"a".repeat(2001)}`,
	])
		assert.equal(cleanUrl(bad), null, bad);
});

test("fetching refuses internal hosts before any request", async () => {
	for (const url of [
		"http://127.0.0.1/",
		"http://169.254.169.254/latest/meta-data",
		"http://[::1]/",
		"http://localhost.localdomain.",
	])
		await assert.rejects(fetchPreview(url), url);
});

test("page details come from Open Graph, then plain tags", () => {
	const html = `<html><head>
		<title>Plain &amp; title</title>
		<meta property="og:title" content="Ten &quot;Basic&quot; Principles">
		<meta name='description' content='Building blocks of design'>
		<meta property="og:image" content="http://cdn.example.com/a.png">
		<meta property="og:site_name" content="Prototypr">
	</head></html>`;
	assert.deepEqual(parsePreview(html, "https://blog.example.com/post"), {
		url: "https://blog.example.com/post",
		title: 'Ten "Basic" Principles',
		description: "Building blocks of design",
		image: "https://cdn.example.com/a.png",
		site: "Prototypr",
		kind: "article",
	});
	const plain = parsePreview(
		`<title>Only &#39;a&#39; title</title><meta name="twitter:image" content="/img.jpg">`,
		"https://www.example.com/x",
	);
	assert.equal(plain.title, "Only 'a' title");
	assert.equal(plain.image, "https://www.example.com/img.jpg");
	assert.equal(plain.site, "example.com");
	assert.equal(
		parsePreview("", "https://www.example.com/").title,
		"example.com",
	);
	assert.equal(
		parsePreview(
			`<meta property="og:image" content="javascript:alert(1)">`,
			"https://example.com/",
		).image,
		null,
	);
});

test("links are sorted into articles, documents and videos", () => {
	assert.equal(kindOf("https://www.youtube.com/watch?v=x"), "video");
	assert.equal(kindOf("https://youtu.be/x"), "video");
	assert.equal(kindOf("https://example.com/a", "", "video.other"), "video");
	assert.equal(kindOf("https://example.com/paper.PDF"), "document");
	assert.equal(kindOf("https://docs.google.com/document/d/1"), "document");
	assert.equal(kindOf("https://example.com/x", "application/pdf"), "document");
	assert.equal(kindOf("https://example.com/blog/post"), "article");
});
