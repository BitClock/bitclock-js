import { once, hrtime, cloneDeepJSON } from './helpers';

export default function DeferredEvent(initialDims, cb) {
	const start = hrtime();
	return once((finalDims) => {
		const elapsed = hrtime() - start;
		const dimensions = cloneDeepJSON({ ...(initialDims || {}), ...(finalDims || {}) });
		return cb(elapsed, dimensions);
	});
}
