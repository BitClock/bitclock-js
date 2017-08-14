if (!('BITCLOCK_TOKEN' in process.env)) {
	process.env.BITCLOCK_TOKEN = Math.random().toString(16);
}
