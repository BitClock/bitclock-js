import fetch from 'isomorphic-fetch';

import { getToken } from './auth';
import { getBucketURL, safeStringify } from './helpers';
import CONFIG from './config';

export function post(route, { headers = {}, body, ...other } = {}) {
	return Promise.resolve(
		CONFIG.enable && fetch(`${getBucketURL()}${route}`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${getToken()}`,
				'content-type': 'application/json',
				...headers
			},
			body: body && safeStringify(body),
			...other
		})
	);
}
