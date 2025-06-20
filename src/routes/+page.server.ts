import { fail, type Actions } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';
import type { PageServerLoad } from './$types';
import { getPlayers, getPlayersTeams, calculatePlayerRating } from '$lib/server/data/players';
import { getEvents } from '$lib/data';
import { getEvents as getServerEvents } from '$lib/server/data/events';
import { getTeams } from '$lib/server/data/teams';

export const load: PageServerLoad = async () => {
	// TODO: Only get top players by pre populate player rating and rank them later, then limit to 5
	const players = await getPlayers();
	const playersTeams = await getPlayersTeams();
	return {
		events: [...getEvents(), ...(await getServerEvents())], // TODO: limit = 5
		teams: (await getTeams())
			.toSorted((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
			.map((team, index) => ({
				...team,
				rank: index + 1
			})),
		players: players
			.map((player) => ({
				...player,
				teams:
					playersTeams[player.id ?? '']?.map((team) => team?.name ?? undefined).filter(Boolean) ??
					[],
				rating: calculatePlayerRating(player)
			}))
			.toSorted((a, b) => b.rating - a.rating)
			.map((player, index) => ({
				...player,
				rank: index + 1
			}))
	};
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) {
			return fail(401);
		}
		await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);
	}
};
