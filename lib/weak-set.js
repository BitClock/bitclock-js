const { WeakSet } = global;

function MockWeakSet(mws = []) {
	mws.add = (value) => {
		mws.push(value);
		return mws;
	};
	mws.has = (value) => {
		return mws.indexOf(value) !== -1;
	};
	mws.delete = (value) => {
		const index = mws.indexOf(value);
		if (index !== -1) {
			mws.splice(index, 1);
		}
		return mws;
	};
	return mws;
}

export default function MaybeWeakSet(iterable) {
	return WeakSet ? new WeakSet(iterable) : MockWeakSet(iterable);
}
