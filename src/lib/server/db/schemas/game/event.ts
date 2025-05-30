import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { organizer } from './organizer';
import { team } from './team';
import { player } from './player';

export const event = sqliteTable('event', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	official: integer('official', { mode: 'boolean' }).notNull(),
	server: text('server').notNull(),
	format: text('format').notNull(),
	region: text('region').notNull(),
	image: text('image').notNull(),
	status: text('status').notNull(),
	capacity: integer('capacity').notNull(),
	date: text('date').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

export const eventOrganizer = sqliteTable(
	'event_organizer',
	{
		eventId: text('event_id')
			.references(() => event.id)
			.notNull(),
		organizerId: text('organizer_id')
			.references(() => organizer.id)
			.notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [primaryKey({ columns: [t.eventId, t.organizerId] })]
);

export const eventTeamPlayer = sqliteTable(
	'event_team_player',
	{
		eventId: text('event_id')
			.references(() => event.id)
			.notNull(),
		teamId: text('team_id')
			.references(() => team.id)
			.notNull(),
		playerId: text('player_id')
			.references(() => player.id)
			.notNull(),
		role: text('role', { enum: ['main', 'sub', 'coach'] }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [primaryKey({ columns: [t.eventId, t.teamId, t.playerId] })]
);

export type Event = typeof event.$inferSelect;
export type EventOrganizer = typeof eventOrganizer.$inferSelect;
export type EventTeamPlayer = typeof eventTeamPlayer.$inferSelect;
