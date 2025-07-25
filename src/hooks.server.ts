import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth.js';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { syncAll } from '$lib/server/db/sync';
import { dev } from '$app/environment';
import { seed } from '$lib/server/db/seed';
import { LEMON_PUBLIC_JWK_BASE64 } from '$env/static/private';

export const init: ServerInit = async () => {
	console.info('[ServerInit] Syncing database enum tables...');
	await syncAll();

	if (dev) {
		console.info('[ServerInit] Development environment detected');
		await seed();
	}
};

const handleParaglide: Handle = ({ event, resolve }) => {
	// Skip localization for specific paths
	const excludedPaths = ['/sitemap.xml', '/api/'];
	if (excludedPaths.some((path) => event.url.pathname.startsWith(path))) {
		return resolve(event);
	}

	return paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});
};

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;
	return resolve(event);
};

const handleJWKS: Handle = ({ event, resolve }) => {
	if (event.url.pathname === '/.well-known/jwks.json') {
		const raw = Buffer.from(LEMON_PUBLIC_JWK_BASE64, 'base64url').toString('utf-8');
		const jwk = JSON.parse(raw);

		return new Response(JSON.stringify({ keys: [jwk] }), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
			}
		});
	}

	return resolve(event);
};

const handleChromeDevTools: Handle = ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/.well-known/appspecific/com.chrome.devtools')) {
		return new Response(null, { status: 204 });
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleParaglide,
	handleAuth,
	handleJWKS,
	handleChromeDevTools
);
