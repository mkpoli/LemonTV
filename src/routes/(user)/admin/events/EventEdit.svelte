<!-- src/routes/(user)/admin/events/EventEdit.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Event, Organizer, EventOrganizer, Team, Player } from '$lib/server/db/schema';
	import { m } from '$lib/paraglide/messages';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import IconParkSolidDelete from '~icons/icon-park-solid/delete';
	import IconParkSolidAdd from '~icons/icon-park-solid/add';

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
		organizers: eventOrganizers.map((eo) => eo.organizerId) || []
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
			// Get all players for this team, including those not yet assigned
			grouped[team.id] = players.filter((player) => {
				const isAssignedToOtherTeam = eventTeamPlayers.some(
					(tp) => tp.playerId === player.id && tp.teamId !== team.id
				);
				const isAssignedToThisTeam = eventTeamPlayers.some(
					(tp) => tp.playerId === player.id && tp.teamId === team.id
				);
				return !isAssignedToOtherTeam || isAssignedToThisTeam;
			});
		});
		playersByTeam = grouped;
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
</script>

<form
	method="POST"
	action={event.id ? '?/update' : '?/create'}
	use:enhance={() => {
		return async ({ result }) => {
			if (!validateDateRange()) {
				return;
			}
			if (result.type === 'success') {
				// Update team players if event was created/updated successfully
				const eventId = (result.data as { id?: string })?.id || event.id;
				if (eventId) {
					const formData = new FormData();
					formData.append('eventId', eventId);
					formData.append('players', JSON.stringify(eventTeamPlayers));
					await fetch('?/updateTeamPlayers', {
						method: 'POST',
						body: formData
					});
				}
				onsuccess();
				onCancel();
			} else if (result.type === 'failure') {
				errorMessage =
					typeof result.data?.error === 'string' ? result.data.error : 'Failed to save event';
			} else if (result.type === 'error') {
				errorMessage = result.error?.message || 'An error occurred';
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
			<div class="flex gap-2">
				<select
					id="organizers"
					name="organizers"
					bind:value={newEvent.organizers}
					multiple
					class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
				>
					{#each organizers as organizer}
						<option value={organizer.id}>{organizer.name}</option>
					{/each}
				</select>
				<button
					type="button"
					class="mt-1 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
					onclick={() => (newEvent.organizers = [])}
					title="Clear all organizers"
				>
					Clear
				</button>
			</div>
			<p class="mt-1 text-sm text-slate-400">
				Hold Ctrl/Cmd to select multiple organizers. You can add organizers later.
			</p>
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

		<div class="mb-4">
			<h3 class="mb-2 text-lg font-semibold">Teams and Players</h3>

			<!-- Team Selection -->
			<div class="mb-6">
				<label for="team-select" class="mb-2 block text-sm font-medium text-slate-300"
					>Select Teams</label
				>
				<div class="w-full">
					<Combobox
						items={teams
							.filter((team) => !selectedTeams.includes(team.id))
							.map((team) => ({
								id: team.id,
								name: team.name
							}))}
						value=""
						placeholder={m.select_team()}
						groups={[]}
						disabled={false}
						class="px-3 py-2"
						onChange={(item) => {
							addTeam(item.id);
						}}
					/>
				</div>
				<p class="mt-1 text-sm text-slate-400">Select a team to add it to the event</p>
			</div>

			<!-- Team Players -->
			<div class="mt-2 space-y-4">
				{#each teams.filter((team) => selectedTeams.includes(team.id)) as team}
					<div class="rounded-lg border border-slate-700 bg-slate-800">
						<div
							role="button"
							tabindex="0"
							class="flex w-full cursor-pointer items-center justify-between p-4 text-left"
							onclick={() => toggleTeam(team.id)}
							onkeydown={(e) => e.key === 'Enter' && toggleTeam(team.id)}
						>
							<div class="flex items-center gap-2">
								<h4 class="text-md font-medium text-slate-300">{team.name}</h4>
								<div class="flex items-center gap-1.5">
									{#each Object.entries(getTeamRoleCounts(team.id)) as [role, count]}
										{#if count > 0}
											<span
												class="rounded-full px-1.5 py-0.5 text-xs font-medium {role === 'main'
													? 'bg-blue-900/50 text-blue-300'
													: role === 'sub'
														? 'bg-purple-900/50 text-purple-300'
														: 'bg-amber-900/50 text-amber-300'}"
												title={`${count} ${role}${count === 1 ? '' : 's'}`}
											>
												{count}
											</span>
										{/if}
									{/each}
									{#if !Object.values(getTeamRoleCounts(team.id)).some((count) => count > 0)}
										<span
											class="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400"
											title="No players"
										>
											0
										</span>
									{/if}
								</div>
								<button
									type="button"
									class="text-red-400 hover:text-red-300"
									onclick={(e) => {
										e.stopPropagation();
										removeTeam(team.id);
									}}
									title={m.remove_team()}
								>
									<IconParkSolidDelete class="h-5 w-5" />
								</button>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="flex items-center gap-2 rounded-md border border-dashed border-slate-700 bg-slate-800/50 px-3 py-1.5 text-yellow-500 transition-colors hover:border-yellow-500 hover:bg-slate-800"
									onclick={(e) => {
										e.stopPropagation();
										addTeamPlayer(team.id);
										expandedTeams.add(team.id);
										expandedTeams = new Set(expandedTeams);
									}}
								>
									<IconParkSolidAdd class="h-4 w-4" />
									<span class="text-sm">{m.add_new_player()}</span>
								</button>
								<svg
									class="h-5 w-5 transform text-slate-400 transition-transform {expandedTeams.has(
										team.id
									)
										? 'rotate-180'
										: ''}"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</div>
						</div>

						{#if expandedTeams.has(team.id)}
							<div class="border-t border-slate-700">
								{#if playersByTeam[team.id]?.length > 0}
									<div class="divide-y divide-slate-700">
										{#each playersByTeam[team.id] as player, index}
											{@const teamPlayer = eventTeamPlayers.find(
												(tp) => tp.teamId === team.id && tp.playerId === player.id
											)}
											{#if teamPlayer}
												<div class="flex items-start gap-3 px-4 py-2 hover:bg-slate-800/50">
													<div class="flex-1">
														<label
															class="block text-sm font-medium text-slate-300"
															for="player-{team.id}-{index}"
														>
															{m.player()}
														</label>
														<div class="mt-1">
															<Combobox
																items={(() => {
																	const filteredPlayers = players
																		.filter((p) => {
																			// Show all players that are either:
																			// 1. Not assigned to any team in the event
																			// 2. Already assigned to this team
																			const isAssignedToOtherTeam = eventTeamPlayers.some(
																				(tp) => tp.playerId === p.id && tp.teamId !== team.id
																			);
																			const isAssignedToThisTeam = eventTeamPlayers.some(
																				(tp) => tp.playerId === p.id && tp.teamId === team.id
																			);
																			return !isAssignedToOtherTeam || isAssignedToThisTeam;
																		})
																		.map((p) => ({
																			id: p.id,
																			name: p.name,
																			group: eventTeamPlayers.some(
																				(tp) => tp.teamId === team.id && tp.playerId === p.id
																			)
																				? 'team'
																				: 'other'
																		}));
																	return filteredPlayers;
																})()}
																value={teamPlayer.playerId}
																placeholder={m.search_players()}
																groups={[
																	{ id: 'team', label: m.team_players() },
																	{ id: 'other', label: m.other_players() }
																]}
																disabled={false}
																class="px-2 py-1"
																onChange={(item) => {
																	teamPlayer.playerId = item.id;
																}}
															/>
														</div>
													</div>
													<div class="w-24">
														<label
															class="block text-sm font-medium text-slate-300"
															for="role-{team.id}-{index}"
														>
															{m.role()}
														</label>
														<select
															id="role-{team.id}-{index}"
															bind:value={teamPlayer.role}
															class="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
														>
															{#each roleOptions as role}
																<option value={role}>{role}</option>
															{/each}
														</select>
													</div>
													<button
														type="button"
														class="mt-auto mb-2 text-red-400 hover:text-red-300"
														onclick={() => removeTeamPlayer(teamPlayer)}
														title={m.remove()}
													>
														<IconParkSolidDelete class="h-4 w-4" />
													</button>
												</div>
											{/if}
										{/each}
									</div>
								{:else}
									<p class="px-4 py-2 text-sm text-slate-400">{m.no_data()}</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
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
