<!-- src/routes/(user)/admin/events/EventEdit.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Event, Organizer, EventOrganizer, Team, Player } from '$lib/server/db/schema';
	import { m } from '$lib/paraglide/messages';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import VideoInput from '$lib/components/forms/VideoInput.svelte';
	import ResultInput from '$lib/components/forms/ResultInput.svelte';
	import WebsiteInput from '$lib/components/forms/WebsiteInput.svelte';
	import TeamPlayersInput from '$lib/components/forms/TeamPlayersInput.svelte';
	import OrganizerInput from '$lib/components/forms/OrganizerInput.svelte';
	import CasterInput from '$lib/components/forms/CasterInput.svelte';
	import type { EventResult } from '$lib/data/events';
	import type { TCountryCode } from 'countries-list';

	let {
		event,
		organizers,
		eventOrganizers,
		teams,
		players,
		teamPlayers,
		onCancel,
		onSuccess: onsuccess
	}: {
		event: Partial<Event>;
		organizers: Organizer[];
		eventOrganizers: EventOrganizer[];
		teams: Team[];
		players: Player[];
		teamPlayers: Array<{ teamId: string; playerId: string; role: string }>;
		onCancel: () => void;
		onSuccess: () => void;
	} = $props();

	let newEvent = $state({
		id: event.id || '',
		name: event.name || '',
		slug: event.slug || '',
		server: event.server || 'strinova',
		format: event.format || 'online',
		region: event.region || 'Global',
		status: event.status || 'upcoming',
		capacity: event.capacity || 0,
		date: event.date || new Date().toISOString().split('T')[0],
		image: event.image || '',
		official: event.official || false,
		organizers: eventOrganizers.map((eo) => eo.organizerId) || [],
		websites: ((event as any).websites || []).map((w: any) => ({
			url: typeof w === 'string' ? w : w.url,
			label: typeof w === 'string' ? undefined : w.label
		})),
		videos: ((event as any).videos || []).map((v: any) => ({
			type: v.type || 'stream',
			platform: v.platform || 'twitch',
			url: v.url || '',
			title: v.title || ''
		})) as {
			type: 'stream' | 'clip' | 'vod';
			platform: 'twitch' | 'youtube' | 'bilibili';
			url: string;
			title: string;
		}[],
		casters: ((event as any).casters || []).map((c: any) => ({
			playerId: c.player.id,
			role: c.role
		})) as Array<{
			playerId: string;
			role: 'host' | 'analyst' | 'commentator';
		}>
	});

	let eventTeamPlayers = $state<
		Array<{
			teamId: string;
			playerId: string;
			role: 'main' | 'sub' | 'coach';
		}>
	>([]);

	// Track selected teams
	let selectedTeams = $state<string[]>([]);
	// Track which teams are expanded
	let expandedTeams = $state<Set<string>>(new Set());

	// Group players by team
	let playersByTeam = $state<Record<string, Player[]>>({});

	// Load existing team players when editing an event
	$effect(() => {
		if (event.id) {
			fetch(`/api/events/${event.id}/team-players`)
				.then((res) => res.json())
				.then((data) => {
					eventTeamPlayers = data.map((tp: any) => ({
						teamId: tp.teamId,
						playerId: tp.playerId,
						role: tp.role
					}));
					// Initialize selected teams from existing team players
					selectedTeams = [...new Set(eventTeamPlayers.map((tp) => tp.teamId))];
				})
				.catch((e) => {
					console.error('Failed to load team players:', e);
				});
		}
	});

	// Update playersByTeam when eventTeamPlayers changes
	$effect(() => {
		const grouped: Record<string, Player[]> = {};
		teams.forEach((team) => {
			// Get all players for this team
			grouped[team.id] = players;
		});
		playersByTeam = grouped;
	});

	// Load existing casters when editing an event
	$effect(() => {
		if (event.id) {
			fetch(`/api/events/${event.id}/casters`)
				.then((res) => res.json())
				.then((data) => {
					newEvent.casters = data.map((c: any) => ({
						playerId: c.playerId,
						role: c.role
					}));
				})
				.catch((e) => {
					console.error('Failed to load casters:', e);
				});
		}
	});

	let errorMessage = $state('');
	let successMessage = $state('');
	let dateRange = $state({ start: '', end: '' });

	// Initialize date range from event.date
	$effect(() => {
		if (event.date?.includes('/')) {
			const [start, end] = event.date.split('/');
			dateRange.start = start;
			dateRange.end = end;
		} else {
			dateRange.start = event.date || new Date().toISOString().split('T')[0];
			dateRange.end = event.date || new Date().toISOString().split('T')[0];
		}
	});

	// Update newEvent.date when dateRange changes
	$effect(() => {
		if (dateRange.start && dateRange.end) {
			newEvent.date =
				dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start}/${dateRange.end}`;
		}
	});

	function validateDateRange() {
		if (!dateRange.start || !dateRange.end) {
			errorMessage = 'Both start and end dates are required';
			return false;
		}
		if (new Date(dateRange.start) > new Date(dateRange.end)) {
			errorMessage = 'Start date must be before or equal to end date';
			return false;
		}
		return true;
	}

	function addTeam(teamId: string) {
		if (!selectedTeams.includes(teamId)) {
			selectedTeams = [...selectedTeams, teamId];
			// Add all players from the team by default, but only if they're not already assigned
			const newTeamPlayers = teamPlayers
				.filter((tp) => tp.teamId === teamId)
				.filter(
					(tp) =>
						!eventTeamPlayers.some((etp) => etp.teamId === teamId && etp.playerId === tp.playerId)
				)
				.map((tp) => ({
					teamId,
					playerId: tp.playerId,
					role: 'main' as const
				}));
			eventTeamPlayers = [...eventTeamPlayers, ...newTeamPlayers];
			// Expand the team when adding it
			expandedTeams.add(teamId);
		}
	}

	function removeTeam(teamId: string) {
		selectedTeams = selectedTeams.filter((id) => id !== teamId);
		// Remove all players associated with this team
		eventTeamPlayers = eventTeamPlayers.filter((tp) => tp.teamId !== teamId);
		// Remove from expanded teams
		expandedTeams.delete(teamId);
	}

	function toggleTeam(teamId: string) {
		if (expandedTeams.has(teamId)) {
			expandedTeams.delete(teamId);
		} else {
			expandedTeams.add(teamId);
		}
		expandedTeams = new Set(expandedTeams); // Trigger reactivity
	}

	function addTeamPlayer(teamId: string) {
		eventTeamPlayers = [
			...eventTeamPlayers,
			{
				teamId,
				playerId: players?.length > 0 ? players[0].id : '',
				role: 'main'
			}
		];
	}

	function removeTeamPlayer(teamPlayer: { teamId: string; playerId: string; role: string }) {
		eventTeamPlayers = eventTeamPlayers.filter(
			(tp) => !(tp.teamId === teamPlayer.teamId && tp.playerId === teamPlayer.playerId)
		);
	}

	function updateTeamPlayer(index: number, field: 'teamId' | 'playerId' | 'role', value: string) {
		eventTeamPlayers = eventTeamPlayers.map((tp, i) =>
			i === index ? { ...tp, [field]: value } : tp
		);
	}

	const statusOptions = ['upcoming', 'live', 'finished', 'cancelled', 'postponed'];
	const serverOptions = {
		strinova: 'Strinova',
		calabiyau: 'CalabiYau'
	};
	const formatOptions = ['online', 'lan', 'hybrid'];
	const regionOptions = ['Global', 'APAC', 'EU', 'CN', 'NA', 'SA', 'AF', 'OC'];
	const roleOptions = ['main', 'sub', 'coach'];

	// Helper function to get role counts for a team
	function getTeamRoleCounts(teamId: string) {
		const counts = { main: 0, sub: 0, coach: 0 };
		eventTeamPlayers
			.filter((tp) => tp.teamId === teamId)
			.forEach((tp) => {
				counts[tp.role as keyof typeof counts]++;
			});
		return counts;
	}

	// Helper function to check for duplicate players
	function getPlayerValidationStatus(teamId: string, playerId: string) {
		const sameTeamEntries = eventTeamPlayers.filter(
			(tp) => tp.teamId === teamId && tp.playerId === playerId
		);
		const otherTeamEntries = eventTeamPlayers.filter(
			(tp) => tp.teamId !== teamId && tp.playerId === playerId
		);

		const validations = [];

		if (sameTeamEntries.length > 1) {
			validations.push({
				type: 'error',
				message: 'This player appears multiple times in the same team'
			});
		}

		if (otherTeamEntries.length > 0) {
			const otherTeamNames = otherTeamEntries
				.map((tp) => teams.find((t) => t.id === tp.teamId)?.name)
				.filter(Boolean)
				.join(', ');
			validations.push({
				type: 'warning',
				message: `Player is already in other teams: ${otherTeamNames}`
			});
		}

		return validations.length > 0 ? validations : null;
	}

	let results = $state<
		Array<{
			teamId: string;
			rank: number;
			rankTo?: number;
			prizeAmount: number;
			prizeCurrency: string;
		}>
	>(
		((event as any).results ?? []).map((result: EventResult) => ({
			teamId: result.team.id,
			rank: result.rank,
			rankTo: result.rankTo,
			prizeAmount: result.prizes[0]?.amount ?? 0,
			prizeCurrency: result.prizes[0]?.currency ?? 'Bablo'
		}))
	);

	let isSubmitting = $state(false);
</script>

<form
	method="POST"
	action={event.id ? '?/update' : '?/create'}
	use:enhance={({ formData }) => {
		isSubmitting = true;
		// Add results data
		formData.append('results', JSON.stringify(results));
		// Add websites data
		formData.append('websites', JSON.stringify(newEvent.websites));
		// Add team players data
		formData.append('players', JSON.stringify(eventTeamPlayers));
		// Add videos data
		formData.append('videos', JSON.stringify(newEvent.videos));
		// Add casters data
		formData.append('casters', JSON.stringify(newEvent.casters));
		return async ({ result }) => {
			isSubmitting = false;
			if (result.type === 'success') {
				onsuccess();
				onCancel();
			} else if (result.type === 'failure') {
				errorMessage =
					(result as { type: 'failure'; data?: { error?: string } }).data?.error ??
					'An error occurred';
			} else if (result.type === 'error') {
				errorMessage =
					(result as { type: 'error'; error: any }).error?.message ?? 'An error occurred';
			}
		};
	}}
	class="flex h-full flex-col"
>
	{#if errorMessage}
		<div class="mb-4 rounded-md bg-red-900/50 p-4 text-red-200" role="alert">
			<span class="block sm:inline">{errorMessage}</span>
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-4 rounded-md bg-green-900/50 p-4 text-green-200" role="alert">
			<span class="block sm:inline">{successMessage}</span>
		</div>
	{/if}

	<div
		class="flex-1 space-y-4 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500 [&::-webkit-scrollbar-track]:bg-slate-800"
	>
		{#if event.id}
			<div>
				<label class="block text-sm font-medium text-slate-300" for="eventId">ID</label>
				<input
					type="text"
					id="eventId"
					name="id"
					value={event.id}
					readonly
					class="block w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-slate-400 placeholder:text-slate-500 focus:ring-2 focus:ring-yellow-500 focus:outline-none [&:read-only]:cursor-default [&:read-only]:opacity-75 [&:read-only]:select-none"
				/>
			</div>
		{/if}

		<div>
			<label class="block text-sm font-medium text-slate-300" for="name">{m.name()}</label>
			<input
				type="text"
				id="name"
				name="name"
				bind:value={newEvent.name}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="slug">{m.slug()}</label>
			<input
				type="text"
				id="slug"
				name="slug"
				bind:value={newEvent.slug}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="server">{m.server()}</label>
			<select
				id="server"
				name="server"
				bind:value={newEvent.server}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			>
				{#each Object.entries(serverOptions) as [server, label]}
					<option value={server}>{label}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="format">{m.format()}</label>
			<select
				id="format"
				name="format"
				bind:value={newEvent.format}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			>
				{#each formatOptions as format}
					<option value={format}>{format}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="region">{m.region()}</label>
			<select
				id="region"
				name="region"
				bind:value={newEvent.region}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			>
				{#each regionOptions as region}
					<option value={region}>{region}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="status">{m.status()}</label>
			<select
				id="status"
				name="status"
				bind:value={newEvent.status}
				required
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			>
				{#each statusOptions as status}
					<option value={status}>{status}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="capacity">{m.capacity()}</label>
			<input
				type="number"
				id="capacity"
				name="capacity"
				bind:value={newEvent.capacity}
				required
				min="0"
				class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="date">{m.date()}</label>
			<div class="mt-1 grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm text-slate-400" for="dateStart">Start Date</label>
					<input
						type="date"
						id="dateStart"
						bind:value={dateRange.start}
						required
						class="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
					/>
				</div>
				<div>
					<label class="block text-sm text-slate-400" for="dateEnd">End Date</label>
					<input
						type="date"
						id="dateEnd"
						bind:value={dateRange.end}
						required
						class="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
					/>
				</div>
			</div>
			<input type="hidden" name="date" value={newEvent.date} />
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="image">{m.image()}</label>
			<ImageUpload bind:value={newEvent.image} prefix="events" />
			<input type="hidden" name="image" value={newEvent.image} />
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-300" for="organizers">Organizers</label>
			<OrganizerInput id="organizers" {organizers} bind:selectedOrganizers={newEvent.organizers} />
		</div>

		<div class="flex items-center">
			<input
				type="checkbox"
				id="official"
				name="official"
				bind:checked={newEvent.official}
				class="h-4 w-4 rounded border-slate-700 bg-slate-800 text-yellow-500 focus:ring-yellow-500"
			/>
			<label for="official" class="ml-2 block text-sm text-slate-300">{m.official_event()}</label>
		</div>

		<section class="mb-6 flex flex-col gap-4">
			<h3 class="text-lg font-semibold">Teams and Players</h3>
			<TeamPlayersInput {teams} {players} {teamPlayers} bind:selectedTeams bind:eventTeamPlayers />
		</section>

		<section class="mb-6 flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{m.links()}</h3>
			<WebsiteInput bind:websites={newEvent.websites} />
		</section>

		<section class="mb-6 flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{m.results()}</h3>
			<ResultInput bind:results {teams} {selectedTeams} />
		</section>

		<section class="mb-6 flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{m.videos()}</h3>
			<VideoInput bind:videos={newEvent.videos} />
		</section>

		<section class="mb-6 flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{m.casters()}</h3>
			<!-- TODO: nationality should include all nationalities -->
			<CasterInput
				players={players.map((p) => ({
					...p,
					nationalities: (p.nationality ? [p.nationality] : []) as TCountryCode[],
					gameAccounts: []
				}))}
				bind:casters={newEvent.casters}
			/>
		</section>
	</div>

	<div class="mt-6 flex justify-end gap-4 border-t border-slate-700 pt-4">
		<button
			type="button"
			class="rounded-md border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800"
			onclick={onCancel}
		>
			{m.cancel()}
		</button>
		<button
			type="submit"
			class="rounded-md bg-yellow-500 px-4 py-2 font-medium text-black hover:bg-yellow-600"
		>
			{event.id ? m.update_event() : m.create_event()}
		</button>
	</div>
</form>
