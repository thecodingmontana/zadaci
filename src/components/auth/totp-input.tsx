import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "#/components/ui/input-otp";

export function TotpInput({
	value,
	onChange,
	onComplete,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	onComplete: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<InputOTP
			maxLength={6}
			pattern={REGEXP_ONLY_DIGITS}
			value={value}
			onChange={onChange}
			onComplete={onComplete}
			disabled={disabled}
			autoFocus
			aria-label="6-digit code from your authenticator app"
			containerClassName="justify-center"
		>
			<InputOTPGroup>
				<InputOTPSlot index={0} className="size-11 text-base" />
				<InputOTPSlot index={1} className="size-11 text-base" />
				<InputOTPSlot index={2} className="size-11 text-base" />
			</InputOTPGroup>
			<InputOTPSeparator />
			<InputOTPGroup>
				<InputOTPSlot index={3} className="size-11 text-base" />
				<InputOTPSlot index={4} className="size-11 text-base" />
				<InputOTPSlot index={5} className="size-11 text-base" />
			</InputOTPGroup>
		</InputOTP>
	);
}
