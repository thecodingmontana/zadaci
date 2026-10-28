// One emoji, as people pick them for reactions: flags, keycaps, skin tones and joined sequences
// (👩‍💻) included, but no words, several emoji, or anything that isn't one.

const EMOJI_PARTS =
	/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|‍|️|⃣)+$/u;
const PICTURE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

export function isEmoji(value: string) {
	return (
		value.length <= 32 &&
		EMOJI_PARTS.test(value) &&
		PICTURE.test(value) &&
		[...graphemes.segment(value)].length === 1
	);
}
