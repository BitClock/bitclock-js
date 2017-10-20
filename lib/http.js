import fetch from 'isomorphic-fetch';

import { getBucketURL, safeStringify } from './helpers';
import { store } from './config';

export function post(route, { headers = {}, body, ...other } = {}) {
	return Promise.resolve(
		store.enable && fetch(`${getBucketURL()}${route}`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${store.token}`,
				'content-type': 'application/json',
				...headers
			},
			body: body && safeStringify(body),
			...other
		})
	);
}
