import { Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "#/components/theme-toggle";
import { ZadaciLogo } from "#/components/zadaci-logo";
import { StarButton } from "./star-button";

/** Phone menu (≤768px): a full-screen dialog that grows out of the burger as a circle. */
export function MobileMenu({
	links,
}: {
	links: { href: string; label: string }[];
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const burger = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [origin, setOrigin] = useState({ x: 44, y: 38 });
	// where to scroll once the menu has closed
	const target = useRef<string | null>(null);

	const show = () => {
		const r = burger.current?.getBoundingClientRect();
		if (r)
			setOrigin({
				x: window.innerWidth - (r.left + r.width / 2),
				y: r.top + r.height / 2,
			});
		dialog.current?.showModal();
		setOpen(true);
	};
	const finish = () => {
		const d = dialog.current;
		if (!d) return;
		d.classList.remove("closing");
		d.close();
	};
	const hide = () => {
		const d = dialog.current;
		if (!d?.open) return;
		d.classList.add("closing");
		// the close keyframes end the dialog (animationend); with none running, end it now
		if (!d.getAnimations().length) finish();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: hide and finish only touch refs
	useEffect(() => {
		const d = dialog.current;
		if (!d) return;
		const onClose = () => {
			setOpen(false);
			burger.current?.focus();
			const id = target.current;
			target.current = null;
			if (id)
				document.querySelector(id)?.scrollIntoView({
					behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
						? "auto"
						: "smooth",
				});
		};
		const onCancel = (e: Event) => {
			e.preventDefault(); // Esc: close with the animation
			hide();
		};
		const onEnd = (e: AnimationEvent) => {
			if (e.target === d && d.classList.contains("closing")) finish();
		};
		const onResize = () => {
			if (d.open && window.innerWidth > 768) finish();
		};
		d.addEventListener("close", onClose);
		d.addEventListener("cancel", onCancel);
		d.addEventListener("animationend", onEnd);
		window.addEventListener("resize", onResize);
		return () => {
			d.removeEventListener("close", onClose);
			d.removeEventListener("cancel", onCancel);
			d.removeEventListener("animationend", onEnd);
			window.removeEventListener("resize", onResize);
		};
	}, []);

	// the page behind doesn't scroll while the menu is open
	useEffect(() => {
		if (!open) return;
		const root = document.documentElement;
		const was = root.style.overflow;
		root.style.overflow = "hidden";
		return () => {
			root.style.overflow = was;
		};
	}, [open]);

	return (
		<>
			<button
				ref={burger}
				type="button"
				className="ibtn min-[769px]:hidden"
				aria-label="Open menu"
				aria-expanded={open}
				aria-controls="landing-menu"
				onClick={show}
			>
				<span
					className="icon-[solar--hamburger-menu-linear] size-5"
					aria-hidden="true"
				/>
			</button>
			<dialog
				ref={dialog}
				id="landing-menu"
				aria-label="Menu"
				className="lp-menu fixed inset-x-0 top-0 m-0 h-[min(100dvh,900px)] max-h-none w-full max-w-none flex-col border-0 bg-(--q-text) p-0 text-(color:--q-text-inv) backdrop:bg-transparent open:flex dark:bg-(--q-surface-2) dark:text-(color:--q-text)"
				style={
					{
						"--menu-x": `${origin.x}px`,
						"--menu-y": `${origin.y}px`,
					} as CSSProperties
				}
			>
				<div className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
					<span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
						<ZadaciLogo className="size-6" />
						Zadaci
					</span>
					<span className="ml-auto lp-menu-on-ink">
						<ThemeToggle />
					</span>
					<button
						type="button"
						className="ibtn lp-menu-on-ink"
						aria-label="Close menu"
						onClick={hide}
					>
						<span
							className="icon-[solar--close-circle-linear] size-5"
							aria-hidden="true"
						/>
					</button>
				</div>
				<nav
					aria-label="Sections"
					className="mt-auto flex flex-col px-4 pb-10 sm:px-6"
				>
					<ul className="flex flex-col">
						{links.map((l, i) => (
							<li
								key={l.href}
								className="lp-menu-item"
								style={{ "--d": `${0.12 + i * 0.05}s` } as CSSProperties}
							>
								<a
									href={l.href}
									className="block text-[3.25rem] leading-[1.02] font-semibold tracking-[-0.035em]"
									onClick={(e) => {
										e.preventDefault();
										target.current = l.href;
										hide();
									}}
								>
									{l.label}
								</a>
							</li>
						))}
					</ul>
					<div
						className="lp-menu-item mt-8 flex flex-wrap items-center gap-4"
						style={{ "--d": "0.4s" } as CSSProperties}
					>
						<Link to="/auth/signin" className="btn btn-primary">
							Sign up
						</Link>
						<StarButton />
						<Link
							to="/auth/signin"
							className="text-(length:--q-fs-md) underline-offset-4 hover:underline"
						>
							Log in
						</Link>
					</div>
				</nav>
			</dialog>
		</>
	);
}
