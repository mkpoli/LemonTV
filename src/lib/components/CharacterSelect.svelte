<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import CharacterIcon from './CharacterIcon.svelte';
	import type { Character } from '$lib/data/game';

	// TODO: Add side filter (attacker/defender)
	// TODO: Add character organization (PUS/Scissors/Urbino)

	const CHARACTERS: Character[] = [
		'Yvette',
		'Nobunaga',
		'Kokona',
		'Michele',
		'Flavia',
		'Yugiri',
		'Leona',
		'Reiichi',
		'Lawine',
		'Ming',
		'Meredith',
		'Eika',
		'Kanami',
		'Fragrans',
		'Mara',
		'Audrey',
		'Celestia',
		'Maddelena',
		'Bai Mo',
		'Fuschia',
		'Galatea'
		// 'Chiyo'
	];

	let CHARACTER_NAMES: Record<Character, string> = $derived({
		Yvette: m.Yvette(),
		Nobunaga: m.Nobunaga(),
		Kokona: m.Kokona(),
		Michele: m.Michele(),
		Flavia: m.Flavia(),
		Yugiri: m.Yugiri(),
		Leona: m.Leona(),
		Reiichi: m.Reiichi(),
		Lawine: m.Lawine(),
		Ming: m.Ming(),
		Meredith: m.Meredith(),
		Eika: m.Eika(),
		Kanami: m.Kanami(),
		Fragrans: m.Fragrans(),
		Mara: m.Mara(),
		Audrey: m.Audrey(),
		Celestia: m.Celestia(),
		Maddelena: m.Maddelena(),
		'Bai Mo': m['Bai Mo'](),
		Fuschia: m.Fuschia(),
		Galatea: m.Galatea()
		// Chiyo: 'Chiyo'
	});

	let {
		value = '',
		onChange,
		class: className = ''
	} = $props<{
		value?: Character | '';
		onChange?: (character: Character | '') => void;
		class?: string;
	}>();

	let isOpen = $state(false);
	let search = $state('');

	function toggle() {
		isOpen = !isOpen;
	}

	function select(character: Character | '') {
		value = character;
		onChange?.(character);
		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.character-select')) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			window.addEventListener('click', handleClickOutside);
		}
		return () => {
			window.removeEventListener('click', handleClickOutside);
		};
	});

	const filteredCharacters: Character[] = $derived(
		search ? CHARACTERS.filter((c) => c.toLowerCase().includes(search.toLowerCase())) : CHARACTERS
	);
</script>

<div class={['character-select relative w-full', className]}>
	<button
		type="button"
		class="flex w-full items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-white hover:border-yellow-500 focus:border-yellow-500 focus:outline-none"
		onclick={toggle}
	>
		{#if value}
			<CharacterIcon character={value} class="h-6 w-6" />
			<span>{CHARACTER_NAMES[value as Character] ?? value}</span>
		{:else}
			<span class="text-gray-400">Select character</span>
		{/if}
		<span class="ml-auto text-gray-400">▼</span>
	</button>
	{#if isOpen}
		<div
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-700 bg-slate-800 py-1 shadow-lg"
		>
			<input
				type="text"
				placeholder="Search character..."
				bind:value={search}
				class="mb-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-1 text-white focus:border-yellow-500 focus:outline-none"
			/>
			<button
				type="button"
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-400 hover:bg-slate-700"
				onclick={() => select('')}
			>
				<span class="">None</span>
			</button>
			{#each filteredCharacters as character}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-700"
					onclick={() => select(character)}
				>
					<CharacterIcon {character} class="h-6 w-6" />
					<span>{CHARACTER_NAMES[character as Character] ?? character}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
