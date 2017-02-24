import cookie from 'js-cookie';

export function cloneDeep(obj) {
	return JSON.parse(JSON.stringify(obj));
}

export function getToken(config) {
	let { token } = config;
	if (!token) {
		if (global.process && process.env) {
			token = process.env.BITCLOCK_TOKEN;
		} else if (global.window) {
			token = cookie.get('BITCLOCK_TOKEN');
		}
	}
	return token;
}
