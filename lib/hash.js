export default function hash(object, algorithm = 'javaHashCode') {
	const serialized = Object.keys(object).map((key) => {
		let value = object[key];
		if (value && typeof value === 'object') {
			value = hash(value, algorithm);
		}
		return `${key}${value}${key.length}${typeof value === 'string' ? value.length : 0}`;
	})
	.sort()
	.join(':');
	return exports[algorithm](serialized);
}

export function javaHashCode(string) {
	let value = 0;
	for (let i = 0; i < string.length; i++) {
		value = ((value << 5) - value) + string.charCodeAt(i);
		value = value & value; // convert to int32
	}
	return value;
}
