import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			icons={{
				success: <span className="icon-[solar--check-circle-bold] size-4" />,
				info: <span className="icon-[solar--info-circle-bold] size-4" />,
				warning: <span className="icon-[solar--danger-triangle-bold] size-4" />,
				error: <span className="icon-[solar--close-circle-bold] size-4" />,
				loading: (
					<span className="icon-[hugeicons--loading-03] size-4 animate-spin" />
				),
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
