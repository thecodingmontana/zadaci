import {
	type EmojiPickerListComponents,
	EmojiPicker as Picker,
} from "frimousse";

// The one emoji picker, used wherever an emoji is chosen: page and collection icons, comment
// reactions, the comment box and notes. Frimousse does search, categories and skin tones; the
// emoji list is fetched once from its CDN and then cached by the browser.

// defined once here, not inside the picker: a component made during render remounts every time
const LIST: EmojiPickerListComponents = {
	CategoryHeader: ({ category, ...props }) => (
		<div className="emoji-cat" {...props}>
			{category.label}
		</div>
	),
	Row: ({ children, ...props }) => (
		<div className="emoji-row" {...props}>
			{children}
		</div>
	),
	Emoji: ({ emoji, ...props }) => (
		<button
			type="button"
			className="emoji-btn"
			data-active={emoji.isActive || undefined}
			{...props}
		>
			{emoji.emoji}
		</button>
	),
};

export default function EmojiPickerImpl({
	onPick,
	autoFocus = true,
}: {
	onPick: (emoji: string) => void;
	autoFocus?: boolean;
}) {
	return (
		<Picker.Root
			className="emoji-picker"
			columns={8}
			onEmojiSelect={({ emoji }) => onPick(emoji)}
		>
			<Picker.Search
				className="input input-sm emoji-search"
				placeholder="Search emoji"
				aria-label="Search emoji"
				autoFocus={autoFocus}
			/>
			<Picker.Viewport className="emoji-viewport">
				<Picker.Loading className="emoji-note faint">Loading…</Picker.Loading>
				<Picker.Empty className="emoji-note faint">No emoji found</Picker.Empty>
				<Picker.List className="emoji-list" components={LIST} />
			</Picker.Viewport>
			<div className="emoji-foot">
				<Picker.ActiveEmoji>
					{({ emoji }) =>
						emoji ? (
							<span className="emoji-active">
								<span aria-hidden="true">{emoji.emoji}</span>
								<span className="trunc">{emoji.label}</span>
							</span>
						) : (
							<span className="faint">Pick an emoji</span>
						)
					}
				</Picker.ActiveEmoji>
				<Picker.SkinToneSelector
					className="ibtn ibtn-sm emoji-skin"
					aria-label="Change skin tone"
				/>
			</div>
		</Picker.Root>
	);
}
