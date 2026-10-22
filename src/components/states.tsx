import {
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { reportError } from "#/lib/report-error";

// Full-page states from the reference (pages/errors.js): a missing page, and a page that
// failed to load. The access-denied state lives on the project page, where it knows the project.

export function PageNotFound() {
	const router = useRouter();
	return (
		<div className="fullstate">
			<div className="box">
				<div className="empty-state" style={{ padding: 0 }}>
					<div className="glyph">
						<span
							className="icon-[solar--file-text-linear] size-5"
							aria-hidden="true"
						/>
					</div>
				</div>
				<span className="code">ERROR 404</span>
				<h1>Page not found</h1>
				<p>
					The page you're looking for was moved, deleted, or never existed.
					Check the link or head back home.
				</p>
				<div className="row">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => router.history.back()}
					>
						<span
							className="icon-[solar--arrow-left-linear] size-3.5"
							aria-hidden="true"
						/>
						Go back
					</button>
					<Link to="/" className="btn btn-primary">
						Go to Home
					</Link>
				</div>
			</div>
		</div>
	);
}

/** Any error a page throws while loading or rendering (the 500 state). */
export function PageFailed({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	useEffect(() => reportError(error), [error]);
	return (
		<div className="fullstate">
			<div className="box">
				<div className="empty-state err" style={{ padding: 0 }}>
					<div className="glyph">
						<span
							className="icon-[solar--cloud-cross-linear] size-5"
							aria-hidden="true"
						/>
					</div>
				</div>
				<span className="code">ERROR 500</span>
				<h1>Something went wrong.</h1>
				<p>
					This page failed to load. Your data is safe — try again in a moment.
				</p>
				<div className="row">
					<Link to="/" className="btn btn-secondary">
						Go to Home
					</Link>
					<button
						type="button"
						className="btn btn-primary"
						onClick={async () => {
							await router.invalidate();
							reset();
						}}
					>
						<span
							className="icon-[solar--restart-linear] size-3.5"
							aria-hidden="true"
						/>
						Try again
					</button>
				</div>
			</div>
		</div>
	);
}
