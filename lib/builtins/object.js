const { Object } = global;

exports.values = /* istanbul ignore next */ Object.values || (target => (
	Object.keys(target).map(key => target[key])
));

exports.entries = /* istanbul ignore next */ Object.entries || (target => (
	Object.keys(target).map(key => [key, target[key]])
));

exports.assign = /* istanbul ignore next */ Object.assign || function () {
	const { hasOwnProperty } = Object.prototype;
	const args = arguments;
	const target = args[0];
	for (let i = 1; i < args.length; i++) {
		const source = args[i];
		for (const key in source) {
			if (hasOwnProperty.call(source, key)) {
				target[key] = source[key];
			}
		}
	}
	return target;
};
