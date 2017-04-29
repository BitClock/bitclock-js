import { cloneDeep, warn } from '../helpers';

export default function TimingEvent(label, otherData = {}) {
	const start = Date.now();
	const data = {
		get type() {
			return 'timing';
		}
	};

	if (!label) {
		return warn('Label is required');
	} else if (typeof label !== 'string') {
		return warn('Label must be a string');
	}

	Object.assign(data, cloneDeep({ ...otherData, label }));

	const event = {
		get data() {
			return cloneDeep(data);
		},
		close(otherData = {}) {
			const elapsed = Date.now() - start;
			Object.assign(data, cloneDeep({ ...otherData, elapsed }));
			return event;
		}
	};

	return event;
}
