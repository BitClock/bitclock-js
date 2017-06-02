import { is, once, hrtime, cloneDeep } from './helpers';

export default function DeferredEvent(initialDims = {}, cb) {
	const start = hrtime();
	return once((finalDims = {}) => {
		const elapsed = hrtime() - start;
		const dimensions = (is(initialDims, 'object') && is(initialDims, 'object'))
			? cloneDeep({ ...initialDims, ...finalDims })
			: null;
		return cb(elapsed, dimensions);
	});
}
