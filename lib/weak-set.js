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
	// WeakSet causes a horrible memory leak in node so just use the mock for now
	// https://github.com/nodejs/node/issues/6180
	return MockWeakSet(iterable);
}
