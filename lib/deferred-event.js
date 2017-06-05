import { is, once, hrtime, cloneDeepJSON } from './helpers';

export default function DeferredEvent(initialDims = {}, cb) {
	const start = hrtime();
	return once((finalDims = {}) => {
		const elapsed = hrtime() - start;
		const dimensions = (is(initialDims, 'object') && is(initialDims, 'object'))
			? cloneDeepJSON({ ...initialDims, ...finalDims })
			: null;
		return cb(elapsed, dimensions);
	});
}
