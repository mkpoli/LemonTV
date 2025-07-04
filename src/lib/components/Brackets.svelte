<script lang="ts">
	import { calculateWinnerIndex } from '$lib/data';
	import type { Stage } from '$lib/data/events';
	import type { Match } from '$lib/data/matches';
	import type { Team } from '$lib/data/teams';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, type Locale } from '$lib/paraglide/runtime';
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let { stage, teams }: { stage: Stage; teams: Map<string, Team> } = $props();

	if (!stage) console.error('Stage is required');

	let rounds = $derived(
		stage.structure.rounds
			.filter((r) => r.parallelGroup === undefined)
			.toSorted((a, b) => a.id - b.id)
	);

	let matches = $derived(stage.matches);
	let matchesByRound: Map<number, Match[]> = $derived(
		new Map(
			rounds.map((r) => [
				r.id,
				matches
					.filter((m) => stage.structure.nodes.find((n) => n.matchId === m.id)?.round === r.id)
					.sort((a, b) => {
						// Get the node IDs for both matches
						const nodeA = stage.structure.nodes.find((n) => n.matchId === a.id);
						const nodeB = stage.structure.nodes.find((n) => n.matchId === b.id);
						// Sort by node ID to preserve the order defined in STAGE_NODES
						return (nodeA?.order ?? 0) - (nodeB?.order ?? 0);
					})
			])
		)
	);

	let parallelRounds = $derived(
		stage.structure.rounds.filter((r) => r.parallelGroup !== undefined)
	);
	let parallelMatchesByRound: Map<number, [title: string, matches: Match[]]> = $derived(
		new Map(
			parallelRounds.map((r) => [
				r.parallelGroup ?? 0,
				[
					r.title?.[getLocale() as Locale] ??
						m[r.type as 'thirdplace' | 'semifinals' | 'final' | 'quarterfinals'](),
					matches
						.filter((m) => stage.structure.nodes.find((n) => n.matchId === m.id)?.round === r.id)
						.sort((a, b) => {
							// Get the node IDs for both matches
							const nodeA = stage.structure.nodes.find((n) => n.matchId === a.id);
							const nodeB = stage.structure.nodes.find((n) => n.matchId === b.id);
							// Sort by node ID to preserve the order defined in STAGE_NODES
							return (nodeA?.order ?? 0) - (nodeB?.order ?? 0);
						})
				]
			])
		)
	);

	// Check if any matches are found through nodes
	let hasNodeMatches = $derived(
		stage.structure.nodes.some((n) => n.matchId !== null) &&
			matches.some((m) => stage.structure.nodes.some((n) => n.matchId === m.id))
	);

	// For your case, we want the third-place match to be in the same column as the final
	// So let's just use the original grid layout and position parallel rounds correctly
	let gridColumns = $derived(rounds.length);

	let container = $state<HTMLDivElement>();
	let positions = new SvelteMap<string, { x: number; y: number }>();
	function register(el: HTMLElement, matchId: string) {
		if (!container) {
			tick().then(() => register(el, matchId));
			return;
		}
		matchRefs.set(matchId, el);
		const rect = el.getBoundingClientRect();
		// relative to container’s top‑left:
		const cRect = container.getBoundingClientRect();
		positions.set(matchId, {
			x: rect.left + rect.width / 2 - cRect.left,
			y: rect.top + rect.height / 2 - cRect.top
		});
	}

	$inspect('container', container);

	// $inspect('positions', positions);
	$effect(() => {
		console.log('positions', positions);
	});

	let matchRefs = new SvelteMap<string, HTMLElement>();

	onMount(() => {
		const recalc = () => {
			if (!container) return;
			positions.clear();
			for (const [matchId, el] of matchRefs) {
				const rect = el.getBoundingClientRect();
				const cRect = container.getBoundingClientRect();
				positions.set(matchId, {
					x: rect.left + rect.width / 2 - cRect.left,
					y: rect.top + rect.height / 2 - cRect.top
				});
			}
		};

		window.addEventListener('resize', recalc);
		container?.addEventListener('scroll', recalc);

		// optionally trigger once after mount
		recalc();

		return () => {
			window.removeEventListener('resize', recalc);
			container?.removeEventListener('scroll', recalc);
		};
	});

	function isWinner(match: Match, team: Team | undefined) {
		if (!team || !calculateWinnerIndex(match)) return false;
		return (
			(calculateWinnerIndex(match) === 1 && team.abbr === match.teams[0].team) ||
			(calculateWinnerIndex(match) === 2 && team.abbr === match.teams[1].team)
		);
	}

	let tooltipID = $state<string>();

	let highlightingTeam = $state<string>();
</script>

{#snippet matchContainer(match: Match, i: number)}
	<div
		class="relative z-10 cursor-pointer bg-zinc-800 text-white decoration-0 shadow-md transition-shadow duration-200 hover:shadow-lg"
		use:register={match.id}
	>
		<!-- your MatchCard or custom markup -->
		<a
			href={`/matches/${match.id}`}
			class="match"
			onmouseenter={() => (tooltipID = match.id)}
			onmouseleave={() => (tooltipID = undefined)}
		>
			<button
				class={[
					'flex w-full justify-between gap-4 border-b-1 border-l-4 border-gray-500 px-2 py-1',
					isWinner(match, teams.get(match.teams[0].team))
						? 'border-l-yellow-400 font-semibold'
						: 'border-l-red-500 text-gray-300'
				]}
				onmouseenter={() => (highlightingTeam = teams.get(match.teams[0].team)?.id)}
				onmouseleave={() => (highlightingTeam = undefined)}
				class:bg-gray-700={highlightingTeam === teams.get(match.teams[0].team)?.id}
			>
				{teams.get(match.teams[0].team)?.name ?? match.teams[0].team}
				{#if match.teams[0].score !== undefined}
					<span class="score">{match.teams[0].score}</span>
				{/if}
			</button>
			<button
				class={[
					'flex w-full justify-between gap-4 border-l-4 border-gray-500 px-2 py-1',
					isWinner(match, teams.get(match.teams[1].team))
						? 'border-l-4 border-yellow-500 font-semibold'
						: 'border-l-4 border-red-500 text-gray-300'
				]}
				onmouseenter={() => (highlightingTeam = teams.get(match.teams[1].team)?.id)}
				onmouseleave={() => (highlightingTeam = undefined)}
				class:bg-gray-700={highlightingTeam === teams.get(match.teams[1].team)?.id}
			>
				{teams.get(match.teams[1].team)?.name ?? match.teams[1].team}
				{#if match.teams[1].score !== undefined}
					<span class="score">{match.teams[1].score}</span>
				{/if}
			</button>
		</a>
		{#if match.games && tooltipID === match.id}
			{@const results = match.games.map((g) => g.result)}
			<div
				id={`${match.id}-games`}
				class="absolute top-0 left-full grid h-full w-fit text-center"
				style:grid-template-columns={`repeat(${results.length}, 1fr)`}
			>
				{#each [0, 1] as rowIndex}
					{#each results as result, colIndex}
						<span
							class="w-8 border-gray-500 p-1 text-white"
							class:border-l={colIndex > 0}
							class:border-t={rowIndex > 0}
							class:bg-blue-500={result[0] === result[1]}
							class:bg-yellow-500={(rowIndex === 0 && result[0] > result[1]) ||
								(rowIndex === 1 && result[0] < result[1])}
							class:bg-red-500={(rowIndex === 0 && result[0] < result[1]) ||
								(rowIndex === 1 && result[0] > result[1])}
						>
							{result[rowIndex]}
						</span>
					{/each}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div
	bind:this={container}
	class="relative grid auto-rows-min justify-items-center gap-x-8 gap-y-0 overflow-x-auto bg-zinc-900 px-4 py-8 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-800"
	style="grid-template-columns: repeat({gridColumns}, 1fr);"
>
	{#each rounds as r}
		<h4 class="mb-4">
			{r.title?.[getLocale() as Locale] ??
				m[r.type as 'thirdplace' | 'semifinals' | 'final' | 'quarterfinals' | 'top16']()}
		</h4>
	{/each}
	{#each rounds as r, i}
		<div class="flex flex-col items-center justify-center" style:grid-column={i + 1}>
			<div class="flex flex-col gap-6">
				{#each hasNodeMatches ? (matchesByRound.get(r.id) ?? []) : i === 0 ? matches : [] as match (match.id)}
					{@render matchContainer(match, i)}
				{/each}
			</div>
		</div>
	{/each}

	{#each parallelRounds as r}
		{@const [title, roundMatches] = hasNodeMatches
			? (parallelMatchesByRound.get(r.parallelGroup ?? 0) ?? ['', []])
			: [
					r.title?.[getLocale() as Locale] ??
						m[r.type as 'thirdplace' | 'semifinals' | 'final' | 'quarterfinals'](),
					matches
				]}
		{@const targetColumn = r.type === 'thirdplace' ? gridColumns : 1}
		<div class="flex flex-col items-center justify-center" style:grid-column={targetColumn}>
			<div class="flex flex-col gap-6">
				<h4 class="text-center">{title}</h4>
				{#each roundMatches as match (match.id)}
					{@render matchContainer(match, targetColumn - 1)}
				{/each}
			</div>
		</div>
	{/each}

	<svg class="pointer-events-none absolute top-0 left-0 h-full w-full">
		{#each stage.structure.nodes as node}
			{#if node.dependsOn}
				{#each node.dependsOn as dep}
					{#if positions.has(dep.matchId) && positions.has(node.matchId)}
						{@const from = positions.get(dep.matchId) ?? { x: 0, y: 0 }}
						{@const to = positions.get(node.matchId) ?? { x: 0, y: 0 }}
						<!-- draw a bent line: horizontal then vertical -->
						<polyline
							points="
                {from.x},{from.y}
                {(from.x + to.x) / 2},{from.y}
                {(from.x + to.x) / 2},{to.y}
                {to.x},{to.y}
              "
							fill="none"
							class="stroke-gray-500"
							stroke-width="1"
						/>
					{/if}
				{/each}
			{/if}
		{/each}
	</svg>
</div>
