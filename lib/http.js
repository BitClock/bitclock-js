import fetch from 'isomorphic-fetch';

import { getBucketURL, safeStringify } from './helpers';
import { getToken, store } from './config';
import { warn } from './logger';

export function post(route, { headers = {}, body, ...other } = {}) {
	const token = getToken();
	if (!token) {
		warn(() => 'Missing token');
	}
	return Promise.resolve(
		store.enable && token && fetch(`${getBucketURL()}${route}`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
				...headers
			},
			body: body && safeStringify(body),
			...other
		})
	);
}
