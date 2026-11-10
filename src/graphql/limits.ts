import {
	type FragmentDefinitionNode,
	GraphQLError,
	Kind,
	type SelectionSetNode,
	type ValidationRule,
} from "graphql";

// Request limits, checked before anything runs: how many aliases a request may use, how deep it
// may nest, and a rough cost (a field costs 1; one with fields under it costs 2 plus 1.5× what's
// under it), so one request can't ask for a list hundreds of times or nest without end.

export type Limits = { aliases: number; depth: number; cost: number };

type Size = { aliases: number; depth: number; cost: number };

function measure(
	set: SelectionSetNode | undefined,
	fragments: Map<string, FragmentDefinitionNode>,
	inside: Set<string>,
): Size {
	const size: Size = { aliases: 0, depth: 0, cost: 0 };
	for (const node of set?.selections ?? []) {
		if (node.kind === Kind.FIELD) {
			if (node.name.value.startsWith("__")) continue; // introspection
			const under = measure(node.selectionSet, fragments, inside);
			size.aliases += (node.alias ? 1 : 0) + under.aliases;
			size.depth = Math.max(size.depth, 1 + under.depth);
			size.cost += node.selectionSet ? 2 + 1.5 * under.cost : 1;
			continue;
		}
		const name = node.kind === Kind.FRAGMENT_SPREAD ? node.name.value : null;
		const fragment = name
			? fragments.get(name)
			: node.kind === Kind.INLINE_FRAGMENT
				? node
				: undefined;
		// a fragment that spreads itself is refused by GraphQL's own rules; just don't loop
		if (!fragment || (name && inside.has(name))) continue;
		const under = measure(
			fragment.selectionSet,
			fragments,
			name ? new Set([...inside, name]) : inside,
		);
		size.aliases += under.aliases;
		size.depth = Math.max(size.depth, under.depth);
		size.cost += under.cost;
	}
	return size;
}

/** One validation rule for all three limits; Yoga adds it to every request. */
export const requestLimits =
	(limits: Limits): ValidationRule =>
	(context) => ({
		OperationDefinition(operation) {
			const fragments = new Map(
				context
					.getDocument()
					.definitions.filter(
						(d): d is FragmentDefinitionNode =>
							d.kind === Kind.FRAGMENT_DEFINITION,
					)
					.map((d) => [d.name.value, d]),
			);
			const size = measure(operation.selectionSet, fragments, new Set());
			const over = (what: string, value: number, max: number) =>
				context.reportError(
					new GraphQLError(
						`This request has too many ${what} (${Math.ceil(value)}, at most ${max}).`,
						{ nodes: [operation] },
					),
				);
			if (size.aliases > limits.aliases)
				over("aliases", size.aliases, limits.aliases);
			if (size.depth > limits.depth) over("levels", size.depth, limits.depth);
			if (size.cost > limits.cost) over("fields", size.cost, limits.cost);
		},
	});
