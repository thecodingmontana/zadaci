import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MotionConfig, motion } from "motion/react";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ZadaciLogo } from "#/components/zadaci-logo";
import {
	COMPLETE_ONBOARDING,
	SLUG_AVAILABLE,
	WORKSPACES,
} from "#/graphql/operations";
import {
	EMAIL_RE,
	MAX_INVITES,
	slugify,
	TEAM_SIZES,
	TEMPLATES,
	USE_CASES,
	VIEWS,
} from "#/lib/onboarding";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_authed/onboarding")({
	loader: async ({ context }) => {
		const { data } = await context.apolloClient.query({
			query: WORKSPACES,
			fetchPolicy: "network-only",
		});
		return { hasWorkspace: (data?.workspaces.length ?? 0) > 0 };
	},
	head: () => ({ meta: [{ title: "Set up your workspace - Zadaci" }] }),
	component: Onboarding,
});

const STEPS = 6;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Created = { slug: string; inviteCode: string; invites: number };

function Onboarding() {
	const { hasWorkspace } = Route.useLoaderData();
	const navigate = useNavigate();
	const [step, setStep] = useState(0);
	const [use, setUse] = useState<string>("product");
	const [ws, setWs] = useState("");
	const [url, setUrl] = useState("");
	const [urlTouched, setUrlTouched] = useState(false);
	const [view, setView] = useState<string>("board");
	const [size, setSize] = useState<string>("2-10");
	const [proj, setProj] = useState("Website Launch");
	const [projTouched, setProjTouched] = useState(false);
	const [tmpl, setTmpl] = useState<string>("web");
	const [invites, setInvites] = useState<string[]>(() =>
		Array(MAX_INVITES).fill(""),
	);
	const [errors, setErrors] = useState<{ ws?: string; url?: string }>({});
	const [created, setCreated] = useState<Created | null>(null);

	const slugStatus = useSlugStatus(url);
	const [completeOnboarding, { loading: saving }] =
		useMutation(COMPLETE_ONBOARDING);

	const template = TEMPLATES.find((t) => t.id === tmpl) ?? TEMPLATES[1];
	const viewLabel = VIEWS.find((v) => v.id === view)?.label ?? "Board";

	async function finish(sendInvites: boolean) {
		const emails = sendInvites
			? invites.map((e) => e.trim()).filter(Boolean)
			: [];
		const bad = emails.find((e) => !EMAIL_RE.test(e));
		if (bad) return toast.error(`${bad} isn't a valid email address`);

		try {
			const { data } = await completeOnboarding({
				variables: {
					input: {
						useCase: use,
						name: ws.trim(),
						slug: url,
						defaultView: view,
						teamSize: size,
						projectName: proj.trim(),
						templateId: tmpl,
						invites: emails,
					},
				},
				refetchQueries: [WORKSPACES],
			});
			if (!data) throw new Error("No response");
			setCreated({
				slug: data.completeOnboarding.slug,
				inviteCode: data.completeOnboarding.inviteCode,
				invites: emails.length,
			});
			setStep(5);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Something went wrong. Try again.";
			if (message.includes("URL")) {
				setErrors({ url: message });
				setStep(1);
				return;
			}
			toast.error("Couldn't create your workspace", { desc: message });
		}
	}

	function next() {
		if (step === 1) {
			if (!ws.trim())
				return setErrors({ ws: "Name your workspace to continue" });
			if (!url) return setErrors({ url: "Pick a URL for your workspace" });
			if (slugStatus === "taken")
				return setErrors({ url: "That URL is taken. Try another one." });
		}
		if (step === 3 && !proj.trim())
			return toast.error("Give your project a name");
		if (step === 4) return void finish(true);
		setStep(step + 1);
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		next();
	}

	const nav = (label = "Continue", skip = false) => (
		<div className="mt-1.5 flex items-center gap-2">
			{step > 0 && step < 5 && (
				<Button
					type="button"
					variant="ghost"
					onClick={() => setStep(step - 1)}
					disabled={saving}
				>
					<span
						className="icon-[solar--arrow-left-linear] size-3.5"
						aria-hidden="true"
					/>
					Back
				</Button>
			)}
			<span className="grow" />
			{skip && (
				<Button
					type="button"
					variant="ghost"
					onClick={() => void finish(false)}
					disabled={saving}
				>
					Skip for now
				</Button>
			)}
			<Button type="submit" size="lg" disabled={saving} aria-busy={saving}>
				{saving && (
					<span
						className="icon-[hugeicons--loading-03] size-4 animate-spin"
						aria-hidden="true"
					/>
				)}
				{label}
				<span
					className="icon-[solar--arrow-right-linear] size-4"
					aria-hidden="true"
				/>
			</Button>
		</div>
	);

	let body: ReactNode;
	if (step === 0) {
		body = (
			<>
				<Heading
					title="What are you working on?"
					sub="We'll tailor templates and views to fit. You can change this later."
				/>
				<RadioGroup
					label="What are you working on?"
					className="grid-cols-2 sm:grid-cols-3"
				>
					{USE_CASES.map((o) => (
						<Option
							key={o.id}
							name="use"
							checked={use === o.id}
							onChange={() => setUse(o.id)}
							icon={o.icon}
							title={o.name}
							desc={o.desc}
						/>
					))}
				</RadioGroup>
				{nav()}
			</>
		);
	} else if (step === 1) {
		body = (
			<>
				<Heading
					title="Create your workspace"
					sub="A workspace is where your team's projects live."
				/>
				<Field id="o-ws" label="Workspace name" error={errors.ws}>
					<Input
						id="o-ws"
						autoFocus
						className="h-10"
						placeholder="e.g. Gr8r Studio"
						value={ws}
						aria-invalid={!!errors.ws}
						onChange={(e) => {
							setWs(e.target.value);
							if (!urlTouched) setUrl(slugify(e.target.value));
							if (e.target.value.trim())
								setErrors((x) => ({ ...x, ws: undefined }));
						}}
					/>
				</Field>
				<Field id="o-url" label="Workspace URL" error={errors.url}>
					<div className="flex">
						<span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
							/w/
						</span>
						<Input
							id="o-url"
							className="h-10 rounded-l-none"
							placeholder="gr8r-studio"
							value={url}
							aria-invalid={!!errors.url}
							onChange={(e) => {
								setUrl(
									e.target.value
										.toLowerCase()
										.replace(/[^a-z0-9-]+/g, "-")
										.slice(0, 48),
								);
								setUrlTouched(true);
								setErrors((x) => ({ ...x, url: undefined }));
							}}
						/>
					</div>
					{url && !errors.url && <SlugHint slug={url} status={slugStatus} />}
				</Field>
				{nav()}
			</>
		);
	} else if (step === 2) {
		body = (
			<>
				<Heading
					title="How does your team work?"
					sub="We'll set your default project view."
				/>
				<RadioGroup label="Default project view" className="grid-cols-2">
					{VIEWS.map((o) => (
						<Option
							key={o.id}
							name="view"
							checked={view === o.id}
							onChange={() => setView(o.id)}
							icon={o.icon}
							title={o.name}
							desc={o.desc}
						/>
					))}
				</RadioGroup>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 text-sm font-medium">Team size</legend>
					<div className="inline-flex w-fit flex-wrap gap-0.5 rounded-md bg-muted p-0.5">
						{TEAM_SIZES.map((s) => (
							<label
								key={s}
								className="cursor-pointer rounded-[5px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_var(--border)] has-focus-visible:ring-2 has-focus-visible:ring-ring hover:text-foreground"
							>
								<input
									type="radio"
									name="size"
									className="sr-only"
									checked={size === s}
									onChange={() => setSize(s)}
								/>
								{s}
							</label>
						))}
					</div>
				</fieldset>
				{nav()}
			</>
		);
	} else if (step === 3) {
		body = (
			<>
				<Heading
					title="Create your first project"
					sub="Start from a template or a blank project."
				/>
				<Field id="o-proj" label="Project name">
					<Input
						id="o-proj"
						autoFocus
						className="h-10"
						value={proj}
						onChange={(e) => {
							setProj(e.target.value);
							setProjTouched(true);
						}}
					/>
				</Field>
				<RadioGroup
					label="Project template"
					className="grid-cols-2 sm:grid-cols-3"
				>
					{TEMPLATES.map((t) => (
						<Option
							key={t.id}
							name="tmpl"
							checked={tmpl === t.id}
							onChange={() => {
								setTmpl(t.id);
								if (!projTouched)
									setProj(t.name === "Website" ? "Website Launch" : t.name);
							}}
							icon={t.icon}
							title={t.name}
							desc={`${t.tasks.length} starter tasks`}
						/>
					))}
				</RadioGroup>
				{nav()}
			</>
		);
	} else if (step === 4) {
		body = (
			<>
				<Heading
					title="Invite your team"
					sub="Zadaci works best with your teammates. They can join with your invite link once your workspace is ready."
				/>
				<div className="flex flex-col gap-2">
					{invites.map((value, i) => (
						<Input
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed set of three inputs
							key={i}
							type="email"
							autoFocus={i === 0}
							className="h-10"
							placeholder="teammate@company.com"
							aria-label={`Teammate email ${i + 1}`}
							value={value}
							onChange={(e) =>
								setInvites((list) =>
									list.map((v, j) => (j === i ? e.target.value : v)),
								)
							}
						/>
					))}
				</div>
				{nav("Send invites", true)}
			</>
		);
	} else if (created) {
		const rows = [
			{
				icon: "icon-[solar--buildings-2-bold]",
				title: `Workspace “${ws.trim()}”`,
				sub: `/w/${created.slug}`,
			},
			{
				icon: template.icon,
				title: `Project “${proj.trim()}”`,
				sub: `${template.tasks.length} starter tasks · ${viewLabel} view`,
			},
			{
				icon: "icon-[solar--user-plus-bold]",
				title: created.invites
					? `${created.invites} invite${created.invites > 1 ? "s" : ""} saved`
					: "No invites yet",
				sub: created.invites
					? "They'll appear in Members once they join"
					: "Invite people any time with your invite link",
			},
		];
		body = (
			<>
				<div className="flex justify-center">
					<motion.span
						className="grid size-12 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600"
						initial={{ opacity: 0, transform: "scale(0.6)" }}
						animate={{ opacity: 1, transform: "scale(1)" }}
						transition={{
							type: "spring",
							duration: 0.5,
							bounce: 0.3,
							delay: 0.05,
						}}
					>
						<span
							className="icon-[solar--check-circle-bold] size-6"
							aria-hidden="true"
						/>
					</motion.span>
				</div>
				<Heading
					title="Your workspace is ready"
					sub="Here's what we set up for you."
				/>
				<ul className="overflow-hidden rounded-lg border">
					{rows.map((row, i) => (
						<motion.li
							key={row.title}
							className="flex items-center gap-3 border-t px-3.5 py-3 first:border-t-0"
							initial={{ opacity: 0, transform: "translateY(6px)" }}
							animate={{ opacity: 1, transform: "translateY(0px)" }}
							transition={{ duration: 0.4, ease: EASE_OUT, delay: i * 0.12 }}
						>
							<span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand/12 text-brand">
								<span className={cn(row.icon, "size-3.5")} aria-hidden="true" />
							</span>
							<div className="min-w-0 grow">
								<div className="truncate font-medium">{row.title}</div>
								<div className="truncate text-xs text-muted-foreground">
									{row.sub}
								</div>
							</div>
							<motion.span
								className="inline-flex text-emerald-600"
								initial={{ opacity: 0, transform: "scale(0.5)" }}
								animate={{ opacity: 1, transform: "scale(1)" }}
								transition={{
									type: "spring",
									duration: 0.42,
									bounce: 0.3,
									delay: 0.18 + i * 0.12,
								}}
							>
								<span
									className="icon-[hugeicons--tick-02] size-4"
									aria-hidden="true"
								/>
							</motion.span>
						</motion.li>
					))}
				</ul>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="self-start"
					onClick={async () => {
						await navigator.clipboard.writeText(
							`${location.origin}/join/${created.inviteCode}`,
						);
						toast.success("Invite link copied");
					}}
				>
					<span
						className="icon-[solar--link-bold] size-3.5"
						aria-hidden="true"
					/>
					Copy invite link
				</Button>
				<Button
					type="button"
					size="lg"
					className="w-full"
					onClick={() =>
						navigate({ to: "/w/$slug", params: { slug: created.slug } })
					}
				>
					Open workspace
					<span
						className="icon-[solar--arrow-right-linear] size-4"
						aria-hidden="true"
					/>
				</Button>
			</>
		);
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className="flex min-h-dvh flex-col bg-background">
				<header className="flex items-center justify-between px-6 py-4.5">
					<Link
						to="/"
						className="flex items-center gap-2 rounded-md font-semibold tracking-tight"
					>
						<ZadaciLogo className="size-6" />
						Zadaci
					</Link>
					{hasWorkspace && (
						<Button variant="ghost" size="sm" asChild>
							<Link to="/workspace">Exit setup</Link>
						</Button>
					)}
				</header>
				<main className="flex flex-1 justify-center px-4 pt-[6vh] pb-10">
					<form
						onSubmit={onSubmit}
						noValidate
						className={cn(
							"flex w-full flex-col gap-4",
							step === 5 ? "max-w-110" : "max-w-140",
						)}
					>
						<div
							className="mb-2 flex justify-center gap-1.5"
							aria-hidden="true"
						>
							{Array.from({ length: STEPS }, (_, i) => (
								<motion.i
									key={i === step ? `cur-${step}` : i}
									className={cn(
										"h-0.75 w-7 origin-left rounded-full",
										i <= step ? "bg-brand" : "bg-border",
									)}
									initial={i === step ? { transform: "scaleX(0)" } : false}
									animate={{ transform: "scaleX(1)" }}
									transition={{ duration: 0.45, ease: EASE_OUT }}
								/>
							))}
						</div>
						<p className="text-center text-xs text-muted-foreground">
							Step {step + 1} of {STEPS}
						</p>
						<motion.div
							key={step}
							className="flex flex-col gap-4"
							initial={{ opacity: 0, transform: "translateX(12px)" }}
							animate={{ opacity: 1, transform: "translateX(0px)" }}
							transition={{ duration: 0.36, ease: EASE_OUT }}
						>
							{body}
						</motion.div>
					</form>
				</main>
			</div>
		</MotionConfig>
	);
}

function useSlugStatus(slug: string) {
	const [debounced, setDebounced] = useState(slug);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(slug), 300);
		return () => clearTimeout(id);
	}, [slug]);
	const { data, loading } = useQuery(SLUG_AVAILABLE, {
		variables: { slug: debounced },
		skip: !debounced,
	});
	if (!slug) return "idle";
	if (loading || debounced !== slug) return "checking";
	return data?.slugAvailable ? "available" : "taken";
}

function SlugHint({
	slug,
	status,
}: {
	slug: string;
	status: ReturnType<typeof useSlugStatus>;
}) {
	if (status === "checking" || status === "idle") {
		return (
			<span className="text-xs text-muted-foreground">Checking /w/{slug}…</span>
		);
	}
	return status === "available" ? (
		<output className="flex items-center gap-1 text-xs text-emerald-600">
			<span className="icon-[hugeicons--tick-02] size-3" aria-hidden="true" />
			/w/{slug} is available
		</output>
	) : (
		<output className="flex items-center gap-1 text-xs text-destructive">
			<span
				className="icon-[solar--danger-circle-bold] size-3"
				aria-hidden="true"
			/>
			/w/{slug} is taken
		</output>
	);
}

function Heading({ title, sub }: { title: string; sub: string }) {
	return (
		<div className="flex flex-col gap-1 text-center">
			<h1 className="text-2xl font-semibold tracking-[-0.022em] text-balance">
				{title}
			</h1>
			<p className="text-sm text-pretty text-muted-foreground">{sub}</p>
		</div>
	);
}

function Field({
	id,
	label,
	error,
	children,
}: {
	id: string;
	label: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children}
			{error && (
				<span
					className="flex items-center gap-1 text-xs text-destructive"
					role="alert"
				>
					<span
						className="icon-[solar--danger-circle-bold] size-3"
						aria-hidden="true"
					/>
					{error}
				</span>
			)}
		</div>
	);
}

function RadioGroup({
	label,
	className,
	children,
}: {
	label: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<fieldset>
			<legend className="sr-only">{label}</legend>
			<div className={cn("grid gap-2", className)}>{children}</div>
		</fieldset>
	);
}

function Option({
	name,
	checked,
	onChange,
	icon,
	title,
	desc,
}: {
	name: string;
	checked: boolean;
	onChange: () => void;
	icon: string;
	title: string;
	desc: string;
}) {
	const id = useId();
	return (
		<label
			htmlFor={id}
			className="flex cursor-pointer flex-col gap-2 rounded-lg border bg-card px-3 py-3.5 text-left transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 has-checked:border-brand has-checked:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_18%,transparent)] has-focus-visible:ring-2 has-focus-visible:ring-ring"
		>
			<input
				id={id}
				type="radio"
				name={name}
				className="sr-only"
				checked={checked}
				onChange={onChange}
			/>
			<span
				className={cn(
					icon,
					"size-4.5",
					checked ? "text-brand" : "text-muted-foreground",
				)}
				aria-hidden="true"
			/>
			<b className="text-sm font-medium">{title}</b>
			<span className="text-xs text-muted-foreground">{desc}</span>
		</label>
	);
}
