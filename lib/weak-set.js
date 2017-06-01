const { WeakSet } = global;

/**
 * IMPORTANT: MockWeakSet intentionally omits unused methods (like delete)
 */
function MockWeakSet(mws = []) {
	mws.add = (value) => {
		mws.push(value);
		return mws;
	};
	mws.has = (value) => {
		return mws.indexOf(value) !== -1;
	};
	return mws;
}

export default function MaybeWeakSet(iterable) {
	return WeakSet ? new WeakSet(iterable) : MockWeakSet(iterable);
}
