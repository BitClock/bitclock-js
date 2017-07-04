import { is } from './helpers';

const { WeakSet } = global;

function validate(value) {
	if (!value || !is(value, 'object')) {
		throw new TypeError('Invalid value used in weak set');
	}
}

export function MockWeakSet(mws = []) {
	mws.forEach(validate);
	mws.add = (value) => {
		validate(value);
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
	/* istanbul ignore next */
	return WeakSet ? new WeakSet(iterable) : MockWeakSet(iterable);
}
